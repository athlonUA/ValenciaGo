import type { StoredEvent } from '../types/index.js';
import type { EventCategory } from '../types/category.js';

export function rowToStoredEvent(row: Record<string, unknown>): StoredEvent {
  return {
    id: row.id as string,
    source: row.source as string,
    sourceId: row.source_id as string,
    sourceUrl: row.source_url as string,
    title: row.title as string,
    titleNormalized: row.title_normalized as string,
    description: row.description as string | undefined,
    category: row.category as EventCategory,
    tags: (row.tags as string[]) || [],
    city: row.city as string,
    venue: row.venue as string | undefined,
    address: row.address as string | undefined,
    latitude: row.latitude ? Number(row.latitude) : undefined,
    longitude: row.longitude ? Number(row.longitude) : undefined,
    startsAt: new Date(row.starts_at as string),
    endsAt: row.ends_at ? new Date(row.ends_at as string) : undefined,
    priceInfo: row.price_info as string | undefined,
    isFree: row.is_free as boolean,
    language: (row.language as string) || 'es',
    imageUrl: row.image_url as string | undefined,
    rawPayload: row.raw_payload as Record<string, unknown> | undefined,
    contentHash: row.content_hash as string,
    summary: row.summary as string | undefined,
    summaryUk: row.summary_uk as string | undefined,
    summaryEs: row.summary_es as string | undefined,
    emoji: row.emoji as string | undefined,
    aiPrice: row.ai_price as string | undefined,
    aiTime: row.ai_time as string | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    ingestedAt: new Date(row.ingested_at as string),
  };
}
