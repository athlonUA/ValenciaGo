import { describe, test, expect, vi, beforeEach } from 'vitest';
import { cacheResults, getCachedIds } from './smart-search.js';

describe('smart-search cache', () => {
  test('cacheResults returns a key starting with "s"', () => {
    const key = cacheResults(['id-1', 'id-2']);
    expect(key).toMatch(/^s\d+$/);
  });

  test('getCachedIds returns ids for a valid key', () => {
    const ids = ['id-a', 'id-b', 'id-c'];
    const key = cacheResults(ids);
    const result = getCachedIds(key);
    expect(result).toEqual(ids);
  });

  test('getCachedIds returns null for unknown key', () => {
    const result = getCachedIds('s999999');
    expect(result).toBeNull();
  });

  test('cache entries expire after TTL', () => {
    const ids = ['id-expire'];
    const key = cacheResults(ids);

    // Advance time past the 10-minute TTL
    vi.useFakeTimers();
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);

    const result = getCachedIds(key);
    expect(result).toBeNull();

    vi.useRealTimers();
  });

  test('multiple cache entries are independent', () => {
    const key1 = cacheResults(['a']);
    const key2 = cacheResults(['b']);
    expect(key1).not.toBe(key2);
    expect(getCachedIds(key1)).toEqual(['a']);
    expect(getCachedIds(key2)).toEqual(['b']);
  });
});
