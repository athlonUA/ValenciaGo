import { describe, test, expect } from 'vitest';
import { mapWithConcurrency } from './concurrency.js';

describe('mapWithConcurrency', () => {
  test('processes all items', async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await mapWithConcurrency(items, async (x) => x * 2, { delayMs: 0 });
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  test('returns empty array for empty input', async () => {
    const results = await mapWithConcurrency([], async (x) => x, { delayMs: 0 });
    expect(results).toEqual([]);
  });

  test('respects concurrency limit via batch tracking', async () => {
    let maxConcurrent = 0;
    let running = 0;

    const items = [1, 2, 3, 4, 5, 6];
    await mapWithConcurrency(
      items,
      async (x) => {
        running++;
        if (running > maxConcurrent) maxConcurrent = running;
        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 10));
        running--;
        return x;
      },
      { concurrency: 2, delayMs: 0 },
    );

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  test('handles errors in individual items gracefully', async () => {
    const items = [1, 2, 3];
    const results = await mapWithConcurrency(
      items,
      async (x) => {
        if (x === 2) throw new Error('fail');
        return x * 10;
      },
      { concurrency: 5, delayMs: 0 },
    );
    // Item 2 fails, so only items 1 and 3 appear in results
    expect(results).toEqual([10, 30]);
  });

  test('preserves order within batches', async () => {
    const items = ['a', 'b', 'c', 'd'];
    const results = await mapWithConcurrency(
      items,
      async (x) => x.toUpperCase(),
      { concurrency: 2, delayMs: 0 },
    );
    expect(results).toEqual(['A', 'B', 'C', 'D']);
  });

  test('uses default concurrency and delay when not specified', async () => {
    const items = [1, 2];
    const results = await mapWithConcurrency(items, async (x) => x + 1);
    expect(results).toEqual([2, 3]);
  });

  test('single item processes correctly', async () => {
    const results = await mapWithConcurrency([42], async (x) => x, { delayMs: 0 });
    expect(results).toEqual([42]);
  });
});
