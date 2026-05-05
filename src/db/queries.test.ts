import { describe, test, expect, vi } from 'vitest';
import { rowToStoredEvent } from './queries.js';
import {
  upsertEvent,
  getEventById,
  getEventsInRange,
  countEventsInRange,
  searchEvents,
  countSearchEvents,
  getEventStats,
  likeEvent,
  unlikeEvent,
  getLikedEventsPaginated,
  countLikedEvents,
  isEventLiked,
  deleteUserData,
} from './queries.js';
import type { Queryable } from './types.js';

describe('barrel re-exports', () => {
  test('all query functions are accessible via queries.js barrel', () => {
    expect(typeof rowToStoredEvent).toBe('function');
    expect(typeof upsertEvent).toBe('function');
    expect(typeof getEventById).toBe('function');
    expect(typeof getEventsInRange).toBe('function');
    expect(typeof countEventsInRange).toBe('function');
    expect(typeof searchEvents).toBe('function');
    expect(typeof countSearchEvents).toBe('function');
    expect(typeof getEventStats).toBe('function');
    expect(typeof likeEvent).toBe('function');
    expect(typeof unlikeEvent).toBe('function');
    expect(typeof getLikedEventsPaginated).toBe('function');
    expect(typeof countLikedEvents).toBe('function');
    expect(typeof isEventLiked).toBe('function');
    expect(typeof deleteUserData).toBe('function');
  });
});

describe('rowToStoredEvent', () => {
  const sampleRow = {
    id: 'test-uuid',
    source: 'meetup',
    source_id: 'evt-123',
    source_url: 'https://meetup.com/events/123',
    title: 'Jazz Night',
    title_normalized: 'jazz night',
    description: 'A great jazz event',
    category: 'music',
    tags: ['music', 'jazz'],
    city: 'Valencia',
    venue: 'La Rambleta',
    address: 'Blvd Sur',
    latitude: 39.45,
    longitude: -0.38,
    starts_at: '2026-04-10T20:00:00Z',
    ends_at: '2026-04-10T23:00:00Z',
    price_info: '€10',
    is_free: false,
    language: 'en',
    image_url: 'https://example.com/img.jpg',
    raw_payload: { key: 'value' },
    content_hash: 'abc123',
    summary: 'Great jazz show',
    emoji: '🎷',
    ai_price: '€10',
    ai_time: '20:00',
    created_at: '2026-04-01T10:00:00Z',
    updated_at: '2026-04-01T10:00:00Z',
    ingested_at: '2026-04-01T10:00:00Z',
  };

  test('maps all fields correctly', () => {
    const event = rowToStoredEvent(sampleRow);
    expect(event.id).toBe('test-uuid');
    expect(event.source).toBe('meetup');
    expect(event.sourceId).toBe('evt-123');
    expect(event.title).toBe('Jazz Night');
    expect(event.category).toBe('music');
    expect(event.tags).toEqual(['music', 'jazz']);
    expect(event.isFree).toBe(false);
    expect(event.latitude).toBe(39.45);
    expect(event.startsAt).toBeInstanceOf(Date);
    expect(event.endsAt).toBeInstanceOf(Date);
    expect(event.summary).toBe('Great jazz show');
    expect(event.emoji).toBe('🎷');
  });

  test('handles null optional fields', () => {
    const row = { ...sampleRow, description: null, venue: null, ends_at: null, summary: null, emoji: null, ai_price: null, ai_time: null, latitude: null, longitude: null, image_url: null, raw_payload: null };
    const event = rowToStoredEvent(row);
    // Mapper casts null as the typed value; endsAt/latitude use conditional so they become undefined
    expect(event.description).toBeNull();
    expect(event.venue).toBeNull();
    expect(event.endsAt).toBeUndefined();
    expect(event.latitude).toBeUndefined();
  });

  test('defaults language to es', () => {
    const row = { ...sampleRow, language: null };
    const event = rowToStoredEvent(row);
    expect(event.language).toBe('es');
  });

  test('defaults tags to empty array', () => {
    const row = { ...sampleRow, tags: null };
    const event = rowToStoredEvent(row);
    expect(event.tags).toEqual([]);
  });
});

// --- SQL construction tests (regression guards for pagination + visibility filter) ---
//
// These don't hit a real DB. They capture the SQL string passed to pool.query and
// assert it contains the structural pieces that fix two production bugs:
//   - duplicate event across pagination pages → ORDER BY needs an `id ASC` tiebreaker
//   - Friday-night events leaking into /weekend → multi-day branch needs a 24h floor

const fakePool = (rows: unknown[] = []): Queryable =>
  ({ query: vi.fn(async () => ({ rows })) }) as unknown as Queryable;

const lastSql = (pool: Queryable): string =>
  (pool.query as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;

describe('getEventsInRange query construction', () => {
  test('orders by starts_at ASC then id ASC for deterministic pagination', async () => {
    const pool = fakePool();
    await getEventsInRange(pool, new Date('2026-05-09'), new Date('2026-05-10'));
    expect(lastSql(pool)).toMatch(/ORDER BY starts_at ASC, id ASC/);
  });

  test('multi-day branch requires duration between 24 hours and 14 days', async () => {
    const pool = fakePool();
    await getEventsInRange(pool, new Date('2026-05-09'), new Date('2026-05-10'));
    const sql = lastSql(pool);
    expect(sql).toMatch(/ends_at\s*-\s*starts_at\s*>=\s*INTERVAL\s*'24 hours'/);
    expect(sql).toMatch(/ends_at\s*-\s*starts_at\s*<=\s*INTERVAL\s*'14 days'/);
  });
});

describe('countEventsInRange query construction', () => {
  test('uses identical multi-day filter as getEventsInRange', async () => {
    const pool = fakePool([{ count: 0 }]);
    await countEventsInRange(pool, new Date('2026-05-09'), new Date('2026-05-10'));
    const sql = lastSql(pool);
    expect(sql).toMatch(/ends_at\s*-\s*starts_at\s*>=\s*INTERVAL\s*'24 hours'/);
    expect(sql).toMatch(/ends_at\s*-\s*starts_at\s*<=\s*INTERVAL\s*'14 days'/);
  });
});

describe('searchEvents query construction', () => {
  test('orders by relevance then id ASC for deterministic pagination', async () => {
    const pool = fakePool();
    await searchEvents(pool, 'jazz');
    expect(lastSql(pool)).toMatch(/ORDER BY sim DESC, fts_rank DESC, starts_at ASC, id ASC/);
  });
});
