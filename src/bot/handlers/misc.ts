import { Bot, InlineKeyboard } from 'grammy';
import type pg from 'pg';
import {
  getEventStats, getEventById, deleteUserData, setUserLocale,
} from '../../db/queries.js';
import { getCategoryDisplay } from '../../types/category.js';
import { getWeekRange } from '../../utils/dates.js';
import { formatEventCard, formatWelcome } from '../formatters.js';
import { buildCategoryKeyboard } from '../keyboards.js';
import { sendDateEvents } from './events.js';
import { t, resolveCtxLocale, isLocale, buildCommandList, SUPPORTED_LOCALES, type Locale } from '../i18n.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('bot:misc');

const LOCALE_LABELS: Record<Locale, string> = {
  en: '🇬🇧 English',
  uk: '🇺🇦 Українська',
  es: '🇪🇸 Español',
};

function buildLangKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const loc of SUPPORTED_LOCALES) {
    kb.text(LOCALE_LABELS[loc], `lang:${loc}`);
  }
  return kb;
}

export function registerMiscHandlers(bot: Bot, pool: pg.Pool): void {
  bot.command('start', async (ctx) => {
    const locale = await resolveCtxLocale(ctx, pool);
    await ctx.reply(formatWelcome(locale), { parse_mode: 'HTML' });
  });

  bot.command('category', async (ctx) => {
    const locale = await resolveCtxLocale(ctx, pool);
    const arg = ctx.match?.trim().toLowerCase();
    if (arg) {
      const { CATEGORIES } = await import('../../types/category.js');
      const cat = CATEGORIES.find(c => c.slug === arg || c.nameEn.toLowerCase() === arg);
      if (!cat) {
        if (arg.length > 50) {
          await ctx.reply(t(locale, 'misc.unknownCategory'));
          return;
        }
        await ctx.reply(t(locale, 'misc.unknownCategoryNamed', { name: arg }));
        return;
      }
      const range = getWeekRange();
      await sendDateEvents(ctx, pool, range, 'cat', `${cat.emoji} ${cat.nameEn} events this week`, {
        category: cat.slug,
      }, locale);
    } else {
      await ctx.reply(t(locale, 'misc.browseByCategory'), { reply_markup: buildCategoryKeyboard(locale) });
    }
  });

  bot.command('stats', async (ctx) => {
    const locale = await resolveCtxLocale(ctx, pool);
    const stats = await getEventStats(pool);
    const lines = [
      `<b>${t(locale, 'stats.title')}</b>`,
      '',
      t(locale, 'stats.total', { count: stats.total }),
      t(locale, 'stats.upcoming', { count: stats.upcoming }),
      '',
      `<b>${t(locale, 'stats.bySource')}</b>`,
      ...stats.sources.map(s => `  ${s.source}: ${s.count}`),
      '',
      `<b>${t(locale, 'stats.byCategory')}</b>`,
      ...stats.categories.map(c => {
        const label = getCategoryDisplay(c.category, locale);
        return `  ${label}: ${c.count}`;
      }),
    ];
    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
  });

  bot.command('lang', async (ctx) => {
    const locale = await resolveCtxLocale(ctx, pool);
    await ctx.reply(t(locale, 'lang.choose'), { reply_markup: buildLangKeyboard() });
  });

  bot.callbackQuery(/^lang:(en|uk|es)$/, async (ctx) => {
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id;
    if (!userId) { await ctx.answerCallbackQuery(); return; }
    const chosen = ctx.match[1];
    if (!isLocale(chosen)) { await ctx.answerCallbackQuery(); return; }
    await setUserLocale(pool, userId, chosen);

    // Update command menu for this specific chat
    if (chatId) {
      await ctx.api.setMyCommands(buildCommandList(chosen), {
        scope: { type: 'chat', chat_id: chatId },
      });
    }

    const msg = t(chosen, 'lang.set');
    try {
      await ctx.editMessageText(msg);
    } catch { /* ignore "not modified" */ }
    await ctx.answerCallbackQuery({ text: msg });
  });

  bot.command('deletedata', async (ctx) => {
    const locale = await resolveCtxLocale(ctx, pool);
    const userId = ctx.from?.id;
    if (!userId) return;
    const deleted = await deleteUserData(pool, userId);
    log.info({ userId, deletedLikes: deleted }, 'GDPR: user data deleted');
    await ctx.reply(t(locale, 'misc.deleteData', { deleted }));
  });

  // Noop callback
  bot.callbackQuery('noop', async (ctx) => {
    await ctx.answerCallbackQuery();
  });

  // Categories callback
  bot.callbackQuery('categories', async (ctx) => {
    const locale = await resolveCtxLocale(ctx, pool);
    await ctx.editMessageText(t(locale, 'misc.browseByCategory'), { reply_markup: buildCategoryKeyboard(locale) });
    await ctx.answerCallbackQuery();
  });

  // Share event
  bot.callbackQuery(/^share:(.+)$/, async (ctx) => {
    const locale = await resolveCtxLocale(ctx, pool);
    const event = await getEventById(pool, ctx.match[1]);
    if (!event) {
      await ctx.answerCallbackQuery({ text: t(locale, 'misc.eventNotFound') });
      return;
    }
    await ctx.reply(formatEventCard(event, locale), { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
    await ctx.answerCallbackQuery();
  });
}
