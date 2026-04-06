import 'dotenv/config';

export interface Config {
  databaseUrl: string;
  telegramBotToken: string;
  openaiApiKey: string | undefined;
  eventbriteToken: string | undefined;
  botOwnerId: number | undefined;

  ingestionCron: string;
  ingestionEnabled: boolean;
  nodeEnv: string;
  logLevel: string;
  isProduction: boolean;
}

const VALID_LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function loadConfig(): Config {
  const databaseUrl = requireEnv('DATABASE_URL');
  if (!databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://')) {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection string (postgres://...)');
  }

  const logLevel = process.env.LOG_LEVEL || 'info';
  if (!VALID_LOG_LEVELS.includes(logLevel)) {
    throw new Error(`LOG_LEVEL must be one of: ${VALID_LOG_LEVELS.join(', ')} (got "${logLevel}")`);
  }

  const botOwnerId = process.env.BOT_OWNER_ID ? Number(process.env.BOT_OWNER_ID) : undefined;
  if (botOwnerId !== undefined && isNaN(botOwnerId)) {
    throw new Error('BOT_OWNER_ID must be a numeric Telegram user ID');
  }

  return {
    databaseUrl,
    telegramBotToken: requireEnv('TELEGRAM_BOT_TOKEN'),
    openaiApiKey: process.env.OPENAI_API_KEY || undefined,
    eventbriteToken: process.env.EVENTBRITE_TOKEN || undefined,
    botOwnerId,

    ingestionCron: process.env.INGESTION_CRON || '0 */6 * * *',
    ingestionEnabled: process.env.INGESTION_ENABLED !== 'false',
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel,
    isProduction: process.env.NODE_ENV === 'production',
  };
}
