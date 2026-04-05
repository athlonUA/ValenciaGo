import axios from 'axios';
import * as cheerio from 'cheerio';
import type { SourceAdapter, RawEvent } from '../types/index.js';
import { createLogger } from '../utils/logger.js';
import { isAllowedUrl } from '../utils/url.js';

const log = createLogger('valenciacf');

const SCHEDULE_URL = 'https://www.valenciacf.com/results?range=next';

/**
 * Valencia CF match schedule adapter.
 * Scrapes upcoming matches from the official website.
 */
export class ValenciaCFAdapter implements SourceAdapter {
  readonly name = 'valenciacf';
  readonly enabled = true;

  async fetchEvents(): Promise<RawEvent[]> {
    log.info({ url: SCHEDULE_URL }, 'Fetching schedule');

    const response = await axios.get(SCHEDULE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ValenciaEventsBot/1.0)',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);
    const events: RawEvent[] = [];

    $('.card-game').each((_, el) => {
      try {
        const card = $(el);

        // Teams
        const homeTeam = card.find('.card-game__teams__name--left').text().trim();
        const awayTeam = card.find('.card-game__teams__name--right').text().trim();
        if (!homeTeam || !awayTeam) return;

        const title = `${homeTeam} vs ${awayTeam}`;

        // Date: try multiple selectors
        const dateText = card.find('.card-game__date__date').text().trim()
          || card.find('.card-game__date').text().trim();

        // Time
        const timeText = card.find('.card-game__teams__time').text().trim();

        // Competition
        const competition = card.find('.card-game__competition__name').text().trim()
          || card.find('.card-game__league').text().trim();

        // Link
        const link = card.find('a').attr('href') || '';
        const sourceUrl = link.startsWith('http') ? link : `https://www.valenciacf.com${link}`;

        if (!isAllowedUrl(sourceUrl, 'valenciacf')) {
          log.warn({ url: sourceUrl }, 'Skipping disallowed URL');
          return;
        }

        // Parse date
        const startsAt = this.parseMatchDate(dateText, timeText);
        if (!startsAt) return;

        // Determine venue
        const isHome = homeTeam.toLowerCase().includes('valencia');
        const venue = isHome ? 'Estadio Mestalla' : undefined;

        events.push({
          sourceId: `vcf-${startsAt}-${homeTeam}-${awayTeam}`.replace(/\s+/g, '-').toLowerCase(),
          title,
          description: `${competition || 'Football match'}. ${homeTeam} vs ${awayTeam}${venue ? ' at ' + venue : ''}.`,
          startsAt,
          venue,
          address: isHome ? 'Av. de Suècia, s/n, 46010 València' : undefined,
          latitude: isHome ? 39.4745 : undefined,
          longitude: isHome ? -0.3583 : undefined,
          sourceUrl,
          priceInfo: undefined,
          language: 'en',
          rawPayload: {
            competition,
            homeTeam,
            awayTeam,
            isHome,
          },
        });
      } catch (err) {
        log.error({ err }, 'Error parsing card');
      }
    });

    log.info({ count: events.length }, 'Parsed upcoming matches');
    return events;
  }

  private parseMatchDate(dateText: string, timeText: string): string | null {
    if (!dateText) return null;

    // Try patterns like "12/04/2026", "12 Apr", "Sat 12 Apr"
    const ddmmyyyy = dateText.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      const time = this.parseTime(timeText);
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${time}+02:00`;
    }

    // Try "12 Apr 2026" or similar
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
      ene: '01', abr: '04', ago: '08', dic: '12',
    };

    const textMatch = dateText.match(/(\d{1,2})\s*(?:de\s+)?(\w{3})\w*\s*(\d{4})?/i);
    if (textMatch) {
      const day = textMatch[1].padStart(2, '0');
      const monthKey = textMatch[2].toLowerCase().substring(0, 3);
      const month = months[monthKey];
      const year = textMatch[3] || '2026';
      if (month) {
        const time = this.parseTime(timeText);
        return `${year}-${month}-${day}T${time}+02:00`;
      }
    }

    return null;
  }

  private parseTime(timeText: string): string {
    if (!timeText) return '12:00:00';
    const match = timeText.match(/(\d{1,2}):(\d{2})/);
    if (match) return `${match[1].padStart(2, '0')}:${match[2]}:00`;
    return '12:00:00';
  }
}
