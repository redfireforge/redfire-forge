import type { GalleryEntry } from '../types';
import type { SseConnectionConfig } from '../../../features/sse/sseTypes';

export type SseSampleCategory = 'public-feed' | 'auth' | 'json-events' | 'retry';

export interface SseSampleEntry extends GalleryEntry<SseConnectionConfig> {
  category: SseSampleCategory;
  /** Typical event types this endpoint emits. */
  eventTypes: string[];
}
