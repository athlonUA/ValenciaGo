/**
 * CLI script to manually trigger ingestion.
 * Usage: npm run ingest
 */
import { createLogger } from '../utils/logger.js';
import { loadConfig } from '../config.js';
import { getPool, closePool } from '../db/pool.js';
import { createAdapters } from '../adapters/registry.js';
import { ingestAll } from '../pipeline/ingest.js';

const log = createLogger('cli');

async function main() {
  const config = loadConfig();
  const pool = getPool(config.databaseUrl);

  const adapters = createAdapters({ eventbriteToken: config.eventbriteToken });

  try {
    const results = await ingestAll(pool, adapters);

    log.info('Ingestion Summary');
    for (const r of results) {
      log.info({
        source: r.source,
        fetched: r.fetched,
        inserted: r.inserted,
        updated: r.updated,
        errors: r.errors.length,
      }, 'Source result');
    }
  } finally {
    await closePool();
  }
}

main().catch(err => {
  log.error({ err }, 'Ingestion failed');
  process.exit(1);
});
