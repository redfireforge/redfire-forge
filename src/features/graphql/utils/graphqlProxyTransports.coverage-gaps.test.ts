/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseSseStream,
  subscribeThroughSseProxy,
  createWsProxyTransport,
  createSseProxyTransport,
} from './graphqlProxyTransports';

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

vi.mock('./authUtils', () => ({
  buildAuthHeaders: vi.fn(() => ({})),
  buildConnectionParams: vi.fn(() => ({})),
}));

function sseBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[i++]));
    },
  });
}

describe('graphqlProxyTransports — coverage gaps', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parseSseStream yields events from chunked SSE frames', async () => {
    const stream = sseBody([
      'event: connected\ndata: {}\n\n',
      'event: next\ndata: {"data":{"x":1}}\n\n',
    ]);
    const events: string[] = [];
    for await (const { event } of parseSseStream(stream)) {
      events.push(event);
    }
    expect(events).toEqual(['connected', 'next']);
  });

  it('subscribeThroughSseProxy reports HTTP errors with JSON message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => JSON.stringify({ error: { message: 'upstream down' } }),
    });
    const onError = vi.fn();
    const unsub = subscribeThroughSseProxy(
      '/api/graphql/subscribe',
      { method: 'POST', body: '{}' },
      undefined,
      { onMessage: vi.fn(), onError, onComplete: vi.fn() },
    );
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith('upstream down'));
    unsub();
  });

  it('createWsProxyTransport returns early when signal already aborted', () => {
    const transport = createWsProxyTransport();
    const onError = vi.fn();
    const ctrl = new AbortController();
    ctrl.abort();
    transport.subscribe(
      'subscription { x }',
      {},
      'Sub',
      { endpoint: 'http://x/graphql', headers: {}, signal: ctrl.signal },
      { onMessage: vi.fn(), onError, onComplete: vi.fn() },
    );
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('Aborted'));
  });

  it('createSseProxyTransport uses GET when TLS post proxy not needed', () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: sseBody(['event: complete\ndata: {}\n\n']),
    });
    const transport = createSseProxyTransport();
    const unsub = transport.subscribe(
      'subscription { y }',
      { a: 1 },
      undefined,
      { endpoint: 'http://x/graphql', headers: {}, skipTlsVerify: false },
      { onMessage: vi.fn(), onError: vi.fn(), onComplete: vi.fn() },
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/graphql/sse?'),
      expect.objectContaining({ method: 'GET' }),
    );
    unsub();
  });
});
