import { Bot, Context, GrammyError } from 'grammy';
import type pg from 'pg';
import {
  getEventsInRange, countEventsInRange,
} from '../../db/queries.js';
import {
  getTodayRange, getTomorrowRange, getWeekendRange, getWeekRange,
  formatDateOnly,
} from '../../utils/dates.js';
import { CATEGORY_MAP } from '../../types/category.js';
import { formatEventList } from '../formatters.js';
import { buildEventListKeyboard, PAGE_SIZE } from '../keyboards.js';

export function resolveCommand(command: string, filter: string) {
  const opts: Record<string, unknown> = {};
  let range: { from: Date; to: Date };
  let header: string;

  switch (command) {
    case 'today':
      range = getTodayRange(); header = `Events today, ${formatDateOnly(range.from)}`; break;
    case 'tomorrow':
      range = getTomorrowRange(); header = `Events tomorrow, ${formatDateOnly(range.from)}`; break;
    case 'weekend':
      range = getWeekendRange(); header = 'Weekend events'; break;
    case 'free':
      range = getWeekRange(); header = 'Free events this week'; opts.isFree = true; break;
    case 'cat': {
      range = getWeekRange();
      const cat = CATEGORY_MAP.get(filter as never);
      header = cat ? `${cat.emoji} ${cat.nameEn} events this week` : 'Events this week';
      opts.category = filter; break;
    }
    default:
      range = getWeekRange(); header = 'Events this week';
  }
  return { range, header, opts };
}

export async function sendDateEvents(
  ctx: Context, pool: pg.Pool,
  range: { from: Date; to: Date }, command: string, header: string,
  filterOpts?: { category?: string; isFree?: boolean },
) {
  const total = await countEventsInRange(pool, range.from, range.to, filterOpts);
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const events = await getEventsInRange(pool, range.from, range.to, {
    ...filterOpts, limit: PAGE_SIZE, offset: 0,
  });

  if (events.length === 0) {
    const hints: Record<string, string> = {
      today: 'Try /tomorrow or /week.', tomorrow: 'Try /today or /week.',
      weekend: 'Try /week.', week: 'Try /category.', free: 'Try /week.',
    };
    await ctx.reply(`No events found. ${hints[command] || ''}`);
    return;
  }

  const message = formatEventList(events, header, 1, totalPages);
  const keyboard = buildEventListKeyboard(events, command, 1, totalPages, filterOpts?.category || '');
  await ctx.reply(message, { parse_mode: 'HTML', reply_markup: keyboard, link_preview_options: { is_disabled: true } });
}

async function handlePaginatedCallback(
  ctx: Context, pool: pg.Pool,
  range: { from: Date; to: Date }, command: string, page: number,
  filter: string, header: string, opts: Record<string, unknown>,
) {
  const filterOpts = opts as { category?: string; isFree?: boolean };
  const total = await countEventsInRange(pool, range.from, range.to, filterOpts);
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;
  const events = await getEventsInRange(pool, range.from, range.to, {
    ...filterOpts, limit: PAGE_SIZE, offset,
  });

  const message = formatEventList(events, header, safePage, totalPages);
  const keyboard = buildEventListKeyboard(events, command, safePage, totalPages, filter);

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
    const range = getTodayRange();
    await sendDateEvents(ctx, pool, range, 'today', `Events today, ${formatDateOnly(range.from)}`);
  });

  bot.command('tomorrow', async (ctx) => {
    const range = getTomorrowRange();
    await sendDateEvents(ctx, pool, range, 'tomorrow', `Events tomorrow, ${formatDateOnly(range.from)}`);
  });

  bot.command('weekend', async (ctx) => {
    const range = getWeekendRange();
    await sendDateEvents(ctx, pool, range, 'weekend', `Weekend events`);
  });

  bot.command('week', async (ctx) => {
    const range = getWeekRange();
    await sendDateEvents(ctx, pool, range, 'week', `Events this week`);
  });

  bot.command('free', async (ctx) => {
    const range = getWeekRange();
    await sendDateEvents(ctx, pool, range, 'free', `Free events this week`, { isFree: true });
  });

  // Category selection callback
  bot.callbackQuery(/^cat:(.+)$/, async (ctx) => {
    const slug = ctx.match[1];
    const cat = CATEGORY_MAP.get(slug as never);
    if (!cat) { await ctx.answerCallbackQuery({ text: 'Unknown category' }); return; }
    const range = getWeekRange();
    await handlePaginatedCallback(ctx, pool, range, 'cat', 1, slug,
      `${cat.emoji} ${cat.nameEn} events this week`, { category: slug });
    await ctx.answerCallbackQuery();
  });

  // Pagination for date-range commands only (today, tomorrow, weekend, week, free, cat).
  bot.callbackQuery(/^p:(today|tomorrow|weekend|week|free|cat):(\d+):(.*)$/, async (ctx) => {
    const [, command, pageStr, filter] = ctx.match;
    const page = parseInt(pageStr, 10);

    const { range, header, opts } = resolveCommand(command, filter);
    await handlePaginatedCallback(ctx, pool, range, command, page, filter, header, opts);
    await ctx.answerCallbackQuery();
  });
}
