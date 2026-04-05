import type { EventCategory } from './category.js';

/** What source adapters produce — raw, unprocessed data from external sources */
export interface RawEvent {
  sourceId: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  venue?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  sourceUrl: string;
  imageUrl?: string;
  priceInfo?: string;
  language?: string;
  rawPayload?: Record<string, unknown>;
}

/** After normalization — cleaned, typed, ready for storage */
export interface NormalizedEvent {
  source: string;
  sourceId: string;
  sourceUrl: string;
  title: string;
  titleNormalized: string;
  description?: string;
  category: EventCategory;
  tags: string[];
  city: string;
  venue?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  startsAt: Date;
  endsAt?: Date;
  priceInfo?: string;
  isFree: boolean;
  language: string;
  imageUrl?: string;
  rawPayload?: Record<string, unknown>;
  contentHash: string;
}

/** What the database returns */
export interface StoredEvent extends NormalizedEvent {
  id: string;
  summary?: string;
  emoji?: string;
  aiPrice?: string;
  aiTime?: string;
  createdAt: Date;
  updatedAt: Date;
  ingestedAt: Date;
}

/** Result of an ingestion run */
export interface IngestResult {
  source: string;
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ sourceId: string; error: string }>;
}
