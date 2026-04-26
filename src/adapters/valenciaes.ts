import axios from 'axios';
import * as cheerio from 'cheerio';
import type { SourceAdapter, RawEvent } from '../types/index.js';
import { isAllowedUrl } from '../utils/url.js';
import { mapWithConcurrency } from '../utils/concurrency.js';
import { createLogger } from '../utils/logger.js';
import { ddmmyyyyToMadridIso } from '../utils/dates.js';

const log = createLogger('valenciaes');

const BASE_URL = 'https://www.valencia.es';
const LISTING_URL = `${BASE_URL}/cas/agenda-de-la-ciudad`;
const CONTENT_PATH = '/cas/agenda-de-la-ciudad/-/content/';

/**
 * Adapter for the Ayuntamiento de València official agenda. Carries the free, public,
 * municipally-organised events that visitvalencia.com sometimes misses (TastArròs,
 * Fiestas de la Cruz, library programming, neighbourhood activities).
 *
 * DISABLED: the agenda listing is rendered client-side by a Liferay portlet
 * (CalendarAc_INSTANCE_iWBt6iPSuFjM) that requires a CSRF token + session cookie + JS
 * execution to render the cards. The card-parsing logic below is correct and exercised
 * via Playwright, but a plain axios+cheerio fetch returns the empty shell. Re-enable
 * once we either a) add a headless-browser runtime, or b) reverse-engineer the
 * portlet's resource-phase JSON endpoint.
 */
export class ValenciaEsAdapter implements SourceAdapter {
  readonly name = 'valenciaes';
  readonly enabled = false;

  async fetchEvents(): Promise<RawEvent[]> {
    // Defensive guard: even though the registry filters disabled adapters, a direct caller
    // (a future test or CLI hook) shouldn't accidentally hit the live site for an adapter
    // we know returns nothing useful without a JS runtime.
    if (!this.enabled) return [];

    log.info({ url: LISTING_URL }, 'Fetching listing');

    const response = await axios.get(LISTING_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ValenciaEventsBot/1.0)',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);
    const events: RawEvent[] = [];
    const seen = new Set<string>();

    $('.div-bloque-actualidad').each((_, el) => {
      try {
        const event = this.parseCard($, $(el));
        if (event && !seen.has(event.sourceId)) {
          seen.add(event.sourceId);
          events.push(event);
        }
      } catch (err) {
        log.error({ err }, 'Error parsing card');
      }
    });

    log.info({ count: events.length }, 'Parsed events from listing');

    await this.enrichWithDetails(events);

    return events;
  }

  private parseCard($: cheerio.CheerioAPI, card: ReturnType<cheerio.CheerioAPI>): RawEvent | null {
    const link = card.find('a.a-actualidad').first();
    if (!link.length) return null;

    const href = link.attr('href') || '';
    if (!href.includes(CONTENT_PATH)) return null;

    const sourceUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    const sourceId = href.split(CONTENT_PATH)[1]?.replace(/\/$/, '') || '';
    if (!sourceId) return null;

    const title = link.find('.label-title-agenda').text().trim()
      || link.attr('alt')?.trim()
      || '';
    if (!title) return null;

    const fullText = link.text().replace(/\s+/g, ' ').trim();
    const { startDate, endDate } = parseDateRange(fullText);
    if (!startDate) {
      log.warn({ title, sample: fullText.slice(0, 100) }, 'No date found in card');
      return null;
    }

    let imageUrl: string | undefined;
    const imgSrc = link.find('img').first().attr('src');
    if (imgSrc) {
      imageUrl = imgSrc.startsWith('http') ? imgSrc : `${BASE_URL}${imgSrc}`;
    }

    return {
      sourceId,
      title,
      startsAt: startDate,
      endsAt: endDate || undefined,
      sourceUrl,
      imageUrl,
      language: 'es',
      rawPayload: {
        category: extractCategoryHint(fullText, title),
      },
    };
  }

  private async enrichWithDetails(events: RawEvent[]): Promise<void> {
    let enriched = 0;

    await mapWithConcurrency(
      events,
      async (event) => {
        if (!isAllowedUrl(event.sourceUrl, 'valenciaes')) {
          log.warn({ url: event.sourceUrl }, 'Skipping disallowed URL');
          return;
        }

        try {
          const response = await axios.get(event.sourceUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; ValenciaEventsBot/1.0)',
              'Accept-Language': 'es-ES,es;q=0.9',
            },
            timeout: 10000,
          });

          const $ = cheerio.load(response.data as string);

          // The detail page is a Liferay journal article. Pull the main article block — it
          // contains the metadata header (FECHA: ..., LUGAR: ...) followed by the body.
          const article = $('.journal-content-article').first();
          const articleText = (article.length ? article.text() : $('main').text())
            .replace(/\s+/g, ' ')
            .trim();

          if (!articleText) return;

          // articleText has had whitespace collapsed to single spaces, so [^\n] would match
          // everything. The match below uses an explicit "stop at next known label" lookahead.
          const STOP_LABELS = '(?:FECHA|HORARIO|HORA|PRECIO|ENTRADAS?|ORGANIZA|TEL[EÉ]FONO|DESCRIPCI[OÓ]N|$)';
          const lugarRegex = new RegExp(`LUGAR:\\s*(.+?)(?=\\s+${STOP_LABELS})`, 'i');
          const lugarMatch = articleText.match(lugarRegex);
          if (lugarMatch && !event.venue) {
            event.venue = lugarMatch[1].trim().substring(0, 500);
          }

          // Description = whatever follows the FECHA/LUGAR header block. Split on the same
          // pattern so we don't lose text past the venue. Earlier code used [^\n]+? but
          // newlines are already collapsed — that matched only one character and broke.
          const afterMeta = lugarMatch
            ? articleText.slice(lugarMatch.index! + lugarMatch[0].length).trim()
            : articleText;
          event.description = afterMeta.substring(0, 2000);

          enriched++;
        } catch (err) {
          log.error({ err, url: event.sourceUrl }, 'Error fetching detail page');
        }
      },
      { concurrency: 3, delayMs: 200 },
    );

    log.info({ enriched, total: events.length }, 'Enriched with details');
  }
}

function parseDateRange(text: string): { startDate: string | null; endDate: string | null } {
  // Card format: "DD/MM/YYYY" or "DD/MM/YYYY - DD/MM/YYYY" embedded in the link's full text.
  const rangeMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
  if (rangeMatch) {
    return {
      startDate: ddmmyyyyToMadridIso(rangeMatch[1]),
      endDate: ddmmyyyyToMadridIso(rangeMatch[2]),
    };
  }
  const singleMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
  if (singleMatch) {
    return { startDate: ddmmyyyyToMadridIso(singleMatch[1]), endDate: null };
  }
  return { startDate: null, endDate: null };
}

function extractCategoryHint(text: string, title: string): string | undefined {
  // Card text shape: "Title  DD/MM/YYYY[ - DD/MM/YYYY]  CATEGORY". Stripping the title and
  // dates leaves the trailing category tag (e.g. FESTIVALES, MÚSICA, AGENDA INFANTIL).
  const remainder = text
    .replace(title, '')
    .replace(/\d{1,2}\/\d{1,2}\/\d{4}(\s*-\s*\d{1,2}\/\d{1,2}\/\d{4})?/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return remainder ? remainder.substring(0, 80) : undefined;
}
