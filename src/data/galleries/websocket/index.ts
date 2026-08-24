/**
 * WebSocket Gallery — standalone protocol samples.
 *
 * This domain surfaces WebSocket-specific request/test entries (echo, subscribe,
 * JSON feed, auth handshake) as a dedicated gallery tab, distinct from the general
 * `workflows` and `tests` domains.
 */

import { createWsEchoTest, createWsSubscribeTest } from '../tests/presets-websocket';
import type { WsSampleEntry } from './types';

export type { WsSampleEntry } from './types';
export type { WsSampleCategory } from './types';

export const wsSampleCatalog: WsSampleEntry[] = [
  {
    id: 'ws-echo-smoke',
    domain: 'websocket',
    name: 'WebSocket Echo Smoke Test',
    description:
      'Connect to echo.websocket.org, send "ping", receive the echo, and assert the message body — the simplest possible WebSocket test.',
    icon: '⚡',
    category: 'echo',
    difficulty: 'easy',
    tags: ['websocket', 'echo', 'smoke'],
    liveApis: ['echo.websocket.org'],
    scenarioCount: 3,
    assertionTypes: ['wsField'],
    factory: createWsEchoTest,
  },
  {
    id: 'ws-subscribe-json',
    domain: 'websocket',
    name: 'WebSocket JSON Subscribe & Assert',
    description:
      'Connect to the Binance BTC/USDT trade stream, receive the first message, and assert the event type and symbol fields.',
    icon: '⚡',
    category: 'subscribe',
    difficulty: 'medium',
    tags: ['websocket', 'json', 'subscribe', 'binance'],
    liveApis: ['stream.binance.com'],
    scenarioCount: 2,
    assertionTypes: ['wsField'],
    factory: createWsSubscribeTest,
  },
];
