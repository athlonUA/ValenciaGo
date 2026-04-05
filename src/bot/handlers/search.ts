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

const log = createLogger('bot:search');

async function sendSearchResults(ctx: Context, pool: pg.Pool, query: string, page: number) {
  const total = await countSearchEvents(pool, query);
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;

  const events = await searchEvents(pool, query, { limit: PAGE_SIZE, offset });

  if (events.length === 0) {
    await ctx.reply(`No events found for "${query}". Try a shorter or different term.`);
    return;
  }

  const header = `Search: "${query}" (${total} found)`;
  const message = formatEventList(events, header, safePage, totalPages);
  const keyboard = buildEventListKeyboard(events, 'search', safePage, totalPages, query);
  await ctx.reply(message, { parse_mode: 'HTML', reply_markup: keyboard, link_preview_options: { is_disabled: true } });
}

async function handleSearchCallback(ctx: Context, pool: pg.Pool, query: string, page: number) {
  const total = await countSearchEvents(pool, query);
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;
  const events = await searchEvents(pool, query, { limit: PAGE_SIZE, offset });

  const header = `Search: "${query}" (${total} found)`;
  const message = formatEventList(events, header, safePage, totalPages);
  const keyboard = buildEventListKeyboard(events, 'search', safePage, totalPages, query);

  try {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML', reply_markup: keyboard, link_preview_options: { is_disabled: true },
    });
  } catch (err: unknown) {
    if (err instanceof GrammyError && err.description.includes('not modified')) return;
    throw err;
  }
}

async function handleSmartSearchPage(ctx: Context, pool: pg.Pool, cacheKey: string, page: number) {
  const ids = getCachedIds(cacheKey);
  if (!ids || ids.length === 0) {
    try {
      await ctx.editMessageText('Search results expired. Please search again.');
    } catch {}
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

  const header = `Found ${ids.length} events`;
  const message = formatEventList(events, header, safePage, totalPages);
  const keyboard = buildEventListKeyboard(events, 'ss', safePage, totalPages, cacheKey);

  try {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML', reply_markup: keyboard, link_preview_options: { is_disabled: true },
    });
  } catch (err: unknown) {
    if (err instanceof GrammyError && err.description.includes('not modified')) return;
    throw err;
  }
}

async function smartSearch(ctx: Context, pool: pg.Pool, userMessage: string, apiKey?: string) {
  if (!apiKey) {
    await sendSearchResults(ctx, pool, userMessage, 1);
    return;
  }

  try {
    const events = await semanticSearch(pool, apiKey, userMessage);
    log.info({ query: userMessage, matches: events.length }, 'Smart search results');

    if (events.length === 0) {
      await ctx.reply(`No events found for "${userMessage}". Try /week or /category to browse.`);
      return;
    }

    // Cache all result IDs for pagination
    const cacheKey = cacheResults(events.map(e => e.id));

    const page = events.slice(0, PAGE_SIZE);
    const totalPages = Math.ceil(events.length / PAGE_SIZE);
    const header = `Found ${events.length} events`;
    const message = formatEventList(page, header, 1, totalPages);
    // Use "ss" command with cache key as filter for pagination
    const keyboard = buildEventListKeyboard(page, 'ss', 1, totalPages, cacheKey);
    await ctx.reply(message, { parse_mode: 'HTML', reply_markup: keyboard, link_preview_options: { is_disabled: true } });
  } catch (err) {
    log.error({ err }, 'Smart search error, falling back to text search');
    await sendSearchResults(ctx, pool, userMessage, 1);
  }
}

export function registerSearchHandlers(bot: Bot, pool: pg.Pool, openaiApiKey?: string, ownerId?: number, token?: string): void {
  // Search pagination callback
  bot.callbackQuery(/^p:search:(\d+):(.*)$/, async (ctx) => {
    const page = parseInt(ctx.match[1], 10);
    const filter = ctx.match[2];
    await handleSearchCallback(ctx, pool, filter, page);
    await ctx.answerCallbackQuery();
  });

  // Smart search pagination callback
  bot.callbackQuery(/^p:ss:(\d+):(.*)$/, async (ctx) => {
    const page = parseInt(ctx.match[1], 10);
    const filter = ctx.match[2];
    await handleSmartSearchPage(ctx, pool, filter, page);
    await ctx.answerCallbackQuery();
  });

  // Voice messages
  bot.on('message:voice', async (ctx) => {
    if (!openaiApiKey) {
      await ctx.reply('Voice search is not configured.');
      return;
    }
    if (ownerId && ctx.from?.id !== ownerId) {
      await ctx.reply('Voice search is available to the bot owner only.');
      return;
    }
    try {
      const file = await ctx.getFile();

      // Validate file size (max 5MB to prevent memory issues)
      if (file.file_size && file.file_size > 5 * 1024 * 1024) {
        await ctx.reply('Voice message too long. Please keep it under 30 seconds.');
        return;
      }

      // Validate file is audio (Telegram voice uses .oga/.ogg)
      const filePath = file.file_path ?? '';
      if (filePath && !/\.(oga|ogg|mp3|wav|m4a|opus)$/i.test(filePath)) {
        await ctx.reply('Unsupported file format. Please send a voice message.');
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
        await ctx.reply('Could not understand the voice message. Try again.');
        return;
      }

      await ctx.reply(`🎙 "${text}"\n\nSearching...`);
      await smartSearch(ctx, pool, text, openaiApiKey);
    } catch (err) {
      log.error({ err }, 'Voice processing error');
      await ctx.reply('Failed to process voice message. Try typing your search instead.');
    }
  });

  // Text message fallback
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith('/')) {
      await ctx.reply('Unknown command. Send /help to see available commands.');
      return;
    }
    // Treat any text message as a smart search query
    if (openaiApiKey && text.length >= 3 && text.length <= 200) {
      await smartSearch(ctx, pool, text, openaiApiKey);
    }
  });
}
