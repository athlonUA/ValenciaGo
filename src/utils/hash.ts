import crypto from 'node:crypto';

/**
 * Generate a deterministic content hash for deduplication.
 * Same event from different sources should produce the same hash
 * if they have the same normalized title, start date, and city.
 */
export function computeContentHash(
  titleNormalized: string,
  startsAt: Date,
  city: string = 'Valencia',
): string {
  const dateStr = startsAt.toISOString().substring(0, 10); // YYYY-MM-DD
  const payload = [titleNormalized, dateStr, city.toLowerCase()].join('|');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Jaccard similarity between two sets of words.
 * Returns a value between 0.0 (completely different) and 1.0 (identical).
 */
export function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(' ').filter(Boolean));
  const setB = new Set(b.split(' ').filter(Boolean));

  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0.0;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return intersection / union;
}
