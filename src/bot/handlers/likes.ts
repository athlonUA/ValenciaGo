import { Bot, Context } from 'grammy';
import type pg from 'pg';
import {
  likeEvent, unlikeEvent, getLikedEventsPaginated, countLikedEvents,
} from '../../db/queries.js';
import { formatEventList } from '../formatters.js';
import { PAGE_SIZE } from '../keyboards.js';

async function sendLikesPage(ctx: Context, pool: pg.Pool, userId: number, page: number, edit: boolean = false) {
  const total = await countLikedEvents(pool, userId);

  if (total === 0) {
    const msg = 'No liked events. Tap \u2764\uFE0F on any event to save it.';
    if (edit) { try { await ctx.editMessageText(msg); } catch {} }
    else { await ctx.reply(msg); }
    return;
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const safePage = Math.min(page, totalPages);
  const pageEvents = await getLikedEventsPaginated(pool, userId, PAGE_SIZE, (safePage - 1) * PAGE_SIZE);

  const header = `\u2764\uFE0F Your liked events (${total})`;
  const message = formatEventList(pageEvents, header, safePage, totalPages);

  // Build keyboard with unlike + share buttons
  const kb = new (await import('grammy')).InlineKeyboard();
  for (let i = 0; i < pageEvents.length; i++) {
    kb.text(`\uD83D\uDC94 ${i + 1}`, `unlike:${pageEvents[i].id}`);
  }
  kb.row();
  for (let i = 0; i < pageEvents.length; i++) {
    kb.text(`\uD83D\uDCE4 ${i + 1}`, `share:${pageEvents[i].id}`);
  }
  if (totalPages > 1) {
    kb.row();
    if (safePage > 1) kb.text('\u00AB Prev', `p:likes:${safePage - 1}:`);
    kb.text(`${safePage}/${totalPages}`, 'noop');
    if (safePage < totalPages) kb.text('Next \u00BB', `p:likes:${safePage + 1}:`);
  }

  const opts = { parse_mode: 'HTML' as const, reply_markup: kb, link_preview_options: { is_disabled: true } };
  if (edit) {
    try { await ctx.editMessageText(message, opts); } catch {}
  } else {
    await ctx.reply(message, opts);
  }
}

export function registerLikesHandlers(bot: Bot, pool: pg.Pool): void {
  bot.command('likes', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    await sendLikesPage(ctx, pool, userId, 1);
  });

  // Like event
  bot.callbackQuery(/^like:(.+)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) { await ctx.answerCallbackQuery(); return; }
    await likeEvent(pool, userId, ctx.match[1]);
    await ctx.answerCallbackQuery({ text: '\u2764\uFE0F Saved! View with /likes' });
  });

  // Unlike event (from /likes view)
  bot.callbackQuery(/^unlike:(.+)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) { await ctx.answerCallbackQuery(); return; }
    await unlikeEvent(pool, userId, ctx.match[1]);
    await ctx.answerCallbackQuery({ text: 'Removed from likes' });
    // Re-render likes page
    await sendLikesPage(ctx, pool, userId, 1, true);
  });

  // Likes pagination
  bot.callbackQuery(/^p:likes:(\d+):$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) { await ctx.answerCallbackQuery(); return; }
    const page = parseInt(ctx.match[1], 10);
    await sendLikesPage(ctx, pool, userId, page, true);
    await ctx.answerCallbackQuery();
  });
}
