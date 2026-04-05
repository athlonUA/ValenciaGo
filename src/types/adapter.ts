import type { RawEvent } from './event.js';

/** Contract for all source adapters */
export interface SourceAdapter {
  readonly name: string;
  readonly enabled: boolean;
  fetchEvents(): Promise<RawEvent[]>;
}
