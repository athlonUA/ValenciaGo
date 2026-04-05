import cron from 'node-cron';
import type pg from 'pg';
import type { SourceAdapter } from '../types/index.js';
import { ingestAll } from '../pipeline/ingest.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('scheduler');

let isRunning = false;

export function startScheduler(
  pool: pg.Pool,
  adapters: SourceAdapter[],
  cronExpression: string,
): cron.ScheduledTask {
  log.info({ cronExpression }, 'Scheduler configured');

  const task = cron.schedule(cronExpression, async () => {
    if (isRunning) {
      log.warn('Previous ingestion still running, skipping this cycle');
      return;
    }
    isRunning = true;
    const start = Date.now();
    log.info('Scheduled ingestion started');
    try {
      await ingestAll(pool, adapters);
      // Archive old events (older than 1 year)
      try {
        const result = await pool.query('SELECT archive_old_events(365) AS count');
        const archived = result.rows[0]?.count ?? 0;
        if (archived > 0) {
          log.info({ archived }, 'Archived old events');
        }
      } catch (err) {
        log.error({ err }, 'Archival failed');
      }
      log.info({ durationSec: ((Date.now() - start) / 1000).toFixed(1) }, 'Scheduled ingestion finished');
    } catch (err) {
      log.error({ err }, 'Scheduled ingestion failed');
    } finally {
      isRunning = false;
    }
  });

  return task;
}
