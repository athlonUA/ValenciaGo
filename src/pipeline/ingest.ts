import type pg from 'pg';
import type { SourceAdapter, IngestResult } from '../types/index.js';
import { normalizeRawEvent } from './normalize.js';
import { upsertEvent } from '../db/queries.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('ingest');

/**
 * Run ingestion for a single source adapter.
 * Flow: fetch -> normalize -> upsert (inside a transaction)
 */
export async function ingestFromSource(
  pool: pg.Pool,
  adapter: SourceAdapter,
): Promise<IngestResult> {
  const result: IngestResult = {
    source: adapter.name,
    fetched: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  let rawEvents;
  try {
    rawEvents = await adapter.fetchEvents();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err, source: adapter.name }, 'Fetch failed');
    result.errors.push({ sourceId: '*', error: message });
    return result;
  }

  result.fetched = rawEvents.length;
  log.info({ source: adapter.name, count: rawEvents.length }, 'Fetched events');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const raw of rawEvents) {
      try {
        await client.query('SAVEPOINT ev');
        const normalized = normalizeRawEvent(adapter.name, raw);
        const action = await upsertEvent(client, normalized);
        await client.query('RELEASE SAVEPOINT ev');

        switch (action) {
          case 'inserted': result.inserted++; break;
          case 'updated': result.updated++; break;
          case 'skipped': result.skipped++; break;
        }
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT ev');
        const message = err instanceof Error ? err.message : String(err);
        log.error({ err, source: adapter.name, sourceId: raw.sourceId }, 'Error processing event');
        result.errors.push({ sourceId: raw.sourceId, error: message });
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  log.info({
    source: adapter.name,
    inserted: result.inserted,
    updated: result.updated,
    skipped: result.skipped,
    errors: result.errors.length,
  }, 'Ingestion complete for source');

  return result;
}

/**
 * Run ingestion for all enabled adapters in parallel.
 */
export async function ingestAll(
  pool: pg.Pool,
  adapters: SourceAdapter[],
): Promise<IngestResult[]> {
  const enabled = adapters.filter(a => a.enabled);
  log.info({ sourceCount: enabled.length }, 'Starting ingestion');

  const settled = await Promise.allSettled(
    enabled.map(adapter => ingestFromSource(pool, adapter)),
  );

  const results: IngestResult[] = settled.map((outcome, i) => {
    if (outcome.status === 'fulfilled') {
      return outcome.value;
    }
    log.error({ err: outcome.reason, source: enabled[i].name }, 'Ingestion failed');
    return {
      source: enabled[i].name,
      fetched: 0, inserted: 0, updated: 0, skipped: 0,
      errors: [{ sourceId: '*', error: String(outcome.reason) }],
    };
  });

  const totals = results.reduce(
    (acc, r) => ({
      fetched: acc.fetched + r.fetched,
      inserted: acc.inserted + r.inserted,
      updated: acc.updated + r.updated,
    }),
    { fetched: 0, inserted: 0, updated: 0 },
  );
  log.info({
    fetched: totals.fetched,
    inserted: totals.inserted,
    updated: totals.updated,
  }, 'Ingestion complete');

  return results;
}
