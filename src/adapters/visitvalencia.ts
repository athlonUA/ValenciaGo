import axios from 'axios';
import * as cheerio from 'cheerio';
import type { SourceAdapter, RawEvent } from '../types/index.js';
import { isAllowedUrl } from '../utils/url.js';
import { mapWithConcurrency } from '../utils/concurrency.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('visitvalencia');

const BASE_URL = 'https://www.visitvalencia.com';
const LISTING_URL = `${BASE_URL}/en/events-valencia`;

// Visit Valencia category IDs to our internal mapping hints (reserved for future per-source classification)
// const VV_CATEGORIES: Record<string, string> = { exhibitions: 'arts', music: 'music', ... };

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
        'Accept-Language': 'en-US,en;q=0.9',
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

    // Source ID: use node ID or URL slug
    const nodeId = card.attr('data-history-node-id') || '';
    const sourceId = nodeId || eventPath.replace(/^\/en\/events-valencia\//, '').replace(/\/$/, '');

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
      language: 'en',
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
              'Accept-Language': 'en-US,en;q=0.9',
            },
            timeout: 10000,
          });

          const $ = cheerio.load(response.data);

          // Description from body text
          const bodyText = $('.text-long').text().trim();
          if (bodyText) {
            event.description = bodyText.substring(0, 2000);
          }

          // Price from detail info
          const detailItems = $('.more-info--details .list-item');
          detailItems.each((_, el) => {
            const label = $(el).find('b').text().trim().toLowerCase();
            const value = $(el).find('p').text().trim();
            if (label.includes('price') && value) {
              event.priceInfo = value.substring(0, 200);
            }
          });

          // Venue from detail info
          detailItems.each((_, el) => {
            const label = $(el).find('b').text().trim().toLowerCase();
            const value = $(el).find('p').text().trim();
            if (label.includes('place') && value && !event.venue) {
              event.venue = value;
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

    // Clean up the text
    const cleaned = text
      .replace(/From\s*/i, '')
      .replace(/to\s*/i, '|')
      .replace(/\s+/g, ' ')
      .trim();

    // Range: "DD/MM/YYYY | DD/MM/YYYY"
    const rangeMatch = cleaned.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*\|\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (rangeMatch) {
      return {
        startDate: this.ddmmyyyyToISO(rangeMatch[1]),
        endDate: this.ddmmyyyyToISO(rangeMatch[2]),
      };
    }

    // Single date: "DD/MM/YYYY"
    const singleMatch = cleaned.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (singleMatch) {
      return {
        startDate: this.ddmmyyyyToISO(singleMatch[1]),
        endDate: null,
      };
    }

    return { startDate: null, endDate: null };
  }

  private ddmmyyyyToISO(date: string): string {
    const [day, month, year] = date.split('/');
    const m = Number(month);
    // Use noon to safely land on the correct day regardless of CET/CEST
    // CEST (UTC+2): last Sunday of March → last Sunday of October
    // CET  (UTC+1): rest of the year
    const offset = (m >= 4 && m <= 10) ? '+02:00' : '+01:00';
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00${offset}`;
  }
}
