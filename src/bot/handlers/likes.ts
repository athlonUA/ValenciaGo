import { Bot, Context, GrammyError } from 'grammy';
import type pg from 'pg';
import {
  likeEvent, unlikeEvent, getLikedEventsPaginated, countLikedEvents,
} from '../../db/queries.js';
import { formatEventList } from '../formatters.js';
import { PAGE_SIZE } from '../keyboards.js';
import { t, resolveCtxLocale, type Locale } from '../i18n.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('bot:likes');

/** Edit message, silently ignoring "message is not modified" errors */
async function safeEdit(ctx: Context, text: string, opts?: Record<string, unknown>) {
  try {
    await ctx.editMessageText(text, opts);
  } catch (err: unknown) {
    if (err instanceof GrammyError && err.description.includes('not modified')) return;
    log.error({ err }, 'Failed to edit message');
  }
}

async function sendLikesPage(ctx: Context, pool: pg.Pool, userId: number, page: number, locale: Locale, edit: boolean = false) {
  const total = await countLikedEvents(pool, userId);

  if (total === 0) {
    const msg = t(locale, 'likes.empty');
    if (edit) { await safeEdit(ctx, msg); }
    else { await ctx.reply(msg); }
    return;
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const safePage = Math.min(page, totalPages);
  const pageEvents = await getLikedEventsPaginated(pool, userId, PAGE_SIZE, (safePage - 1) * PAGE_SIZE);

  const header = t(locale, 'likes.header', { total });
  const message = formatEventList(pageEvents, header, safePage, totalPages, locale);

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
    if (safePage > 1) kb.text(t(locale, 'keyboard.prev'), `p:likes:${safePage - 1}:`);
    kb.text(`${safePage}/${totalPages}`, 'noop');
    if (safePage < totalPages) kb.text(t(locale, 'keyboard.next'), `p:likes:${safePage + 1}:`);
  }

  const opts = { parse_mode: 'HTML' as const, reply_markup: kb, link_preview_options: { is_disabled: true } };
  if (edit) {
    await safeEdit(ctx, message, opts);
  } else {
    await ctx.reply(message, opts);
  }
}

export function registerLikesHandlers(bot: Bot, pool: pg.Pool): void {
  bot.command('likes', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    const locale = await resolveCtxLocale(ctx, pool);
    await sendLikesPage(ctx, pool, userId, 1, locale);
  });

  // Like event
  bot.callbackQuery(/^like:(.+)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) { await ctx.answerCallbackQuery(); return; }
    const locale = await resolveCtxLocale(ctx, pool);
    await likeEvent(pool, userId, ctx.match[1]);
    await ctx.answerCallbackQuery({ text: t(locale, 'likes.saved') });
  });

  // Unlike event (from /likes view)
  bot.callbackQuery(/^unlike:(.+)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) { await ctx.answerCallbackQuery(); return; }
    const locale = await resolveCtxLocale(ctx, pool);
    await unlikeEvent(pool, userId, ctx.match[1]);
    await ctx.answerCallbackQuery({ text: t(locale, 'likes.removed') });
    // Re-render likes page
    await sendLikesPage(ctx, pool, userId, 1, locale, true);
  });

  // Likes pagination
  bot.callbackQuery(/^p:likes:(\d+):$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) { await ctx.answerCallbackQuery(); return; }
    const locale = await resolveCtxLocale(ctx, pool);
    const page = parseInt(ctx.match[1], 10);
    await sendLikesPage(ctx, pool, userId, page, locale, true);
    await ctx.answerCallbackQuery();
  });
}
