/**
 * Process items with limited concurrency and a delay between batches.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  opts: { concurrency?: number; delayMs?: number } = {},
): Promise<R[]> {
  const { concurrency = 5, delayMs = 100 } = opts;
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<R>).value));
    if (i + concurrency < items.length && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return results;
}
