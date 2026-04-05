import axios from 'axios';
import type { SourceAdapter, RawEvent } from '../types/index.js';
import { isAllowedUrl } from '../utils/url.js';
import { mapWithConcurrency } from '../utils/concurrency.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('eventbrite');

const SEARCH_URL = 'https://www.eventbriteapi.com/v3/destination/search/';

// Valencia bounding box
const VALENCIA_BBOX = {
  top: 39.55,
  bottom: 39.35,
  left: -0.50,
  right: -0.25,
};

const MAX_PAGES = 5;

interface EBEvent {
  id: number;
  name: string;
  url: string;
  start_date: string;
  end_date?: string;
  summary?: string;
  is_online_event?: boolean;
  image?: { url?: string };
  primary_venue?: {
    name?: string;
    address?: {
      city?: string;
      country?: string;
      longitude?: string;
      latitude?: string;
      localized_address_display?: string;
    };
  };
  primary_organizer?: {
    name?: string;
  };
  ticket_availability?: {
    is_free?: boolean;
    minimum_ticket_price?: { display?: string; major_value?: string };
    maximum_ticket_price?: { display?: string; major_value?: string };
  };
  tags?: Array<{ display_name?: string; prefix?: string }>;
}

/**
 * Eventbrite adapter using the destination/search API.
 * Requires EVENTBRITE_TOKEN (Private token from Eventbrite dashboard).
 */
export class EventbriteAdapter implements SourceAdapter {
  readonly name = 'eventbrite';
  readonly enabled: boolean;
  private token: string;

  constructor(token?: string) {
    this.token = token || '';
    this.enabled = !!this.token;
    if (!this.enabled) {
      log.info('No API token set, adapter disabled');
    }
  }

  async fetchEvents(): Promise<RawEvent[]> {
    if (!this.enabled) return [];

    log.info('Fetching events via destination/search API');
    const events: RawEvent[] = [];
    let continuation: string | undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      try {
        const body: Record<string, unknown> = {
          event_search: {
            dates: 'current_future',
            bbox: VALENCIA_BBOX,
          },
          'expand.destination_event': [
            'primary_venue',
            'ticket_availability',
            'primary_organizer',
            'image',
          ],
        };

        if (continuation) {
          (body.event_search as Record<string, unknown>).continuation = continuation;
        }

        const response = await axios.post(SEARCH_URL, body, {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        });

        const data = response.data;
        const results = data?.events?.results as EBEvent[] | undefined;
        if (!results || results.length === 0) break;

        for (const evt of results) {
          events.push(this.toRawEvent(evt));
        }

        // Pagination
        continuation = data?.events?.pagination?.continuation;
        if (!continuation) break;

        log.info({ page: page + 1, pageResults: results.length, total: events.length }, 'Page fetched');
      } catch (err) {
        if (axios.isAxiosError(err)) {
          log.error({ status: err.response?.status }, 'API error');
        } else {
          log.error({ err }, 'Fetch error');
        }
        break;
      }
    }

    log.info({ count: events.length }, 'Fetched events, enriching with details');
    await this.enrichWithDetails(events);
    return events;
  }

  /** Fetch individual event details for accurate start time and description */
  private async enrichWithDetails(events: RawEvent[]): Promise<void> {
    let enriched = 0;

    await mapWithConcurrency(
      events,
      async (event) => {
        const detailUrl = `https://www.eventbriteapi.com/v3/events/${event.sourceId}/`;
        if (!isAllowedUrl(detailUrl, 'eventbrite')) {
          log.warn({ url: detailUrl }, 'Skipping disallowed URL');
          return;
        }

        try {
          const response = await axios.get(detailUrl, {
            headers: { Authorization: `Bearer ${this.token}` },
            params: { expand: 'description' },
            timeout: 10000,
          });

          const detail = response.data;

          // Fix start/end times — use UTC for unambiguous parsing
          if (detail.start?.utc) {
            event.startsAt = detail.start.utc;
          }
          if (detail.end?.utc) {
            event.endsAt = detail.end.utc;
          }

          // Get full description
          const descText = detail.description?.text || detail.summary?.text;
          if (descText && descText.length > (event.description?.length ?? 0)) {
            event.description = descText.substring(0, 2000);
          }

          enriched++;
        } catch (err) {
          log.error({ err }, 'Error fetching event detail');
        }
      },
      { concurrency: 5, delayMs: 100 },
    );

    log.info({ enriched, total: events.length }, 'Enrichment complete');
  }

  private toRawEvent(evt: EBEvent): RawEvent {
    const venue = evt.primary_venue;
    const tickets = evt.ticket_availability;

    let priceInfo: string | undefined;
    if (tickets?.is_free) {
      priceInfo = 'Free';
    } else if (tickets?.minimum_ticket_price) {
      const min = tickets.minimum_ticket_price.major_value;
      const max = tickets.maximum_ticket_price?.major_value;
      priceInfo = min === max || !max ? `€${min}` : `€${min}–€${max}`;
    }

    const tagNames = (evt.tags ?? [])
      .filter(t => t.prefix === 'EventbriteCategory' || t.prefix === 'EventbriteSubCategory')
      .map(t => t.display_name)
      .filter(Boolean);

    return {
      sourceId: String(evt.id),
      title: evt.name,
      description: evt.summary || undefined,
      startsAt: evt.start_date ? `${evt.start_date}T00:00:00+02:00` : '',
      endsAt: evt.end_date ? `${evt.end_date}T23:59:00+02:00` : undefined,
      venue: venue?.name || (evt.is_online_event ? 'Online' : undefined),
      address: venue?.address?.localized_address_display || undefined,
      latitude: venue?.address?.latitude ? parseFloat(venue.address.latitude) : undefined,
      longitude: venue?.address?.longitude ? parseFloat(venue.address.longitude) : undefined,
      sourceUrl: evt.url,
      imageUrl: evt.image?.url || undefined,
      priceInfo,
      language: 'es',
      rawPayload: {
        organizer: evt.primary_organizer?.name,
        tags: tagNames,
        isFree: tickets?.is_free,
      },
    };
  }
}
