import axios from 'axios';
import * as cheerio from 'cheerio';
import type { SourceAdapter, RawEvent } from '../types/index.js';
import { isAllowedUrl } from '../utils/url.js';
import { mapWithConcurrency } from '../utils/concurrency.js';
import { createLogger } from '../utils/logger.js';
import { ddmmyyyyToMadridIso } from '../utils/dates.js';

const log = createLogger('visitvalencia');

const BASE_URL = 'https://www.visitvalencia.com';
// The Spanish listing carries ~2× more events than the English one — many municipal
// festivals (e.g. TastArròs, FestIN) are only translated to ES.
const LISTING_URL = `${BASE_URL}/agenda-valencia`;

export class VisitValenciaAdapter implements SourceAdapter {
  readonly name = 'visitvalencia';
  readonly enabled = true;

  async fetchEvents(): Promise<RawEvent[]> {
    const events: RawEvent[] = [];
    const now = new Date();

    // Fetch current month and next month
    const months = [
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    ];
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    months.push(
      `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`,
    );

    for (const month of months) {
      try {
        const monthEvents = await this.fetchMonth(month);
        events.push(...monthEvents);
      } catch (err) {
        log.error({ err, month }, 'Failed to fetch month');
      }
    }

    // Deduplicate by sourceId within adapter
    const seen = new Set<string>();
    const unique = events.filter(e => {
      if (seen.has(e.sourceId)) return false;
      seen.add(e.sourceId);
      return true;
    });

    // Fetch detail pages for descriptions (rate-limited)
    log.info({ count: unique.length }, 'Fetching detail pages');
    await this.enrichWithDetails(unique);

    return unique;
  }

  private async fetchMonth(month: string): Promise<RawEvent[]> {
    const url = `${LISTING_URL}?date=${month}`;
    log.info({ url }, 'Fetching month page');

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ValenciaEventsBot/1.0)',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);
    const events: RawEvent[] = [];

    // Parse all event cards (both highlight and tile sections)
    $('.card--event').each((_, el) => {
      try {
        const card = $(el);
        const event = this.parseCard($, card);
        if (event) events.push(event);
      } catch (err) {
        log.error({ err }, 'Error parsing card');
      }
    });

    log.info({ count: events.length, month }, 'Parsed events for month');
    return events;
  }

  private parseCard($: cheerio.CheerioAPI, card: ReturnType<cheerio.CheerioAPI>): RawEvent | null {
    // Title
    const title = card.find('.card__heading').text().trim();
    if (!title) return null;

    // URL: from .card__link href or about attribute
    const eventPath = card.find('.card__link').attr('href') || card.attr('about') || '';
    if (!eventPath) return null;

    // Ensure full URL
    const sourceUrl = eventPath.startsWith('http') ? eventPath : `${BASE_URL}${eventPath}`;

    // Source ID: use node ID or URL slug. Strip both ES and legacy EN prefixes so that
    // an event seen via either listing maps to the same sourceId.
    const nodeId = card.attr('data-history-node-id') || '';
    const sourceId = nodeId || eventPath
      .replace(/^\/agenda-valencia\//, '')
      .replace(/^\/en\/events-valencia\//, '')
      .replace(/\/$/, '');

    // Date parsing
    const dateText = card.find('.card__date').text().trim();
    const { startDate, endDate } = this.parseDateRange(dateText);
    if (!startDate) return null;

    // Category (only on highlight cards)
    const categoryTag = card.find('.tag').text().trim().toLowerCase();

    // Image
    let imageUrl: string | undefined;
    const imgSrc = card.find('img').first().attr('src');
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
      priceInfo: undefined, // Not available on listing cards
      rawPayload: {
        category: categoryTag || undefined,
        nodeId,
        dateText,
      },
    };
  }

  private async enrichWithDetails(events: RawEvent[]): Promise<void> {
    let enriched = 0;

    await mapWithConcurrency(
      events,
      async (event) => {
        if (!isAllowedUrl(event.sourceUrl, 'visitvalencia')) {
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

          const $ = cheerio.load(response.data);

          // Description from body text
          const bodyText = $('.text-long').text().trim();
          if (bodyText) {
            event.description = bodyText.substring(0, 2000);
          }

          // Price + venue from detail info. Labels differ by locale (price/precio, place/lugar).
          $('.more-info--details .list-item').each((_, el) => {
            const label = $(el).find('b').text().trim().toLowerCase();
            const value = $(el).find('p').text().trim();
            if (!value) return;
            if (label.includes('price') || label.includes('precio')) {
              event.priceInfo = value.substring(0, 200);
            } else if ((label.includes('place') || label.includes('lugar')) && !event.venue) {
              event.venue = value.substring(0, 500);
            }
          });

          enriched++;
        } catch (err) {
          log.error({ err }, 'Error fetching detail page');
        }
      },
      { concurrency: 3, delayMs: 200 },
    );

    log.info({ enriched, total: events.length }, 'Enriched events with details');
  }

  private parseDateRange(text: string): { startDate: string | null; endDate: string | null } {
    if (!text) return { startDate: null, endDate: null };

    // Collapse whitespace first so multi-line "Del\n  DD/MM/YYYY\n  al  DD/MM/YYYY" cards parse.
    // Strip leading "From"/"Del" and replace inner " to "/" al " with a pipe separator. Use word
    // boundaries — a bare /to/ would match inside numbers like "october" or "2024".
    const cleaned = text
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^(From|Del)\s+/i, '')
      .replace(/\s+(to|al)\s+/i, ' | ');

    // Range: "DD/MM/YYYY | DD/MM/YYYY". The END date anchors at 23:59 so a multi-day
    // festival like TastArròs (Del 25/04 al 26/04) stays visible in /today queries the
    // entire day it ends, not just until noon.
    const rangeMatch = cleaned.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*\|\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (rangeMatch) {
      return {
        startDate: ddmmyyyyToMadridIso(rangeMatch[1]),
        endDate: ddmmyyyyToMadridIso(rangeMatch[2], 23, 59),
      };
    }

    // Single date: "DD/MM/YYYY"
    const singleMatch = cleaned.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (singleMatch) {
      return {
        startDate: ddmmyyyyToMadridIso(singleMatch[1]),
        endDate: null,
      };
    }

    return { startDate: null, endDate: null };
  }
}
