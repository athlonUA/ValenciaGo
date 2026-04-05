import { Bot } from 'grammy';
import type pg from 'pg';
import {
  getEventStats, getEventById, deleteUserData,
} from '../../db/queries.js';
import { CATEGORIES, CATEGORY_MAP } from '../../types/category.js';
import { getWeekRange } from '../../utils/dates.js';
import { formatEventCard, formatWelcome, formatHelp } from '../formatters.js';
import { buildCategoryKeyboard } from '../keyboards.js';
import { sendDateEvents } from './events.js';

export function registerMiscHandlers(bot: Bot, pool: pg.Pool): void {
  bot.command('start', async (ctx) => {
    await ctx.reply(formatWelcome(), { parse_mode: 'HTML' });
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(formatHelp(), { parse_mode: 'HTML' });
  });

  bot.command('category', async (ctx) => {
    const arg = ctx.match?.trim().toLowerCase();
    if (arg) {
      const cat = CATEGORIES.find(c => c.slug === arg || c.nameEn.toLowerCase() === arg);
      if (!cat) {
        if (arg.length > 50) {
          await ctx.reply('Unknown category. Send /category to see available categories.');
          return;
        }
        await ctx.reply(`Unknown category "${arg}". Send /category to see available categories.`);
        return;
      }
      const range = getWeekRange();
      await sendDateEvents(ctx, pool, range, 'cat', `${cat.emoji} ${cat.nameEn} events this week`, {
        category: cat.slug,
      });
    } else {
      await ctx.reply('Browse by category:', { reply_markup: buildCategoryKeyboard() });
    }
  });

  bot.command('stats', async (ctx) => {
    const stats = await getEventStats(pool);
    const lines = [
      `<b>Event Statistics</b>`,
      '',
      `Total events: ${stats.total}`,
      `Upcoming: ${stats.upcoming}`,
      '',
      '<b>By source:</b>',
      ...stats.sources.map(s => `  ${s.source}: ${s.count}`),
      '',
      '<b>Upcoming by category:</b>',
      ...stats.categories.map(c => {
        const cat = CATEGORY_MAP.get(c.category as never);
        const label = cat ? `${cat.emoji} ${cat.nameEn}` : c.category;
        return `  ${label}: ${c.count}`;
      }),
    ];
    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
  });

  bot.command('deletedata', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    const deleted = await deleteUserData(pool, userId);
    await ctx.reply(`Your data has been deleted (${deleted} liked events removed). Your Telegram ID is no longer stored.`);
  });

  // Noop callback
  bot.callbackQuery('noop', async (ctx) => {
    await ctx.answerCallbackQuery();
  });

  // Categories callback
  bot.callbackQuery('categories', async (ctx) => {
    await ctx.editMessageText('Browse by category:', { reply_markup: buildCategoryKeyboard() });
    await ctx.answerCallbackQuery();
  });

  // Share event
  bot.callbackQuery(/^share:(.+)$/, async (ctx) => {
    const event = await getEventById(pool, ctx.match[1]);
    if (!event) {
      await ctx.answerCallbackQuery({ text: 'Event not found' });
      return;
    }
    await ctx.reply(formatEventCard(event), { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
    await ctx.answerCallbackQuery();
  });
}
