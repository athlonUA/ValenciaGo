import { Bot, Context, GrammyError } from 'grammy';
import type pg from 'pg';
import {
  getEventsInRange, countEventsInRange,
} from '../../db/queries.js';
import {
  getTodayRange, getTomorrowRange, getWeekendRange, getWeekRange,
  formatDateOnly,
} from '../../utils/dates.js';
import { CATEGORY_MAP, getCategoryName } from '../../types/category.js';
import { formatEventList } from '../formatters.js';
import { buildEventListKeyboard, PAGE_SIZE } from '../keyboards.js';
import { t, resolveCtxLocale, dateLocale, type Locale } from '../i18n.js';

export function resolveCommand(command: string, filter: string, locale: Locale) {
  const opts: Record<string, unknown> = {};
  let range: { from: Date; to: Date };
  let header: string;
  const dl = dateLocale(locale);

  switch (command) {
    case 'today':
      range = getTodayRange(); header = t(locale, 'events.today', { date: formatDateOnly(range.from, dl) }); break;
    case 'tomorrow':
      range = getTomorrowRange(); header = t(locale, 'events.tomorrow', { date: formatDateOnly(range.from, dl) }); break;
    case 'weekend':
      range = getWeekendRange(); header = t(locale, 'events.weekend'); break;
    case 'free':
      range = getWeekRange(); header = t(locale, 'events.freeThisWeek'); opts.isFree = true; break;
    case 'cat': {
      range = getWeekRange();
      const cat = CATEGORY_MAP.get(filter as never);
      header = cat
        ? t(locale, 'events.categoryWeek', { emoji: cat.emoji, name: getCategoryName(cat, locale) })
        : t(locale, 'events.thisWeek');
      opts.category = filter; break;
    }
    default:
      range = getWeekRange(); header = t(locale, 'events.thisWeek');
  }
  return { range, header, opts };
}

// Hint keys lookup — avoids dynamic key construction issues
const hintKeys: Record<string, 'events.hint.today' | 'events.hint.tomorrow' | 'events.hint.weekend' | 'events.hint.week' | 'events.hint.free'> = {
  today: 'events.hint.today',
  tomorrow: 'events.hint.tomorrow',
  weekend: 'events.hint.weekend',
  week: 'events.hint.week',
  free: 'events.hint.free',
};

export async function sendDateEvents(
  ctx: Context, pool: pg.Pool,
  range: { from: Date; to: Date }, command: string, header: string,
  filterOpts?: { category?: string; isFree?: boolean },
  locale: Locale = 'en',
) {
  const total = await countEventsInRange(pool, range.from, range.to, filterOpts);
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const events = await getEventsInRange(pool, range.from, range.to, {
    ...filterOpts, limit: PAGE_SIZE, offset: 0,
  });

  if (events.length === 0) {
    const hint = t(locale, hintKeys[command] || 'events.hint.week');
    await ctx.reply(t(locale, 'events.noEvents', { hint }));
    return;
  }

  const message = formatEventList(events, header, 1, totalPages, locale);
  const keyboard = buildEventListKeyboard(events, command, 1, totalPages, filterOpts?.category || '', locale);
  await ctx.reply(message, { parse_mode: 'HTML', reply_markup: keyboard, link_preview_options: { is_disabled: true } });
}

async function handlePaginatedCallback(
  ctx: Context, pool: pg.Pool,
  range: { from: Date; to: Date }, command: string, page: number,
  filter: string, header: string, opts: Record<string, unknown>,
  locale: Locale,
) {
  const filterOpts = opts as { category?: string; isFree?: boolean };
  const total = await countEventsInRange(pool, range.from, range.to, filterOpts);
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;
  const events = await getEventsInRange(pool, range.from, range.to, {
    ...filterOpts, limit: PAGE_SIZE, offset,
  });

  const message = formatEventList(events, header, safePage, totalPages, locale);
  const keyboard = buildEventListKeyboard(events, command, safePage, totalPages, filter, locale);

  try {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML', reply_markup: keyboard, link_preview_options: { is_disabled: true },
    });
  } catch (err: unknown) {
    if (err instanceof GrammyError && err.description.includes('not modified')) return;
    throw err;
  }
}

export function registerEventHandlers(bot: Bot, pool: pg.Pool): void {
  bot.command('today', async (ctx) => {
    const locale = await resolveCtxLocale(ctx, pool);
    const dl = dateLocale(locale);
    const range = getTodayRange();
    await sendDateEvents(ctx, pool, range, 'today', t(locale, 'events.today', { date: formatDateOnly(range.from, dl) }), undefined, locale);
  });

  bot.command('tomorrow', async (ctx) => {
    const locale = await resolveCtxLocale(ctx, pool);
    const dl = dateLocale(locale);
    const range = getTomorrowRange();
    await sendDateEvents(ctx, pool, range, 'tomorrow', t(locale, 'events.tomorrow', { date: formatDateOnly(range.from, dl) }), undefined, locale);
  });

  bot.command('weekend', async (ctx) => {
    const locale = await resolveCtxLocale(ctx, pool);
    const range = getWeekendRange();
    await sendDateEvents(ctx, pool, range, 'weekend', t(locale, 'events.weekend'), undefined, locale);
  });

  bot.command('week', async (ctx) => {
    const locale = await resolveCtxLocale(ctx, pool);
    const range = getWeekRange();
    await sendDateEvents(ctx, pool, range, 'week', t(locale, 'events.thisWeek'), undefined, locale);
  });

  bot.command('free', async (ctx) => {
    const locale = await resolveCtxLocale(ctx, pool);
    const range = getWeekRange();
    await sendDateEvents(ctx, pool, range, 'free', t(locale, 'events.freeThisWeek'), { isFree: true }, locale);
  });

  // Category selection callback
  bot.callbackQuery(/^cat:(.+)$/, async (ctx) => {
    const locale = await resolveCtxLocale(ctx, pool);
    const slug = ctx.match[1];
    const cat = CATEGORY_MAP.get(slug as never);
    if (!cat) { await ctx.answerCallbackQuery({ text: t(locale, 'events.unknownCategory') }); return; }
    const range = getWeekRange();
    const header = t(locale, 'events.categoryWeek', { emoji: cat.emoji, name: getCategoryName(cat, locale) });
    await handlePaginatedCallback(ctx, pool, range, 'cat', 1, slug, header, { category: slug }, locale);
    await ctx.answerCallbackQuery();
  });

  // Pagination for date-range commands only (today, tomorrow, weekend, week, free, cat).
  bot.callbackQuery(/^p:(today|tomorrow|weekend|week|free|cat):(\d+):(.*)$/, async (ctx) => {
    const locale = await resolveCtxLocale(ctx, pool);
    const [, command, pageStr, filter] = ctx.match;
    const page = parseInt(pageStr, 10);

    const { range, header, opts } = resolveCommand(command, filter, locale);
    await handlePaginatedCallback(ctx, pool, range, command, page, filter, header, opts, locale);
    await ctx.answerCallbackQuery();
  });
}
