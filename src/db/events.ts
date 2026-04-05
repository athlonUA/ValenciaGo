import type { Queryable } from './types.js';
import type { NormalizedEvent, StoredEvent } from '../types/index.js';
import { rowToStoredEvent } from './mapper.js';

// --- Upsert ---

export async function upsertEvent(pool: Queryable, event: NormalizedEvent): Promise<'inserted' | 'updated' | 'skipped'> {
  // Check for cross-source duplicate (same content_hash from a different source)
  const existing = await pool.query(
    'SELECT id FROM events WHERE content_hash = $1 AND NOT (source = $2 AND source_id = $3)',
    [event.contentHash, event.source, event.sourceId],
  );
  if (existing.rows.length > 0) return 'skipped';

  const result = await pool.query(
    `INSERT INTO events (
      source, source_id, source_url,
      title, title_normalized, description,
      category, tags, city, venue, address, latitude, longitude,
      starts_at, ends_at,
      price_info, is_free,
      language, image_url, raw_payload, content_hash,
      ingested_at
    ) VALUES (
      $1, $2, $3,
      $4, $5, $6,
      $7, $8, $9, $10, $11, $12, $13,
      $14, $15,
      $16, $17,
      $18, $19, $20, $21,
      NOW()
    )
    ON CONFLICT (source, source_id) DO UPDATE SET
      title = EXCLUDED.title,
      title_normalized = EXCLUDED.title_normalized,
      description = COALESCE(EXCLUDED.description, events.description),
      category = EXCLUDED.category,
      tags = EXCLUDED.tags,
      venue = COALESCE(EXCLUDED.venue, events.venue),
      address = COALESCE(EXCLUDED.address, events.address),
      starts_at = EXCLUDED.starts_at,
      ends_at = COALESCE(EXCLUDED.ends_at, events.ends_at),
      price_info = COALESCE(EXCLUDED.price_info, events.price_info),
      is_free = EXCLUDED.is_free,
      image_url = COALESCE(EXCLUDED.image_url, events.image_url),
      content_hash = EXCLUDED.content_hash,
      ai_time = CASE WHEN EXCLUDED.starts_at != events.starts_at THEN NULL ELSE events.ai_time END,
      updated_at = NOW(),
      ingested_at = NOW()
    RETURNING (xmax = 0) AS is_insert`,
    [
      event.source, event.sourceId, event.sourceUrl,
      event.title, event.titleNormalized, event.description,
      event.category, event.tags, event.city, event.venue, event.address, event.latitude, event.longitude,
      event.startsAt.toISOString(), event.endsAt?.toISOString() ?? null,
      event.priceInfo, event.isFree,
      event.language, event.imageUrl, event.rawPayload ? JSON.stringify(event.rawPayload) : null, event.contentHash,
    ],
  );

  if (result.rows.length === 0) return 'skipped';
  return result.rows[0].is_insert ? 'inserted' : 'updated';
}

export async function getEventById(pool: Queryable, id: string): Promise<StoredEvent | null> {
  const result = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
  return result.rows.length > 0 ? rowToStoredEvent(result.rows[0]) : null;
}

// --- Query functions ---

export async function getEventsInRange(
  pool: Queryable,
  from: Date,
  to: Date,
  opts?: { category?: string; isFree?: boolean; limit?: number; offset?: number },
): Promise<StoredEvent[]> {
  // Hide events that started more than 30 minutes ago
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const effectiveFrom = from.toISOString() > cutoff ? from.toISOString() : cutoff;

  const params: unknown[] = [effectiveFrom, to.toISOString()];
  let where = 'WHERE starts_at >= $1 AND starts_at < $2';
  let idx = 3;

  if (opts?.category) {
    where += ` AND category = $${idx++}`;
    params.push(opts.category);
  }
  if (opts?.isFree !== undefined) {
    where += ` AND is_free = $${idx++}`;
    params.push(opts.isFree);
  }

  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const result = await pool.query(
    `SELECT * FROM events ${where} ORDER BY starts_at ASC LIMIT $${idx++} OFFSET $${idx}`,
    [...params, limit, offset],
  );

  return result.rows.map(rowToStoredEvent);
}

export async function countEventsInRange(
  pool: Queryable,
  from: Date,
  to: Date,
  opts?: { category?: string; isFree?: boolean },
): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const effectiveFrom = from.toISOString() > cutoff ? from.toISOString() : cutoff;

  const params: unknown[] = [effectiveFrom, to.toISOString()];
  let where = 'WHERE starts_at >= $1 AND starts_at < $2';
  let idx = 3;

  if (opts?.category) {
    where += ` AND category = $${idx++}`;
    params.push(opts.category);
  }
  if (opts?.isFree !== undefined) {
    where += ` AND is_free = $${idx++}`;
    params.push(opts.isFree);
  }

  const result = await pool.query(`SELECT COUNT(*)::int AS count FROM events ${where}`, params);
  return result.rows[0].count;
}

// Shared WHERE clause for search queries (ILIKE + trigram + FTS)
// Similarity threshold 0.15: low enough to catch typos, high enough to avoid noise
const SEARCH_WHERE = `
  starts_at >= NOW()
  AND (
    title ILIKE $2
    OR summary ILIKE $2
    OR description ILIKE $2
    OR similarity(title, $1) > 0.15
    OR similarity(coalesce(summary, ''), $1) > 0.15
    OR to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(description, ''))
       @@ plainto_tsquery('simple', $1)
  )`;

/**
 * Smart search: combines ILIKE (partial, case-insensitive), trigram similarity,
 * and full-text search. Sorted by relevance.
 */
export async function searchEvents(
  pool: Queryable,
  query: string,
  opts?: { limit?: number; offset?: number },
): Promise<StoredEvent[]> {
  const limit = opts?.limit ?? 20;
  const offset = opts?.offset ?? 0;
  const pattern = `%${query}%`;

  const result = await pool.query(
    `SELECT *,
      GREATEST(
        similarity(title, $1),
        similarity(coalesce(summary, ''), $1)
      ) AS sim,
      ts_rank_cd(
        to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(description, '')),
        plainto_tsquery('simple', $1)
      ) AS fts_rank
    FROM events
    WHERE ${SEARCH_WHERE}
    ORDER BY sim DESC, fts_rank DESC, starts_at ASC
    LIMIT $3 OFFSET $4`,
    [query, pattern, limit, offset],
  );

  return result.rows.map(rowToStoredEvent);
}

export async function countSearchEvents(pool: Queryable, query: string): Promise<number> {
  const pattern = `%${query}%`;
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM events WHERE ${SEARCH_WHERE}`,
    [query, pattern],
  );
  return result.rows[0].count;
}

export async function getEventStats(pool: Queryable): Promise<{
  total: number;
  upcoming: number;
  sources: Array<{ source: string; count: number }>;
  categories: Array<{ category: string; count: number }>;
}> {
  const [totalRes, upcomingRes, sourcesRes, categoriesRes] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM events'),
    pool.query('SELECT COUNT(*)::int AS count FROM events WHERE starts_at >= NOW()'),
    pool.query('SELECT source, COUNT(*)::int AS count FROM events GROUP BY source ORDER BY count DESC'),
    pool.query('SELECT category, COUNT(*)::int AS count FROM events WHERE starts_at >= NOW() GROUP BY category ORDER BY count DESC'),
  ]);

  return {
    total: totalRes.rows[0].count,
    upcoming: upcomingRes.rows[0].count,
    sources: sourcesRes.rows,
    categories: categoriesRes.rows,
  };
}
