/**
 * WebSocket Gallery — standalone protocol samples.
 *
 * This domain surfaces WebSocket-specific request/test entries (echo, subscribe,
 * JSON feed, auth handshake) as a dedicated gallery tab, distinct from the general
 * `workflows` and `tests` domains.
 *
 * Scaffold: catalog is empty — entries will be added in a future phase.
 */

import type { WsSampleEntry } from './types';

export type { WsSampleEntry } from './types';
export type { WsSampleCategory } from './types';

export const wsSampleCatalog: WsSampleEntry[] = [];
