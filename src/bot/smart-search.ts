import OpenAI from 'openai';
import type pg from 'pg';
import type { StoredEvent } from '../types/index.js';
import { rowToStoredEvent } from '../db/queries.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('smart-search');

// Cache search results for pagination (TTL: 10 minutes)
const searchCache = new Map<string, { ids: string[]; ts: number }>();
// 10-minute TTL: long enough for pagination, short enough for fresh results
const CACHE_TTL = 10 * 60 * 1000;

let cacheCounter = 0;

// Periodic cleanup of expired cache entries (every 60s)
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of searchCache) {
    if (now - val.ts > CACHE_TTL) searchCache.delete(key);
  }
}, 60_000).unref();

export function cacheResults(ids: string[]): string {
  // Clean old entries
  const now = Date.now();
  for (const [key, val] of searchCache) {
    if (now - val.ts > CACHE_TTL) searchCache.delete(key);
  }
  const key = `s${++cacheCounter}`;
  searchCache.set(key, { ids, ts: now });
  return key;
}

export function getCachedIds(key: string): string[] | null {
  const entry = searchCache.get(key);
  if (!entry || Date.now() - entry.ts > CACHE_TTL) return null;
  return entry.ids;
}

/** Sanitize user input before embedding in LLM prompt to reduce injection risk */
function sanitizeForLLM(input: string): string {
  return input
    .replace(/[\r\n]+/g, ' ')          // Collapse newlines (prevents role injection)
    .replace(/[^\p{L}\p{N}\s.,!?'"()-]/gu, '') // Strip control chars, keep letters/numbers/punctuation
    .trim()
    .substring(0, 200);
}

/**
 * Semantic search: sends user query + all upcoming event summaries to GPT-4o-mini,
 * which returns line numbers of matching events ranked by relevance.
 */
export async function semanticSearch(
  pool: pg.Pool,
  apiKey: string,
  userMessage: string,
): Promise<StoredEvent[]> {
  // Fetch all upcoming events (title + summary only)
  const { rows } = await pool.query(
    `SELECT id, title, summary, category FROM events
     WHERE starts_at >= NOW() - interval '30 minutes'
     ORDER BY starts_at ASC
     LIMIT 300`,
  );

  if (rows.length === 0) return [];

  // Build compact numbered list
  const eventList = rows.map((e, i) =>
    `${i + 1}. ${e.title}${e.summary ? ' — ' + e.summary : ''}`
  ).join('\n');

  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    max_tokens: 300,
    messages: [
      {
        role: 'system',
        content: `You are an event search assistant. The user describes what they want. Match their request against the numbered event list.

Return ONLY the matching line numbers separated by commas. Most relevant first. Max 15.
Example: 3,7,12,45

If nothing matches, return: NONE

Be generous — include partially relevant events too. Understand queries in ANY language.`,
      },
      {
        role: 'user',
        content: `Query: "${sanitizeForLLM(userMessage)}"\n\nEvents:\n${eventList}`,
      },
    ],
  });

  const text = response.choices[0]?.message?.content?.trim() ?? '';
  log.info({ response: text }, 'GPT response');

  if (text === 'NONE' || !text) return [];

  // Parse line numbers
  const numbers = text.match(/\d+/g);
  if (!numbers) return [];

  const matchedIds: string[] = [];
  for (const num of numbers) {
    const idx = parseInt(num, 10) - 1; // 1-based to 0-based
    if (idx >= 0 && idx < rows.length) {
      matchedIds.push(rows[idx].id);
    }
  }

  if (matchedIds.length === 0) return [];

  // Fetch full event data, preserving LLM ranking
  const placeholders = matchedIds.map((_, i) => `$${i + 1}`).join(',');
  const result = await pool.query(
    `SELECT * FROM events WHERE id IN (${placeholders})`,
    matchedIds,
  );

  const eventMap = new Map(result.rows.map(r => [r.id, r]));
  const ordered: StoredEvent[] = [];
  for (const id of matchedIds) {
    const row = eventMap.get(id);
    if (row) ordered.push(rowToStoredEvent(row));
  }

  return ordered;
}
