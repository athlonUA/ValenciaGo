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

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function loadConfig(): Config {
  return {
    databaseUrl: requireEnv('DATABASE_URL'),
    telegramBotToken: requireEnv('TELEGRAM_BOT_TOKEN'),
    openaiApiKey: process.env.OPENAI_API_KEY || undefined,
    eventbriteToken: process.env.EVENTBRITE_TOKEN || undefined,
    botOwnerId: process.env.BOT_OWNER_ID ? Number(process.env.BOT_OWNER_ID) : undefined,

    ingestionCron: process.env.INGESTION_CRON || '0 */6 * * *',
    ingestionEnabled: process.env.INGESTION_ENABLED !== 'false',
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    isProduction: process.env.NODE_ENV === 'production',
  };
}
