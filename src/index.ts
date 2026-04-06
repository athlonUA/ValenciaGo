import { createLogger } from './utils/logger.js';
import { loadConfig } from './config.js';
import { getPool, closePool } from './db/pool.js';
import { createAdapters } from './adapters/registry.js';
import { ingestAll } from './pipeline/ingest.js';
import { createBot } from './bot/bot.js';
import { startScheduler } from './scheduler/cron.js';

const log = createLogger('app');

async function main() {
  log.info('Valencia Events — starting...');

  const config = loadConfig();
  const pool = getPool(config.databaseUrl);

  // Verify database connection
  try {
    await pool.query('SELECT 1');
    log.info('Database connected');
  } catch (err) {
    log.error({ err }, 'Database connection failed');
    log.error('Make sure PostgreSQL is running: docker compose up -d');
    process.exit(1);
  }

  // Run migrations
  try {
    const { runner } = await import('node-pg-migrate');
    await runner({
      databaseUrl: config.databaseUrl,
      dir: 'migrations',
      direction: 'up',
      migrationsTable: 'pgmigrations',
      log: () => {},
    });
    log.info('Migrations applied');
  } catch (err) {
    log.error({ err }, 'Migration failed');
    await closePool();
    process.exit(1);
  }

  // GDPR: clean up settings for users inactive > 6 months
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM user_settings WHERE updated_at < NOW() - INTERVAL '6 months'`,
    );
    if (rowCount && rowCount > 0) {
      log.info({ deleted: rowCount }, 'GDPR: purged inactive user settings');
    }
  } catch { /* table may not exist on first run */ }

  // Initialize adapters
  const adapters = createAdapters({ eventbriteToken: config.eventbriteToken });

  const enabledCount = adapters.filter(a => a.enabled).length;
  log.info({ enabledCount }, 'Source adapters initialized');

  // Run initial ingestion
  log.info('Running initial ingestion...');
  await ingestAll(pool, adapters);

  // Generate AI summaries for events that don't have one
  if (config.openaiApiKey) {
    const { summarizeEvents } = await import('./pipeline/summarize.js');
    await summarizeEvents(pool, config.openaiApiKey);
  } else {
    log.info('No OPENAI_API_KEY set, skipping AI summaries');
  }

  // Start scheduler
  if (config.ingestionEnabled) {
    startScheduler(pool, adapters, config.ingestionCron);
  }

  // Start Telegram bot
  log.info('Starting Telegram bot...');
  const bot = createBot(config.telegramBotToken, pool, config.openaiApiKey, config.botOwnerId);

  // Graceful shutdown
  const shutdown = async () => {
    log.info('Shutting down...');
    const forceExit = setTimeout(() => {
      log.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 10_000);
    try {
      bot.stop();
      await closePool();
    } finally {
      clearTimeout(forceExit);
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await bot.start({
    onStart: (info) => {
      log.info({ username: info.username }, 'Bot running');
      log.info('Valencia Events is ready!');
    },
  });
}

main().catch(err => {
  log.error({ err }, 'Fatal error');
  process.exit(1);
});
