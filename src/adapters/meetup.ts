import axios from 'axios';
import * as cheerio from 'cheerio';
import type { SourceAdapter, RawEvent } from '../types/index.js';
import { isAllowedUrl } from '../utils/url.js';
import { mapWithConcurrency } from '../utils/concurrency.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('meetup');

const FIND_URL = 'https://www.meetup.com/find/es--valencia/';

// Additional category pages for more coverage
const CATEGORY_URLS = [
  'https://www.meetup.com/find/es--valencia/?categoryId=32',  // Sports & Fitness
  'https://www.meetup.com/find/es--valencia/?categoryId=15',  // Arts & Culture
];

interface MeetupEventData {
  id: string;
  title: string;
  eventUrl: string;
  eventType: string;
  dateTime: string;
  endTime: string;
  isOnline: boolean;
  going?: { totalCount: number };
  feeSettings?: { amount: number; currency: string } | null;
  featuredEventPhoto?: {
    highResUrl?: string;
    baseUrl?: string;
  } | null;
  group: {
    id: string;
    name: string;
    timezone: string;
    urlname: string;
  };
  venue?: {
    name: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    lat?: number;
    lng?: number;
  } | null;
  description?: string;
}

export class MeetupAdapter implements SourceAdapter {
  readonly name = 'meetup';
  readonly enabled = true;

  async fetchEvents(): Promise<RawEvent[]> {
    log.info({ url: FIND_URL }, 'Fetching events');

    const response = await axios.get(FIND_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 15000,
    });

    const html = response.data as string;

    // Extract from main page
    const events = this.extractFromNextData(html);
    const jsonLdEvents = this.extractFromJsonLd(html);
    let merged = this.mergeEvents(events, jsonLdEvents);

    // Safety limit — prevent unbounded fetching
    const MAX_EVENTS = 500;

