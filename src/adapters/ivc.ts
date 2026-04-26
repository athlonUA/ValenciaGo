import axios from 'axios';
import * as cheerio from 'cheerio';
import type { SourceAdapter, RawEvent } from '../types/index.js';
import { isAllowedUrl } from '../utils/url.js';
import { mapWithConcurrency } from '../utils/concurrency.js';
import { createLogger } from '../utils/logger.js';
import { ddmmyyyyToMadridIso, startOfDayMadrid, endOfDayMadrid } from '../utils/dates.js';

const log = createLogger('ivc');

const BASE_URL = 'https://ivc.gva.es';
const LISTING_URL = `${BASE_URL}/es/ivc/agenda-ivc`;

const MONTHS_ES_SHORT: Record<string, number> = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
};

/**
 * Adapter for the Institut Valencià de Cultura (Generalitat) cultural agenda. Covers
 * Teatre Principal, Teatre Rialto, Filmoteca and other regional cultural programming.
 * Filters out non-València-city venues (Castelló, Alacant) since those are out of scope.
 */
export class IvcAdapter implements SourceAdapter {
  readonly name = 'ivc';
  readonly enabled = true;

  async fetchEvents(): Promise<RawEvent[]> {
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
    let skippedOutOfCity = 0;
    let skippedExpired = 0;

    $('.actividad').each((_, el) => {
      try {
        const event = this.parseCard($, $(el));
        if (!event) {
          skippedExpired++;
          return;
        }
        if (!isValenciaCityVenue(event.venue)) {
          skippedOutOfCity++;
          return;
        }
        if (seen.has(event.sourceId)) return;
        seen.add(event.sourceId);
        events.push(event);
      } catch (err) {
        log.error({ err }, 'Error parsing card');
      }
    });

    log.info({ count: events.length, skippedOutOfCity, skippedExpired }, 'Parsed events');

    await this.enrichWithDescriptions(events);

    return events;
  }

  private parseCard($: cheerio.CheerioAPI, card: ReturnType<cheerio.CheerioAPI>): RawEvent | null {
    const titleAnchor = card.find('h2 a').first();
    const title = titleAnchor.text().trim();
    const href = titleAnchor.attr('href') || '';
    if (!title || !href) return null;

    const sourceUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    const sourceId = buildSourceId(href);
    if (!sourceId) return null;

    const dia = card.find('.fecha .dia').first().text().trim();
    const mes = card.find('.fecha .mes').first().text().trim().toLowerCase();
    const isUntil = card.find('.fecha .hasta_el').length > 0;

    const dateIso = inferDate(dia, mes);
    if (!dateIso) {
      log.warn({ title, dia, mes }, 'Could not infer date');
      return null;
    }

    const venue = card.find('.lugar').first().text().trim();
    const imgSrc = card.find('img').first().attr('src');
    const imageUrl = imgSrc
      ? (imgSrc.startsWith('http') ? imgSrc : `${BASE_URL}${imgSrc}`)
      : undefined;

    let startsAt: string;
    let endsAt: string | undefined;

    if (isUntil) {
      // "hasta el DD mes" = ongoing run ending on this date. Anchor startsAt to the
      // start of today (Madrid) and endsAt to end-of-day on the run's last date so
      // the event stays visible in /today and we never violate chk_events_end_after_start
      // even when ingest runs in the evening of the last day.
      const inferredEnd = endOfDayMadrid(new Date(dateIso));
      if (inferredEnd.getTime() < Date.now()) {
        // Listing still mentions an event whose end-of-day is already past — skip rather
        // than write a broken row.
        return null;
      }
      const todayStart = startOfDayMadrid();
      // Defensive: if today is somehow after inferredEnd's day boundary (shouldn't happen
      // given the check above, but leap second / clock skew), clamp.
      startsAt = (todayStart.getTime() < inferredEnd.getTime() ? todayStart : new Date(inferredEnd.getTime() - 60_000)).toISOString();
      endsAt = inferredEnd.toISOString();
    } else {
      startsAt = dateIso;
      endsAt = undefined;
    }

    return {
      sourceId,
      title,
      startsAt,
      endsAt,
      sourceUrl,
      imageUrl,
      venue: venue || undefined,
      language: 'es',
      rawPayload: {
        ongoing: isUntil,
        rawFecha: `${dia} ${mes}${isUntil ? ' (hasta el)' : ''}`,
      },
    };
  }

