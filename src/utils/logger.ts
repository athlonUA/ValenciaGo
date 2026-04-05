import pino from 'pino';

const level = process.env.LOG_LEVEL || 'info';

export const logger = pino({
  level,
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino/file', options: { destination: 1 } }
    : undefined,
});

/** Create a child logger with a component name for correlation */
export function createLogger(component: string) {
  return logger.child({ component });
}
