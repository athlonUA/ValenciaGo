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

/** @deprecated Use getLikedEventsPaginated + countLikedEvents for paginated access */
export async function getLikedEvents(pool: Queryable, userId: number): Promise<StoredEvent[]> {
  const result = await pool.query(
    `SELECT e.* FROM events e
     JOIN liked_events l ON e.id = l.event_id
     WHERE l.user_id = $1
     ORDER BY e.starts_at ASC`,
    [userId],
  );
  return result.rows.map(rowToStoredEvent);
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

/** Delete all data associated with a user (GDPR compliance) */
export async function deleteUserData(pool: Queryable, userId: number): Promise<number> {
  const result = await pool.query(
    'DELETE FROM liked_events WHERE user_id = $1',
    [userId],
  );
  return result.rowCount ?? 0;
}
