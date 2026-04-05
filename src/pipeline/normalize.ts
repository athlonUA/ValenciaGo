import type { RawEvent, NormalizedEvent } from '../types/index.js';
import {
  normalizeTitle, fingerprintTitle, stripHtml, decodeHtmlEntities,
  detectFree, normalizeUrl,
} from '../utils/normalize.js';
import { classifyEvent } from '../utils/classify.js';
import { computeContentHash } from '../utils/hash.js';
import { parseEventDate } from '../utils/dates.js';

/**
 * Transform a RawEvent into a NormalizedEvent.
 * Applies title normalization, date parsing, category classification,
 * price detection, and content hashing.
 */
export function normalizeRawEvent(source: string, raw: RawEvent): NormalizedEvent {
  const title = normalizeTitle(raw.title);
  const titleNormalized = fingerprintTitle(raw.title);

  const startsAt = parseEventDate(raw.startsAt);
  const endsAt = raw.endsAt ? tryParseDate(raw.endsAt) : undefined;

  const description = raw.description
    ? stripHtml(decodeHtmlEntities(raw.description)).substring(0, 5000)
    : undefined;

  const isFree = detectFree(raw.priceInfo, description);

  const { category, tags } = classifyEvent(titleNormalized, description);

  const contentHash = computeContentHash(titleNormalized, startsAt, 'Valencia');

  return {
    source,
    sourceId: raw.sourceId,
    sourceUrl: normalizeUrl(raw.sourceUrl),
    title,
    titleNormalized,
    description,
    category,
    tags,
    city: 'Valencia',
    venue: raw.venue?.trim(),
    address: raw.address?.trim(),
    latitude: raw.latitude,
    longitude: raw.longitude,
    startsAt,
    endsAt,
    priceInfo: raw.priceInfo?.trim(),
    isFree,
    language: raw.language ?? 'es',
    imageUrl: raw.imageUrl,
    rawPayload: raw.rawPayload,
    contentHash,
  };
}

function tryParseDate(raw: string): Date | undefined {
  try {
    return parseEventDate(raw);
  } catch {
    return undefined;
  }
}
