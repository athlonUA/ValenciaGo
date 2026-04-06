import { Bot, Context, GrammyError } from 'grammy';
import type pg from 'pg';
import { createLogger } from '../../utils/logger.js';
import {
  searchEvents, countSearchEvents, rowToStoredEvent,
} from '../../db/queries.js';
import type { StoredEvent } from '../../types/index.js';
import { formatEventList } from '../formatters.js';
import { buildEventListKeyboard, PAGE_SIZE } from '../keyboards.js';
import { semanticSearch, cacheResults, getCachedIds } from '../smart-search.js';
import { t, resolveCtxLocale, type Locale } from '../i18n.js';

const log = createLogger('bot:search');

async function sendSearchResults(ctx: Context, pool: pg.Pool, query: string, page: number, locale: Locale) {
  const total = await countSearchEvents(pool, query);
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;

  const events = await searchEvents(pool, query, { limit: PAGE_SIZE, offset });

  if (events.length === 0) {
    await ctx.reply(t(locale, 'search.noResults', { query }));
    return;
  }

  const header = t(locale, 'search.header', { query, count: total });
  const message = formatEventList(events, header, safePage, totalPages, locale);
  const keyboard = buildEventListKeyboard(events, 'search', safePage, totalPages, query, locale);
  await ctx.reply(message, { parse_mode: 'HTML', reply_markup: keyboard, link_preview_options: { is_disabled: true } });
}

async function handleSearchCallback(ctx: Context, pool: pg.Pool, query: string, page: number, locale: Locale) {
  const total = await countSearchEvents(pool, query);
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;
  const events = await searchEvents(pool, query, { limit: PAGE_SIZE, offset });

  const header = t(locale, 'search.header', { query, count: total });
  const message = formatEventList(events, header, safePage, totalPages, locale);
  const keyboard = buildEventListKeyboard(events, 'search', safePage, totalPages, query, locale);

  try {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML', reply_markup: keyboard, link_preview_options: { is_disabled: true },
    });
  } catch (err: unknown) {
    if (err instanceof GrammyError && err.description.includes('not modified')) return;
    throw err;
  }
}

async function handleSmartSearchPage(ctx: Context, pool: pg.Pool, cacheKey: string, page: number, locale: Locale) {
  const ids = getCachedIds(cacheKey);
  if (!ids || ids.length === 0) {
    try {
      await ctx.editMessageText(t(locale, 'search.expired'));
    } catch (err: unknown) {
      if (err instanceof GrammyError && err.description.includes('not modified')) return;
      log.error({ err }, 'Failed to edit expired search message');
    }
    return;
  }

  const totalPages = Math.ceil(ids.length / PAGE_SIZE);
  const safePage = Math.min(page, totalPages);
  const pageIds = ids.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Fetch events for this page
  const placeholders = pageIds.map((_, i) => `$${i + 1}`).join(',');
  const result = await pool.query(`SELECT * FROM events WHERE id IN (${placeholders})`, pageIds);

  // Preserve order from cache
  const eventMap = new Map(result.rows.map(r => [r.id, r]));
  const events: StoredEvent[] = [];
  for (const id of pageIds) {
    const row = eventMap.get(id);
    if (row) {
      events.push(rowToStoredEvent(row));
    }
  }

  const header = t(locale, 'search.found', { count: ids.length });
  const message = formatEventList(events, header, safePage, totalPages, locale);
  const keyboard = buildEventListKeyboard(events, 'ss', safePage, totalPages, cacheKey, locale);

  try {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML', reply_markup: keyboard, link_preview_options: { is_disabled: true },
    });
  } catch (err: unknown) {
    if (err instanceof GrammyError && err.description.includes('not modified')) return;
    throw err;
  }
}

