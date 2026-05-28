import axios from 'axios';
import type { SourceAdapter, RawEvent } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('meetup');

const GQL_URL = 'https://www.meetup.com/gql2';
const PAGE_SIZE = 200;
const MAX_EVENTS = 2000;

const SEARCH_QUERIES = ['valencia', 'meetup', 'events'];

const SEARCH_QUERY = `
query($query: String!, $lat: Float!, $lon: Float!, $radius: Float!, $after: String) {
  eventSearch(
    filter: { query: $query, lat: $lat, lon: $lon, radius: $radius }
    first: ${PAGE_SIZE}
    after: $after
  ) {
    edges { node {
      id title dateTime endTime eventUrl description isOnline
      group { id name urlname }
      venue { id name lat lon address city state country }
      feeSettings { amount currency }
      going { totalCount }
      featuredEventPhoto { highResUrl }
    } cursor }
    pageInfo { hasNextPage endCursor }
  }
}
`;

interface GqlEvent {
  id: string;
  title: string;
  dateTime: string;
  endTime: string | null;
  eventUrl: string;
  description: string | null;
  isOnline: boolean;
  group: { id: string; name: string; urlname: string } | null;
  venue: {
    id: string;
    name: string;
    lat: number;
    lon: number;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
  } | null;
  feeSettings: { amount: number; currency: string } | null;
  going: { totalCount: number } | null;
  featuredEventPhoto: { highResUrl: string | null } | null;
}

export class MeetupAdapter implements SourceAdapter {
  readonly name = 'meetup';
  readonly enabled = true;

  async fetchEvents(): Promise<RawEvent[]> {
    const byId = new Map<string, RawEvent>();

    for (const query of SEARCH_QUERIES) {
      if (byId.size >= MAX_EVENTS) break;
      await this.fetchAllPages(query, byId);
    }

    const events = Array.from(byId.values());
    log.info({ count: events.length }, 'Fetched events');
    return events;
  }

  private async fetchAllPages(query: string, byId: Map<string, RawEvent>): Promise<void> {
    let cursor: string | undefined;

    while (byId.size < MAX_EVENTS) {
      const { page, pageInfo } = await this.fetchPage(query, cursor);
      if (page.length === 0) break;

      for (const evt of page) {
        if (!byId.has(evt.sourceId)) byId.set(evt.sourceId, evt);
      }
      log.info({ query, fetched: page.length, total: byId.size }, 'Page fetched');

      if (!pageInfo?.hasNextPage || !pageInfo.endCursor) break;
      cursor = pageInfo.endCursor;
    }
  }

  private async fetchPage(query: string, after?: string): Promise<{
    page: RawEvent[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null } | null;
  }> {
    try {
      const response = await axios.post(GQL_URL, {
        query: SEARCH_QUERY,
        variables: { query, lat: 39.47, lon: -0.38, radius: 25, after: after ?? null },
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 20000,
      });

      if (response.data?.errors) {
        log.error({ errors: response.data.errors, query }, 'GraphQL errors');
        return { page: [], pageInfo: null };
      }

      const search = response.data?.data?.eventSearch;
      const edges: Array<{ node: GqlEvent }> = search?.edges ?? [];
      const pageInfo = search?.pageInfo ?? null;

      const page: RawEvent[] = [];
      for (const edge of edges) {
        const evt = edge.node;
        if (!evt.id) continue;
        page.push(this.toRawEvent(evt));
      }
      return { page, pageInfo };
    } catch (err) {
      log.error({ err, query }, 'GraphQL request failed');
      return { page: [], pageInfo: null };
    }
  }

  private toRawEvent(evt: GqlEvent): RawEvent {
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
      longitude = evt.venue.lon;
    }

    if (evt.isOnline) {
      venue = 'Online';
    }

    return {
      sourceId: evt.id,
      title: evt.title,
      description: evt.description
        ? evt.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000) || undefined
        : undefined,
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
      },
    };
  }
}
