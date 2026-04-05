/**
 * Title normalization for display and fingerprinting.
 *
 * Display: trims, collapses whitespace, decodes HTML entities.
 * Fingerprint: additionally lowercases, strips accents/punctuation,
 *   removes noise words, sorts words for position-independent matching.
 */

const NOISE_WORDS = new Set([
  // Spanish
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'en', 'y', 'o', 'a', 'al', 'con', 'por', 'para',
  // English
  'the', 'a', 'an', 'of', 'in', 'and', 'or', 'at', 'with', 'for', 'to',
  // Valencian
  'el', 'la', 'els', 'les', 'i', 'de', 'del',
]);

const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#39;': "'", '&nbsp;': ' ', '&#x27;': "'", '&#x2F;': '/',
};

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&[#\w]+;/g, m => HTML_ENTITY_MAP[m] || m);
}

export function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeTitle(raw: string): string {
  let text = raw.trim();
  text = decodeHtmlEntities(text);
  text = text.replace(/\s+/g, ' ');
  return text;
}

export function fingerprintTitle(raw: string): string {
  let text = raw.trim();
  text = decodeHtmlEntities(text);
  text = text.toLowerCase();
  // Strip accents via NFD decomposition
  text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Strip punctuation and emoji
  text = text.replace(/[^a-z0-9\s]/g, '');
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();
  // Remove noise words
  const words = text.split(' ').filter(w => !NOISE_WORDS.has(w) && w.length > 1);
  // Sort for position-independent matching
  words.sort();
  return words.join(' ');
}

/** Normalize a venue name for matching */
export function fingerprintVenue(venue: string): string {
  let text = venue.trim().toLowerCase();
  text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  text = text.replace(/[^a-z0-9\s]/g, '');
  text = text.replace(/\b(el|la|los|las|del|de|centre|centro)\b/g, '');
  return text.replace(/\s+/g, ' ').trim();
}

/** Truncate description, preserving sentence boundaries */
export function truncateDescription(text: string, maxLen: number = 300): string {
  const cleaned = stripHtml(decodeHtmlEntities(text)).trim();
  if (cleaned.length <= maxLen) return cleaned;

  const truncated = cleaned.substring(0, maxLen);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastExcl = truncated.lastIndexOf('!');
  const boundary = Math.max(lastPeriod, lastExcl);

  if (boundary > maxLen * 0.5) {
    return truncated.substring(0, boundary + 1);
  }

  const lastSpace = truncated.lastIndexOf(' ');
  return truncated.substring(0, lastSpace > 0 ? lastSpace : maxLen) + '...';
}

// --- Price normalization ---

const FREE_PATTERNS = [
  /\bfree\b/i,
  /\bgratis\b/i,
  /\bgratuito\b/i,
  /\bentrada\s*(libre|gratuita)\b/i,
  /\bsin\s*coste\b/i,
  /\bno\s*cover\b/i,
];

export function detectFree(priceInfo?: string, description?: string): boolean {
  const text = [priceInfo, description].filter(Boolean).join(' ');
  if (!text) return false;
  return FREE_PATTERNS.some(p => p.test(text));
}

// --- URL normalization ---

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content',
  'utm_term', 'fbclid', 'ref', 'source', 'mc_cid', 'mc_eid',
]);

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return parsed.toString();
  } catch {
    return url;
  }
}
