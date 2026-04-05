import { describe, test, expect } from 'vitest';
import { computeContentHash, jaccardSimilarity } from './hash.js';

describe('computeContentHash', () => {
  test('is deterministic: same inputs produce same hash', () => {
    const date = new Date('2026-04-05T14:00:00Z');
    const hash1 = computeContentHash('concierto jazz', date, 'Valencia');
    const hash2 = computeContentHash('concierto jazz', date, 'Valencia');
    expect(hash1).toBe(hash2);
  });

  test('different inputs produce different hashes', () => {
    const date = new Date('2026-04-05T14:00:00Z');
    const hash1 = computeContentHash('concierto jazz', date, 'Valencia');
    const hash2 = computeContentHash('concierto rock', date, 'Valencia');
    expect(hash1).not.toBe(hash2);
  });

  test('only uses date portion (same day, different time → same hash)', () => {
    const date1 = new Date('2026-04-05T10:00:00Z');
    const date2 = new Date('2026-04-05T20:00:00Z');
    const hash1 = computeContentHash('event title', date1);
    const hash2 = computeContentHash('event title', date2);
    expect(hash1).toBe(hash2);
  });

  test('defaults city to Valencia', () => {
    const date = new Date('2026-04-05T14:00:00Z');
    const hashExplicit = computeContentHash('test', date, 'Valencia');
    const hashDefault = computeContentHash('test', date);
    expect(hashExplicit).toBe(hashDefault);
  });

  test('returns a 64-char hex string (SHA-256)', () => {
    const hash = computeContentHash('test', new Date());
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('jaccardSimilarity', () => {
  test('identical strings return 1.0', () => {
    expect(jaccardSimilarity('hello world', 'hello world')).toBe(1.0);
  });

  test('completely different strings return 0.0', () => {
    expect(jaccardSimilarity('hello world', 'foo bar')).toBe(0.0);
  });

  test('partial overlap returns correct ratio', () => {
    // {hello, world} ∩ {hello, foo} = {hello} → 1/3
    expect(jaccardSimilarity('hello world', 'hello foo')).toBeCloseTo(1 / 3);
  });

  test('both empty returns 1.0', () => {
    expect(jaccardSimilarity('', '')).toBe(1.0);
  });

  test('one empty returns 0.0', () => {
    expect(jaccardSimilarity('hello', '')).toBe(0.0);
    expect(jaccardSimilarity('', 'hello')).toBe(0.0);
  });

  test('order does not matter', () => {
    expect(jaccardSimilarity('a b c', 'c b a')).toBe(1.0);
  });
});
