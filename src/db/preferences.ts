import type { Queryable } from './types.js';
import type { StoredEvent } from '../types/index.js';
import { rowToStoredEvent } from './mapper.js';

// --- Liked events ---

export async function likeEvent(pool: Queryable, userId: number, eventId: string): Promise<void> {
  await pool.query(
    'INSERT INTO liked_events (user_id, event_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [userId, eventId],
  );
}

export async function unlikeEvent(pool: Queryable, userId: number, eventId: string): Promise<void> {
  await pool.query('DELETE FROM liked_events WHERE user_id = $1 AND event_id = $2', [userId, eventId]);
}

export async function getLikedEventsPaginated(
  pool: Queryable, userId: number, limit: number, offset: number,
): Promise<StoredEvent[]> {
  const result = await pool.query(
    `SELECT e.* FROM events e
     JOIN liked_events l ON e.id = l.event_id
     WHERE l.user_id = $1
     ORDER BY e.starts_at ASC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );
  return result.rows.map(rowToStoredEvent);
}

export async function countLikedEvents(pool: Queryable, userId: number): Promise<number> {
  const result = await pool.query(
    'SELECT COUNT(*)::int AS count FROM liked_events WHERE user_id = $1',
    [userId],
  );
  return result.rows[0].count;
}

export async function isEventLiked(pool: Queryable, userId: number, eventId: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT 1 FROM liked_events WHERE user_id = $1 AND event_id = $2',
    [userId, eventId],
  );
  return (result.rowCount ?? 0) > 0;
}

// --- User settings ---

export async function getUserLocale(pool: Queryable, userId: number): Promise<string | null> {
  const result = await pool.query(
    'SELECT locale FROM user_settings WHERE user_id = $1',
    [userId],
  );
  return result.rows[0]?.locale ?? null;
}

export async function setUserLocale(pool: Queryable, userId: number, locale: string): Promise<void> {
  await pool.query(
    `INSERT INTO user_settings (user_id, locale) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET locale = $2, updated_at = NOW()`,
    [userId, locale],
  );
}

/** Delete all data associated with a user (GDPR compliance) */
export async function deleteUserData(pool: Queryable, userId: number): Promise<number> {
  await pool.query('DELETE FROM user_settings WHERE user_id = $1', [userId]);
  const result = await pool.query(
    'DELETE FROM liked_events WHERE user_id = $1',
    [userId],
  );
  return result.rowCount ?? 0;
}