async function smartSearch(ctx: Context, pool: pg.Pool, userMessage: string, locale: Locale, apiKey?: string) {
  if (!apiKey) {
    await sendSearchResults(ctx, pool, userMessage, 1, locale);
    return;
  }

  try {
    const events = await semanticSearch(pool, apiKey, userMessage);
    log.info({ query: userMessage, matches: events.length }, 'Smart search results');

    if (events.length === 0) {
      await ctx.reply(t(locale, 'search.noResultsSmart', { query: userMessage }));
      return;
    }

    // Cache all result IDs for pagination
    const cacheKey = cacheResults(events.map(e => e.id));

    const page = events.slice(0, PAGE_SIZE);
    const totalPages = Math.ceil(events.length / PAGE_SIZE);
    const header = t(locale, 'search.found', { count: events.length });
    const message = formatEventList(page, header, 1, totalPages, locale);
    // Use "ss" command with cache key as filter for pagination
    const keyboard = buildEventListKeyboard(page, 'ss', 1, totalPages, cacheKey, locale);
    await ctx.reply(message, { parse_mode: 'HTML', reply_markup: keyboard, link_preview_options: { is_disabled: true } });
  } catch (err) {
    log.error({ err }, 'Smart search error, falling back to text search');
    await sendSearchResults(ctx, pool, userMessage, 1, locale);
  }
}

export function registerSearchHandlers(bot: Bot, pool: pg.Pool, openaiApiKey?: string, ownerId?: number, token?: string): void {
  // Search pagination callback
  bot.callbackQuery(/^p:search:(\d+):(.*)$/, async (ctx) => {
    const locale = await resolveCtxLocale(ctx, pool);
    const page = parseInt(ctx.match[1], 10);
    const filter = ctx.match[2];
    await handleSearchCallback(ctx, pool, filter, page, locale);
    await ctx.answerCallbackQuery();
  });

  // Smart search pagination callback
  bot.callbackQuery(/^p:ss:(\d+):(.*)$/, async (ctx) => {
    const locale = await resolveCtxLocale(ctx, pool);
    const page = parseInt(ctx.match[1], 10);
    const filter = ctx.match[2];
    await handleSmartSearchPage(ctx, pool, filter, page, locale);
    await ctx.answerCallbackQuery();
  });

  // Voice messages
  bot.on('message:voice', async (ctx) => {
    const locale = await resolveCtxLocale(ctx, pool);
    if (!openaiApiKey) {
      await ctx.reply(t(locale, 'search.voiceNotConfigured'));
      return;
    }
    if (ownerId && ctx.from?.id !== ownerId) {
      await ctx.reply(t(locale, 'search.voiceOwnerOnly'));
      return;
    }
    try {
      const file = await ctx.getFile();

      // Validate file size (max 5MB to prevent memory issues)
      if (file.file_size && file.file_size > 5 * 1024 * 1024) {
        await ctx.reply(t(locale, 'search.voiceTooLong'));
        return;
      }

      // Validate file is audio (Telegram voice uses .oga/.ogg)
      const filePath = file.file_path ?? '';
      if (filePath && !/\.(oga|ogg|mp3|wav|m4a|opus)$/i.test(filePath)) {
        await ctx.reply(t(locale, 'search.voiceUnsupported'));
        return;
      }

      const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: openaiApiKey });

      // Download voice file
      const response = await fetch(url);
      const buffer = Buffer.from(await response.arrayBuffer());
      const audioFile = new File([buffer], 'voice.ogg', { type: 'audio/ogg' });

      const transcription = await client.audio.transcriptions.create({
        model: 'whisper-1',
        file: audioFile,
      });

      const text = transcription.text?.trim();
      if (!text) {
        await ctx.reply(t(locale, 'search.voiceNotUnderstood'));
        return;
      }

      await ctx.reply(t(locale, 'search.voiceSearching', { text }));
      await smartSearch(ctx, pool, text, locale, openaiApiKey);
    } catch (err) {
      log.error({ err }, 'Voice processing error');
      await ctx.reply(t(locale, 'search.voiceFailed'));
    }
  });

  // Text message fallback
  bot.on('message:text', async (ctx) => {
    const locale = await resolveCtxLocale(ctx, pool);
    const text = ctx.message.text;
    if (text.startsWith('/')) {
      await ctx.reply(t(locale, 'search.unknownCommand'));
      return;
    }
    // Treat any text message as a smart search query
    if (openaiApiKey && text.length >= 3 && text.length <= 200) {
      await smartSearch(ctx, pool, text, locale, openaiApiKey);
    }
  });
}
