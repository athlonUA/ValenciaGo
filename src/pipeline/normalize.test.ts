import { describe, test, expect } from 'vitest';
import { normalizeRawEvent } from './normalize.js';
import { EventCategory } from '../types/category.js';
import type { RawEvent } from '../types/event.js';

function makeRawEvent(overrides: Partial<RawEvent> = {}): RawEvent {
  return {
    sourceId: 'test-1',
    title: 'Concierto de Jazz en Valencia',
    description: '<p>Un gran concierto de jazz.</p>',
    startsAt: '2026-04-10T20:00:00+02:00',
    sourceUrl: 'https://example.com/event/1?utm_source=fb',
    venue: '  Palau de la Música  ',
    priceInfo: 'Gratis',
    ...overrides,
  };
}

describe('normalizeRawEvent', () => {
  test('normalizes title (strips HTML entities)', () => {
    const raw = makeRawEvent({ title: 'Rock &amp; Roll Night' });
    const result = normalizeRawEvent('test-source', raw);
    expect(result.title).toBe('Rock & Roll Night');
  });

  test('generates fingerprint from title', () => {
    const result = normalizeRawEvent('test-source', makeRawEvent());
    expect(result.titleNormalized).toBeTruthy();
    // Fingerprint should be lowercased, no accents, sorted
    expect(result.titleNormalized).not.toMatch(/[A-Z]/);
  });

  test('parses dates correctly', () => {
    const result = normalizeRawEvent('test-source', makeRawEvent());
    expect(result.startsAt).toBeInstanceOf(Date);
    expect(result.startsAt.toISOString()).toBe('2026-04-10T18:00:00.000Z');
  });

  test('detects free events', () => {
    const result = normalizeRawEvent('test-source', makeRawEvent({ priceInfo: 'Gratis' }));
    expect(result.isFree).toBe(true);
  });

  test('detects non-free events', () => {
    const result = normalizeRawEvent('test-source', makeRawEvent({ priceInfo: '€15' }));
    expect(result.isFree).toBe(false);
  });

  test('classifies category', () => {
    const result = normalizeRawEvent('test-source', makeRawEvent());
    // "concierto" and "jazz" are music keywords
    expect(result.category).toBe(EventCategory.MUSIC);
  });

  test('generates content hash', () => {
    const result = normalizeRawEvent('test-source', makeRawEvent());
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('strips HTML from description', () => {
    const result = normalizeRawEvent('test-source', makeRawEvent());
    expect(result.description).toBe('Un gran concierto de jazz.');
    expect(result.description).not.toContain('<p>');
  });

  test('sets city to Valencia', () => {
    const result = normalizeRawEvent('test-source', makeRawEvent());
    expect(result.city).toBe('Valencia');
  });

  test('normalizes source URL (removes tracking params)', () => {
    const result = normalizeRawEvent('test-source', makeRawEvent());
    expect(result.sourceUrl).not.toContain('utm_source');
    expect(result.sourceUrl).toContain('example.com/event/1');
  });

  test('trims venue name', () => {
    const result = normalizeRawEvent('test-source', makeRawEvent());
    expect(result.venue).toBe('Palau de la Música');
  });

  test('handles missing optional fields', () => {
    const raw = makeRawEvent({
      description: undefined,
      venue: undefined,
      priceInfo: undefined,
      endsAt: undefined,
    });
    const result = normalizeRawEvent('test-source', raw);
    expect(result.description).toBeUndefined();
    expect(result.venue).toBeUndefined();
    expect(result.endsAt).toBeUndefined();
    expect(result.isFree).toBe(false);
  });

  test('parses endsAt when provided', () => {
    const raw = makeRawEvent({ endsAt: '2026-04-10T23:00:00+02:00' });
    const result = normalizeRawEvent('test-source', raw);
    expect(result.endsAt).toBeInstanceOf(Date);
  });

  test('sets source correctly', () => {
    const result = normalizeRawEvent('eventbrite', makeRawEvent());
    expect(result.source).toBe('eventbrite');
  });

  test('defaults language to "es"', () => {
    const result = normalizeRawEvent('test-source', makeRawEvent());
    expect(result.language).toBe('es');
  });
});
