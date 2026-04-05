import type { StoredEvent } from '../types/index.js';
import { CATEGORY_MAP } from '../types/category.js';
import { formatEventDate } from '../utils/dates.js';

/**
 * Compact event card for Telegram.
 *
 * Format:
 *   Title
 *   Sat 4 Apr, 21:00 · Free
 *   Short English description...
 *   La Rambleta — Map · Details
 *   by Group Name
 */
export function formatEventCard(event: StoredEvent): string {
  const lines: string[] = [];

  // Line 1: Emoji + Title
  const emoji = event.emoji || CATEGORY_MAP.get(event.category)?.emoji || '📌';
  lines.push(`${emoji} <b>${esc(event.title)}</b>`);

  // Line 2: Date/time · Price
  const meta: string[] = [];
  // If AI extracted a real time and starts_at is a placeholder (midnight or noon), use AI time
  // Skip AI time for visitvalencia — adapter always sets noon placeholder and GPT hallucinates times
  const madridHour = Number(event.startsAt.toLocaleString('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false }));
  const isPlaceholderTime = madridHour === 0 || madridHour === 12;
  const trustAiTime = event.source !== 'visitvalencia';
  if (isPlaceholderTime && trustAiTime && event.aiTime && event.aiTime !== 'TBD') {
    const dateOnly = event.startsAt.toLocaleDateString('en-GB', {
      timeZone: 'Europe/Madrid', weekday: 'short', month: 'short', day: 'numeric',
    });
    meta.push(`${dateOnly}, ${event.aiTime}`);
  } else if (isPlaceholderTime && (!trustAiTime || !event.aiTime || event.aiTime === 'TBD')) {
    // No real time available — show date only
    const dateOnly = event.startsAt.toLocaleDateString('en-GB', {
      timeZone: 'Europe/Madrid', weekday: 'short', month: 'short', day: 'numeric',
    });
    meta.push(dateOnly);
  } else {
    meta.push(formatEventDate(event.startsAt));
  }
  // Price: prefer AI-extracted, then original
  const price = event.aiPrice || (event.isFree ? 'Free' : event.priceInfo ? shortPrice(event.priceInfo) : null);
  if (price) meta.push(esc(price));
  lines.push(meta.join(' · '));

  // Line 3: AI summary (preferred) or cleaned description fallback
  if (event.summary) {
    lines.push(`<i>${esc(event.summary)}</i>`);
  } else if (event.description) {
    const snippet = cleanSnippet(event.description, event.title, 100);
    if (snippet) {
      lines.push(`<i>${esc(snippet)}</i>`);
    }
  }

  // Line 4: Map + Details links
  const links: string[] = [];
  if (event.venue) {
    const mapsUrl = buildMapsUrl(event.venue, event.address, event.latitude, event.longitude);
    links.push(`<a href="${esc(mapsUrl)}">Map</a>`);
  }
  if (event.sourceUrl) {
    links.push(`<a href="${esc(event.sourceUrl)}">Details</a>`);
  }
  if (links.length) lines.push(links.join(' · '));

  return lines.join('\n');
}

export function formatEventList(
  events: StoredEvent[],
  header: string,
  _page: number,
  _totalPages: number,
): string {
  if (events.length === 0) {
    return `${header}\n\nNo events found.`;
  }

  const divider = '\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n';
  const cards = events.map(formatEventCard).join(divider);
  return `<b>${esc(header)}</b>\n\n${cards}`;
}

export function formatWelcome(): string {
  return [
    '<b>Valencia Events</b>',
    '',
    '/today — Events today',
    '/tomorrow — Tomorrow',
    '/weekend — This weekend',
    '/week — Next 7 days',
    '/free — Free events',
    '/category — By category',
    '/likes — Your saved events',
    '/help — Commands',
  ].join('\n');
}

export function formatHelp(): string {
  return [
    '<b>Commands</b>',
    '',
    '/today — Events today',
    '/tomorrow — Tomorrow',
    '/weekend — Saturday & Sunday',
    '/week — Next 7 days',
    '/free — Free events',
    '/category — Browse by category',
    '/likes — Your saved events',
    '/stats — Statistics',
  ].join('\n');
}

// --- Helpers ---

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Build a Google Maps search URL from venue/address/coords */
function buildMapsUrl(
  venue?: string,
  address?: string,
  lat?: number,
  lng?: number,
): string {
  if (lat && lng) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  const parts = [venue, address].filter(Boolean).join(', ');
  const query = parts.includes('Valencia') ? parts : `${parts}, Valencia, Spain`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Detect if text is predominantly Spanish (not English) */
function isSpanish(text: string): boolean {
  const lower = text.toLowerCase();
  const esWords = [
    'una', 'los', 'las', 'del', 'por', 'para', 'con', 'desde',
    'entre', 'sobre', 'como', 'pero', 'más', 'donde', 'puede',
    'esta', 'este', 'esto', 'tiene', 'también', 'hasta', 'hacer',
    'mientras', 'durante', 'después', 'antes', 'cada', 'otro',
    'otra', 'todos', 'todas', 'quien', 'cual', 'junto',
    'experiencia', 'disfruta', 'descubre', 'conoce', 'participa',
    'actividad', 'actividades', 'encuentro', 'evento',
  ];
  const words = lower.split(/\s+/);
  if (words.length < 5) return false;
  const esCount = words.filter(w => esWords.includes(w)).length;
  return esCount / words.length > 0.12;
}

/** Strip markdown, emoji, URLs, and operational noise from descriptions */
function cleanDescription(text: string): string {
  let t = text;
  t = t.replace(/\*{1,2}([^*]*)\*{1,2}/g, '$1');
  t = t.replace(/#{1,3}\s*/g, '');
  t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  t = t.replace(/https?:\/\/\S+/g, '');
  t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '');
  t = t.replace(/\b(RSVP|register|sign up|contact me|whatsapp|telegram)[^.!]*/gi, '');
  t = t.replace(/\bDate:\s*[^.!]*/gi, '');
  t = t.replace(/\bTime:\s*[^.!]*/gi, '');
  t = t.replace(/\bStarting\s*Point:\s*[^.!]*/gi, '');
  t = t.replace(/\bPrice:\s*[^.!]*/gi, '');
  t = t.replace(/\b(Hi everyone|Hello everyone|Hey everyone)[!.,]?\s*/gi, '');
  t = t.replace(/\bplease,?\s*read\b[^.!]*/gi, '');
  t = t.replace(/\s+/g, ' ');
  return t.trim();
}

/** Clean and truncate description; skip if Spanish, repeats title, or junk */
function cleanSnippet(description: string, title: string, maxLen: number): string {
  const clean = cleanDescription(description);
  if (!clean || clean.length < 20) return '';

  // Skip Spanish descriptions
  if (isSpanish(clean)) return '';

  // Remove title text from the start
  const titleNorm = title.toLowerCase().replace(/[^a-z0-9\s]/gi, '').trim();
  let result = clean;
  const resultLower = result.toLowerCase().replace(/[^a-z0-9\s]/gi, '').trim();
  if (resultLower.startsWith(titleNorm)) {
    result = result.substring(title.length).replace(/^[\s\-–:·|,]+/, '').trim();
  }

  if (result.length < 20) return '';
  return truncate(result, maxLen);
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.substring(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return cut.substring(0, lastSpace > maxLen * 0.4 ? lastSpace : maxLen) + '...';
}

/** Shorten venue: take just the name, drop full address */
export function shortVenue(venue: string): string {
  const sep = venue.search(/\s*[–—\-,]\s*(?:Pol[ií]gono|Calle|Avda|C\/|n[ºo°]|\d{5})/i);
  if (sep > 0) return venue.substring(0, sep).trim();
  if (venue.length > 30) {
    const comma = venue.indexOf(',');
    if (comma > 0 && comma < 35) return venue.substring(0, comma);
    return venue.substring(0, 30) + '...';
  }
  return venue;
}

/** Shorten price: keep just the amount */
function shortPrice(price: string): string {
  if (price.length <= 20) return price;
  const match = price.match(/[€$]?\s*\d+(?:[.,]\d+)?\s*(?:EUR|€)?/i);
  return match ? match[0].trim() : price.substring(0, 20) + '...';
}