  private async enrichWithDescriptions(events: RawEvent[]): Promise<void> {
    let enriched = 0;

    await mapWithConcurrency(
      events,
      async (event) => {
        if (!isAllowedUrl(event.sourceUrl, 'ivc')) {
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
          const desc = extractIvcDescription($);
          if (desc) {
            event.description = desc.substring(0, 2000);
            enriched++;
          }
        } catch (err) {
          log.error({ err, url: event.sourceUrl }, 'Error fetching detail');
        }
      },
      { concurrency: 3, delayMs: 200 },
    );

    log.info({ enriched, total: events.length }, 'Enriched with descriptions');
  }
}

/**
 * Build a stable, collision-free sourceId from an IVC href. IVC uses two URL shapes for
 * detail pages (verified in production data):
 *   /es/ivc/agenda-ivc/<slug>
 *   /es/ivc/pelicula-<NNNN>/<slug>
 * Two films with the same slug from different "pelicula-NNNN" buckets would collide if
 * we kept only the trailing segment. Including the parent segment makes sourceId unique.
 * Exported for tests.
 */
export function buildSourceId(href: string): string | null {
  // Strip query/hash, normalize trailing slash
  const path = href.split('?')[0].split('#')[0].replace(/\/$/, '');
  const parts = path.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  // Use the last two path segments — parent disambiguates same-slug films across buckets.
  return parts.slice(-2).join('/');
}

/**
 * Pull a usable description from an IVC detail page. The DOM is custom (no JSON-LD,
 * no <meta name=description>, no .descripcion class). We use .resumen (short prize/cast
 * line) plus the long-form text inside .bloque-textos that follows the metadata header.
 * Exported for tests.
 */
export function extractIvcDescription($: cheerio.CheerioAPI): string {
  const resumen = $('.resumen').first().text().replace(/\s+/g, ' ').trim();
  // .bloque-textos contains: date · venue · TITLE · organisation · long body. Strip the
  // header up to the title (we already have it as event.title) by taking everything
  // after the last <h1>/<h2> if present, else the whole block.
  const bloque = $('.bloque-textos').first();
  let body = '';
  if (bloque.length) {
    const heading = bloque.find('h1, h2').last();
    if (heading.length) {
      // Take text from elements that come after the heading
      const after = heading.nextAll();
      body = after.map((_, el) => $(el).text()).get().join(' ');
    } else {
      body = bloque.text();
    }
    body = body.replace(/\s+/g, ' ').trim();
  }
  const parts = [resumen, body].filter(s => s && s.length > 5);
  return parts.join(' — ');
}

/**
 * Infer ISO date from the listing's day-of-month and 3-letter Spanish month. The card
 * doesn't carry a year, so we pick the next occurrence at or after today (Madrid).
 * Validates calendar overflow (Feb 29 in non-leap year, Apr 31 etc.) — JavaScript's
 * Date silently rolls over and we'd corrupt data otherwise. Exported for tests.
 */
export function inferDate(dia: string, mes: string): string | null {
  const day = Number(dia);
  const monthIdx = MONTHS_ES_SHORT[mes];
  if (Number.isNaN(day) || monthIdx === undefined || day < 1 || day > 31) return null;

  const now = new Date();
  let year = now.getFullYear();
  let candidate = new Date(year, monthIdx, day);
  // If this year's candidate is more than ~30 days in the past, the listing means next year.
  const dayMs = 86_400_000;
  if (candidate.getTime() < now.getTime() - 30 * dayMs) {
    year += 1;
    candidate = new Date(year, monthIdx, day);
  }

  // Reject if the calendar overflowed: e.g. inferDate('29','feb') in a non-leap year
  // produces a Date that lands on March 1. We want to skip such cards rather than write
  // a wrong day to the DB.
  if (candidate.getMonth() !== monthIdx || candidate.getDate() !== day) {
    return null;
  }

  const dd = String(day).padStart(2, '0');
  const mm = String(monthIdx + 1).padStart(2, '0');
  return ddmmyyyyToMadridIso(`${dd}/${mm}/${year}`);
}

/**
 * IVC programmes events region-wide; we only want València-city venues. The card's
 * `.lugar` carries human venue names like "Teatre Principal de València" or
 * "Auditori i Palau de Congressos de Castelló" — we keep only those that contain the
 * city token "valencia" (after accent stripping). Exported for tests.
 */
export function isValenciaCityVenue(venue?: string): boolean {
  if (!venue) return false;
  const normalised = venue
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  // \bvalencia\b matches "Teatre Principal de Valencia" but NOT "comunitat valenciana".
  return /\bvalencia\b/.test(normalised);
}
