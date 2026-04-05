import OpenAI from 'openai';
import type pg from 'pg';
import { createLogger } from '../utils/logger.js';

const log = createLogger('summarize');

// 15 events per GPT batch balances token usage (~2K tokens) vs API call count
const BATCH_SIZE = 15;

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  venue: string | null;
  category: string | null;
  price_info: string | null;
  starts_at: string;
}

interface AIResult {
  id: string;
  summary: string;
  emoji: string;
  price: string;
  time: string;
}

/**
 * Generate summaries, emoji, price, and time for events using GPT-4o-mini.
 */
export async function summarizeEvents(pool: pg.Pool, apiKey: string): Promise<number> {
  const openai = new OpenAI({ apiKey });

  const { rows } = await pool.query<EventRow>(
    `SELECT id, title, description, venue, category, price_info, starts_at::text
     FROM events
     WHERE (summary IS NULL OR emoji IS NULL OR ai_price IS NULL OR ai_time IS NULL)
       AND description IS NOT NULL AND length(description) > 20
     ORDER BY starts_at ASC`,
  );

  if (rows.length === 0) {
    log.info('All events already processed');
    return 0;
  }

  log.info({ count: rows.length }, 'Processing events with AI');
  let total = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const results = await generateBatch(openai, batch);

    const dbClient = await pool.connect();
    try {
      await dbClient.query('BEGIN');
      for (const r of results) {
        await dbClient.query(
          `UPDATE events SET
            summary = COALESCE(summary, $1),
            emoji = COALESCE(emoji, $2),
            ai_price = $3,
            ai_time = $4
          WHERE id = $5`,
          [r.summary, r.emoji, r.price, r.time, r.id],
        );
        total++;
      }
      await dbClient.query('COMMIT');
    } catch (err) {
      await dbClient.query('ROLLBACK');
      throw err;
    } finally {
      dbClient.release();
    }

    log.info({ total, remaining: rows.length }, 'Batch processed');
  }

  return total;
}

async function generateBatch(openai: OpenAI, events: EventRow[]): Promise<AIResult[]> {
  const eventList = events.map((e, i) =>
    `${i + 1}. [${e.id}] "${e.title}"${e.venue ? ` at ${e.venue}` : ''}\nOriginal price: ${e.price_info || 'unknown'}\nOriginal time: ${e.starts_at}\n${(e.description ?? '').substring(0, 600)}`,
  ).join('\n\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    max_tokens: 2048,
    messages: [
      {
        role: 'system',
        content: `For each event, extract key info and output one line in this exact format:
ID|emoji|summary|price|time

Rules:
- emoji: single emoji matching this specific event (🎸 rock concert, 🧘 yoga, 🍷 wine tasting, etc.)
- summary: one short English sentence (max 15 words) — what the event IS and why someone would go. No dates/logistics.
- price: the actual ticket price from the description. Use format like "Free", "€10", "€15-€25", "From €8". If the description mentions a price but the original says "Free", use the actual price from description. If truly unknown, write "Check details".
- time: the actual event start time in HH:MM format (24h, Europe/Madrid timezone). Extract from description if it mentions a specific time. If the original time shows 00:00 or 01:00 and the description mentions a real time, use that. If the description lists multiple dates with different times (e.g. a season schedule), write "TBD". If no time info available, write "TBD".`,
      },
      { role: 'user', content: eventList },
    ],
  });

  const text = response.choices[0]?.message?.content ?? '';
  const results: AIResult[] = [];

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parts = trimmed.split('|');
    if (parts.length >= 5) {
      const id = parts[0].replace(/^\d+\.\s*\[?/, '').replace(/\]?\s*$/, '').trim();
      const emoji = parts[1].trim();
      const summary = parts[2].trim().substring(0, 200);
      const price = parts[3].trim().substring(0, 100);
      const time = parts[4].trim().substring(0, 50);
      const event = events.find(e => e.id === id);
      if (event && summary.length > 5) {
        results.push({ id: event.id, summary, emoji, price, time });
        continue;
      }
    }
  }

  // Fallback: match by position
  if (results.length < events.length * 0.5) {
    const lines = text.split('\n').filter(l => l.trim());
    for (let j = 0; j < Math.min(lines.length, events.length); j++) {
      if (results.find(r => r.id === events[j].id)) continue;
      const parts = lines[j].split('|');
      if (parts.length >= 5) {
        const emoji = parts[1].trim();
        const summary = parts[2].trim().substring(0, 200);
        const price = parts[3].trim().substring(0, 100);
        const time = parts[4].trim().substring(0, 50);
        if (summary.length > 5) {
          results.push({ id: events[j].id, summary, emoji, price, time });
        }
      }
    }
  }

  return results;
}
