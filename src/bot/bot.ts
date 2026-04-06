import { Bot, GrammyError, HttpError } from 'grammy';
import { createLogger } from '../utils/logger.js';
import type pg from 'pg';
import { registerMiscHandlers } from './handlers/misc.js';
import { registerLikesHandlers } from './handlers/likes.js';
import { registerSearchHandlers } from './handlers/search.js';
import { registerEventHandlers } from './handlers/events.js';
import { t, resolveLocale, buildCommandList } from './i18n.js';

const log = createLogger('bot');

export function createBot(token: string, pool: pg.Pool, openaiApiKey?: string, ownerId?: number): Bot {
  const bot = new Bot(token);

  // Rate limiting: 15 actions/30s balances normal browsing (3 pages + likes) vs abuse prevention
  const rateLimits = new Map<number, { count: number; resetAt: number }>();
  const RATE_LIMIT_MAX = 15;
  const RATE_LIMIT_WINDOW = 30_000;

  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return next();

    const now = Date.now();
    let entry = rateLimits.get(userId);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
      rateLimits.set(userId, entry);
    }
    entry.count++;

    if (entry.count > RATE_LIMIT_MAX) {
      const locale = resolveLocale(ctx.from?.language_code);
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: t(locale, 'rateLimit.callback') });
        return;
      }
      await ctx.reply(t(locale, 'rateLimit.message'));
      return;
    }
    return next();
  });

  // Periodic cleanup of rate limit entries (every 60s)
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of rateLimits) {
      if (now >= val.resetAt) rateLimits.delete(key);
    }
  }, 60_000).unref();

  // Clear stale command menus, then register fresh per-language lists
  bot.api.deleteMyCommands();
  bot.api.deleteMyCommands({ language_code: 'uk' });
  bot.api.deleteMyCommands({ language_code: 'es' });
  bot.api.setMyCommands(buildCommandList('en'));
  bot.api.setMyCommands(buildCommandList('uk'), { language_code: 'uk' });
  bot.api.setMyCommands(buildCommandList('es'), { language_code: 'es' });

  // Register handlers. Order matters:
  // 1. Command handlers (misc, events) must be registered before the message:text catch-all in search.
  // 2. Callback query patterns: specific patterns (likes, search, ss) must be before the general pagination catch-all in events.
  registerMiscHandlers(bot, pool);
  registerLikesHandlers(bot, pool);
  registerEventHandlers(bot, pool);
  registerSearchHandlers(bot, pool, openaiApiKey, ownerId, token);

  // --- Error handling ---

  bot.catch((err) => {
    const ctx = err.ctx;
    const e = err.error;
    if (e instanceof GrammyError) {
      log.error({ err: e, updateId: ctx.update.update_id }, 'Grammy error in request');
    } else if (e instanceof HttpError) {
      log.error({ err: e, updateId: ctx.update.update_id }, 'Could not contact Telegram');
    } else {
      log.error({ err: e, updateId: ctx.update.update_id }, 'Unknown error while handling update');
    }
  });

  return bot;
}