    // Fetch additional category pages for broader coverage
    for (const catUrl of CATEGORY_URLS) {
      if (merged.length >= MAX_EVENTS) break;
      try {
        const catResponse = await axios.get(catUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml',
          },
          timeout: 15000,
        });
        const catEvents = this.extractFromNextData(catResponse.data as string);
        const catJsonLd = this.extractFromJsonLd(catResponse.data as string);
        merged = this.mergeEvents(merged, [...catEvents, ...catJsonLd]);
      } catch (err) {
        log.error({ err }, 'Error fetching category page');
      }
    }

    log.info({ count: merged.length }, 'Parsed unique events');

    // Fetch descriptions from individual event pages
    log.info('Fetching detail pages for descriptions...');
    await this.enrichWithDescriptions(merged);

    return merged;
  }

  private extractFromNextData(html: string): RawEvent[] {
    const $ = cheerio.load(html);
    const scriptEl = $('script#__NEXT_DATA__');
    if (!scriptEl.length) {
      log.warn('__NEXT_DATA__ not found, falling back to JSON-LD');
      return [];
    }

    try {
      const data = JSON.parse(scriptEl.text());
      const pageProps = data?.props?.pageProps;
      if (!pageProps) return [];

      const allEvents: MeetupEventData[] = [];

      // Collect events from all available arrays
      const arrays = [
        'eventsInLocation',
        'todayEvents',
        'thisWeekendEvents',
        'topicalEventsMusic',
        'topicalEventsSocial',
        'topicalEventsOutdoor',
        'topicalEventsSports',
      ];

      for (const key of arrays) {
        const arr = pageProps[key];
        if (Array.isArray(arr)) {
          allEvents.push(...arr);
        }
      }

      // Deduplicate by event ID
      const seen = new Set<string>();
      const unique: MeetupEventData[] = [];
      for (const evt of allEvents) {
        if (evt.id && !seen.has(evt.id)) {
          seen.add(evt.id);
          unique.push(evt);
        }
      }

      return unique.map(evt => this.meetupToRawEvent(evt));
    } catch (err) {
      log.error({ err }, 'Failed to parse __NEXT_DATA__');
      return [];
    }
  }

  private extractFromJsonLd(html: string): RawEvent[] {
    const $ = cheerio.load(html);
    const events: RawEvent[] = [];

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).text());
        if (data['@type'] === 'Event') {
          events.push(this.jsonLdToRawEvent(data));
        }
      } catch (err) {
        log.error({ err }, 'Error parsing JSON-LD block');
      }
    });

    return events;
  }

  private meetupToRawEvent(evt: MeetupEventData): RawEvent {
    let priceInfo: string | undefined;
    if (evt.feeSettings) {
      priceInfo = `${evt.feeSettings.amount} ${evt.feeSettings.currency}`;
    } else {
      priceInfo = 'Free';
    }

    let venue: string | undefined;
    let address: string | undefined;
    let latitude: number | undefined;
    let longitude: number | undefined;

    if (evt.venue) {
      venue = evt.venue.name;
      const parts = [evt.venue.address, evt.venue.city].filter(Boolean);
      address = parts.join(', ') || undefined;
      latitude = evt.venue.lat;
      longitude = evt.venue.lng;
    }

    if (evt.isOnline) {
      venue = 'Online';
    }

    return {
      sourceId: evt.id,
      title: evt.title,
      description: evt.description,
      startsAt: evt.dateTime,
      endsAt: evt.endTime || undefined,
      venue,
      address,
      latitude,
      longitude,
      sourceUrl: evt.eventUrl,
      imageUrl: evt.featuredEventPhoto?.highResUrl || undefined,
      priceInfo,
      language: 'en',
      rawPayload: {
        groupName: evt.group?.name,
        groupUrlname: evt.group?.urlname,
        going: evt.going?.totalCount,
        eventType: evt.eventType,
      },
    };
  }

  private jsonLdToRawEvent(data: Record<string, unknown>): RawEvent {
    const location = data.location as Record<string, unknown> | undefined;
    const address = location?.address as Record<string, unknown> | undefined;
    const organizer = data.organizer as Record<string, unknown> | undefined;

    const eventUrl = data.url as string;
    // Extract ID from URL: .../events/123456/
    const idMatch = eventUrl.match(/\/events\/(\d+)/);
    const sourceId = idMatch ? idMatch[1] : eventUrl;

    return {
      sourceId,
      title: data.name as string,
      description: (data.description as string) || undefined,
      startsAt: data.startDate as string,
      endsAt: (data.endDate as string) || undefined,
      venue: location?.name as string | undefined,
      address: address?.streetAddress as string | undefined,
      sourceUrl: eventUrl,
      language: 'en',
      rawPayload: {
        organizer: organizer?.name,
        eventStatus: data.eventStatus,
        attendanceMode: data.eventAttendanceMode,
        source: 'json-ld',
      },
    };
  }

  private async enrichWithDescriptions(events: RawEvent[]): Promise<void> {
    let enriched = 0;
    const needsEnrichment = events.filter(e => !e.description);

    await mapWithConcurrency(
      needsEnrichment,
      async (event) => {
        if (!isAllowedUrl(event.sourceUrl, 'meetup')) {
          log.warn({ url: event.sourceUrl }, 'Skipping disallowed URL');
          return;
        }

        try {
          const response = await axios.get(event.sourceUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.9',
            },
            timeout: 10000,
          });

          const html = response.data as string;
          const $ = cheerio.load(html);

          // Try __NEXT_DATA__ for description
          const scriptEl = $('script#__NEXT_DATA__');
          if (scriptEl.length) {
            try {
              const data = JSON.parse(scriptEl.text());
              const eventData = data?.props?.pageProps?.event;
              if (eventData?.description) {
                // Meetup descriptions are HTML — strip tags
                event.description = eventData.description
                  .replace(/<[^>]+>/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim()
                  .substring(0, 2000);
                enriched++;
                return;
              }
            } catch (err) {
              log.error({ err }, 'Error parsing detail __NEXT_DATA__');
            }
          }

          // Fallback: try meta description
          const metaDesc = $('meta[name="description"]').attr('content');
          if (metaDesc && metaDesc.length > 20) {
            event.description = metaDesc.trim().substring(0, 2000);
            enriched++;
          }
        } catch (err) {
          log.error({ err }, 'Error fetching detail page');
        }
      },
      { concurrency: 3, delayMs: 300 },
    );

    log.info({ enriched, total: events.length }, 'Enriched events with descriptions');
  }

  private mergeEvents(primary: RawEvent[], secondary: RawEvent[]): RawEvent[] {
    const byId = new Map<string, RawEvent>();

    // Primary (__NEXT_DATA__) takes precedence
    for (const evt of primary) {
      byId.set(evt.sourceId, evt);
    }

    // Add JSON-LD events not already present
    for (const evt of secondary) {
      if (!byId.has(evt.sourceId)) {
        byId.set(evt.sourceId, evt);
      }
    }

    return Array.from(byId.values());
  }
}
