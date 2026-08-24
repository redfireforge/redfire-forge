/**
 * SSE Gallery — Server-Sent Events connection samples.
 *
 * Each entry holds a ready-to-use SseConnectionConfig that can be loaded
 * directly into the SSE Studio connection form.
 *
 * Public endpoints used:
 *   - https://sse.dev/test           — free public SSE echo/broadcast server
 *   - https://hacker-news.firebaseio.com/v0/updates.json — HN live item stream
 */

import type { SseSampleEntry } from './types';

export type { SseSampleEntry } from './types';
export type { SseSampleCategory } from './types';

export const sseSampleCatalog: SseSampleEntry[] = [
  {
    id: 'sse-public-echo',
    domain: 'sse',
    name: 'SSE Public Echo Feed',
    description:
      'Connect to sse.dev/test — a free public SSE echo server that broadcasts a new message every 5 seconds. Ideal first SSE connection.',
    icon: '📶',
    category: 'public-feed',
    difficulty: 'easy',
    tags: ['sse', 'public', 'echo', 'smoke'],
    liveApis: ['sse.dev'],
    eventTypes: ['message'],
    factory: () => ({
      url: 'https://sse.dev/test',
      headers: [],
      autoReconnect: true,
      maxRetries: 5,
    }),
  },
  {
    id: 'sse-hacker-news-updates',
    domain: 'sse',
    name: 'Hacker News Live Updates',
    description:
      'Subscribe to the Hacker News Firebase real-time stream — receives item and profile IDs whenever stories or comments are updated.',
    icon: '📰',
    category: 'json-events',
    difficulty: 'easy',
    tags: ['sse', 'hacker-news', 'real-time', 'json', 'public'],
    liveApis: ['hacker-news.firebaseio.com'],
    eventTypes: ['put', 'patch'],
    factory: () => ({
      url: 'https://hacker-news.firebaseio.com/v0/updates.json',
      headers: [{ key: 'Accept', value: 'text/event-stream', enabled: true }],
      autoReconnect: true,
      maxRetries: 5,
    }),
  },
  {
    id: 'sse-auth-bearer',
    domain: 'sse',
    name: 'SSE with Bearer Auth',
    description:
      'Template showing how to configure a Bearer-token Authorization header for a protected SSE endpoint. Replace the URL and token with your own.',
    icon: '🔐',
    category: 'auth',
    difficulty: 'medium',
    tags: ['sse', 'auth', 'bearer', 'token', 'headers'],
    liveApis: [],
    eventTypes: ['message', 'data'],
    factory: () => ({
      url: 'https://example.com/api/events',
      headers: [
        { key: 'Authorization', value: 'Bearer YOUR_TOKEN_HERE', enabled: true },
        { key: 'Accept', value: 'text/event-stream', enabled: true },
      ],
      autoReconnect: true,
      maxRetries: 3,
    }),
  },
  {
    id: 'sse-retry-reconnect',
    domain: 'sse',
    name: 'SSE Auto-Reconnect Demo',
    description:
      'Demonstrates the auto-reconnect policy: set to 10 retries with Last-Event-ID tracking so the server can resume the stream from where it left off.',
    icon: '🔄',
    category: 'retry',
    difficulty: 'medium',
    tags: ['sse', 'reconnect', 'last-event-id', 'resilience'],
    liveApis: ['sse.dev'],
    eventTypes: ['message'],
    factory: () => ({
      url: 'https://sse.dev/test',
      headers: [],
      autoReconnect: true,
      maxRetries: 10,
    }),
  },
];
