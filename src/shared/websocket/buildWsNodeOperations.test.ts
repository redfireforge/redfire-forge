/**
 * Tests for buildWsNodeOperations — the WebSocket operations bridge.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildWsNodeOperations } from './buildWsNodeOperations';
import { WsClientError } from './websocketClient';

vi.mock('./websocketClient', async (importOriginal) => {
  const orig = await importOriginal<typeof import('./websocketClient')>();
  return {
    ...orig,
    dispatchWsOperation: vi.fn(),
  };
});

import { dispatchWsOperation } from './websocketClient';
const mockDispatch = vi.mocked(dispatchWsOperation);

function envelope<T>(data: T) {
  return { ok: true, op: 'connect' as const, data };
}

describe('buildWsNodeOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('connect', () => {
    it('calls proxy connect and returns result', async () => {
      mockDispatch.mockResolvedValueOnce(envelope({
        connectionId: 'proxy-c1',
        protocol: 'graphql-ws',
        extensions: '',
      }));

      const ops = buildWsNodeOperations();
      const result = await ops.connect({
        url: 'ws://localhost:8080',
        headers: { 'X-Token': 'abc' },
        subprotocols: ['graphql-ws'],
        timeoutMs: 5000,
      });

      expect(mockDispatch).toHaveBeenCalledWith('connect', expect.objectContaining({
        url: 'ws://localhost:8080',
        headers: { 'X-Token': 'abc' },
        subprotocols: ['graphql-ws'],
        timeoutMs: 5000,
      }));
      expect(result.connectionId).toBe('proxy-c1');
      expect(result.protocol).toBe('graphql-ws');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('uses default timeout when not specified', async () => {
      mockDispatch.mockResolvedValueOnce(envelope({ connectionId: 'c2' }));

      const ops = buildWsNodeOperations();
      await ops.connect({ url: 'ws://localhost' });

      expect(mockDispatch).toHaveBeenCalledWith('connect', expect.objectContaining({
        timeoutMs: 10_000,
      }));
    });
  });

  describe('send', () => {
    it('sends a message using the user-facing connection label', async () => {
      mockDispatch
        .mockResolvedValueOnce(envelope({ connectionId: 'proxy-c1' }))
        .mockResolvedValueOnce(envelope({ bytesSent: 12 }));

      const ops = buildWsNodeOperations();
      await ops.connect({ url: 'ws://localhost', connectionId: 'ws1' });
      const result = await ops.send({ connectionId: 'ws1', data: 'hello world!' });

      expect(mockDispatch).toHaveBeenCalledWith('send', expect.objectContaining({
        connectionId: 'proxy-c1',
        data: 'hello world!',
        type: 'text',
      }));
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('defaults to text message type', async () => {
      mockDispatch.mockResolvedValueOnce(envelope({ bytesSent: 5 }));

      const ops = buildWsNodeOperations();
      await ops.send({ connectionId: 'c1', data: 'test' });

      expect(mockDispatch).toHaveBeenCalledWith('send', expect.objectContaining({ type: 'text' }));
    });

    it('sends binary message type when specified', async () => {
      mockDispatch.mockResolvedValueOnce(envelope({ bytesSent: 5 }));

      const ops = buildWsNodeOperations();
      await ops.send({ connectionId: 'c1', data: 'binary data', type: 'binary' });

      expect(mockDispatch).toHaveBeenCalledWith('send', expect.objectContaining({ type: 'binary' }));
    });
  });

  describe('waitForMessage', () => {
    it('returns the first message when no criteria', async () => {
      mockDispatch.mockResolvedValueOnce(envelope({
        messages: [{ data: '{"status":"ok"}', type: 'text', timestamp: 1000, cursor: 'c1' }],
        cursor: 'c1',
      }));

      const ops = buildWsNodeOperations();
      const msg = await ops.waitForMessage({ connectionId: 'c1', timeoutMs: 5000 });

      expect(msg.data).toBe('{"status":"ok"}');
      expect(msg.type).toBe('text');
    });

    it('filters by contentContains', async () => {
      mockDispatch
        .mockResolvedValueOnce(envelope({
          messages: [
            { data: 'ping', type: 'text', timestamp: 1000 },
            { data: 'response: ok', type: 'text', timestamp: 1001 },
          ],
          cursor: 'c2',
        }));

      const ops = buildWsNodeOperations();
      const msg = await ops.waitForMessage({
        connectionId: 'c1',
        timeoutMs: 5000,
        matchCriteria: { contentContains: 'response' },
      });

      expect(msg.data).toBe('response: ok');
    });

    it('filters by contentRegex', async () => {
      mockDispatch.mockResolvedValueOnce(envelope({
        messages: [
          { data: 'heartbeat', type: 'text', timestamp: 1000 },
          { data: 'event:user.created', type: 'text', timestamp: 1001 },
        ],
        cursor: 'c3',
      }));

      const ops = buildWsNodeOperations();
      const msg = await ops.waitForMessage({
        connectionId: 'c1',
        timeoutMs: 5000,
        matchCriteria: { contentRegex: '^event:' },
      });

      expect(msg.data).toBe('event:user.created');
    });

    it('throws WsClientError on timeout', async () => {
      mockDispatch.mockResolvedValue(envelope({ messages: [], cursor: 'c0' }));

      const ops = buildWsNodeOperations();
      await expect(
        ops.waitForMessage({ connectionId: 'c1', timeoutMs: 50 }),
      ).rejects.toThrow(WsClientError);
    });

    it('filters by messageType', async () => {
      mockDispatch.mockResolvedValueOnce(envelope({
        messages: [
          { data: 'text-msg', type: 'text', timestamp: 1000 },
          { data: 'binary-msg', type: 'binary', timestamp: 1001 },
        ],
        cursor: 'c4',
      }));

      const ops = buildWsNodeOperations();
      const msg = await ops.waitForMessage({
        connectionId: 'c1',
        timeoutMs: 5000,
        matchCriteria: { messageType: 'binary' },
      });

      expect(msg.data).toBe('binary-msg');
      expect(msg.type).toBe('binary');
    });
  });

  describe('disconnect', () => {
    it('calls proxy disconnect and removes from registry', async () => {
      mockDispatch
        .mockResolvedValueOnce(envelope({ connectionId: 'proxy-c1' }))
        .mockResolvedValueOnce(envelope(undefined));

      const ops = buildWsNodeOperations();
      await ops.connect({ url: 'ws://localhost' });
      await ops.disconnect({ connectionId: 'proxy-c1' });

      expect(mockDispatch).toHaveBeenCalledWith('disconnect', expect.objectContaining({
        connectionId: 'proxy-c1',
      }));
    });

    it('passes close code and reason', async () => {
      mockDispatch.mockResolvedValueOnce(envelope(undefined));

      const ops = buildWsNodeOperations();
      await ops.disconnect({ connectionId: 'c1', code: 1000, reason: 'normal' });

      expect(mockDispatch).toHaveBeenCalledWith('disconnect', expect.objectContaining({
        code: 1000,
        reason: 'normal',
      }));
    });
  });

  describe('disconnectAll', () => {
    it('disconnects all registered connections', async () => {
      mockDispatch
        .mockResolvedValueOnce(envelope({ connectionId: 'proxy-a' }))
        .mockResolvedValueOnce(envelope({ connectionId: 'proxy-b' }))
        .mockResolvedValueOnce(envelope(undefined))
        .mockResolvedValueOnce(envelope(undefined));

      const ops = buildWsNodeOperations();
      await ops.connect({ url: 'ws://a' });
      await ops.connect({ url: 'ws://b' });

      await ops.disconnectAll();

      const disconnectCalls = mockDispatch.mock.calls.filter(c => c[0] === 'disconnect');
      expect(disconnectCalls).toHaveLength(2);
    });

    it('ignores individual disconnect failures', async () => {
      mockDispatch
        .mockResolvedValueOnce(envelope({ connectionId: 'proxy-a' }))
        .mockRejectedValueOnce(new Error('connection lost'));

      const ops = buildWsNodeOperations();
      await ops.connect({ url: 'ws://a' });

      await expect(ops.disconnectAll()).resolves.not.toThrow();
    });
  });

  describe('snapshotCursor', () => {
    it('returns cursor from messages endpoint', async () => {
      mockDispatch
        .mockResolvedValueOnce(envelope({ connectionId: 'proxy-c1' }))
        .mockResolvedValueOnce(envelope({ messages: [], cursor: 'cursor-42' }));

      const ops = buildWsNodeOperations();
      await ops.connect({ url: 'ws://test', connectionId: 'c1' });
      const cursor = await ops.snapshotCursor({ connectionId: 'c1' });
      expect(cursor).toBe('cursor-42');
    });

    it('uses connectionId directly when registry has no mapping', async () => {
      mockDispatch.mockResolvedValueOnce(envelope({ messages: [], cursor: 'direct-cursor' }));

      const ops = buildWsNodeOperations();
      const cursor = await ops.snapshotCursor({ connectionId: 'unregistered-id' });

      expect(cursor).toBe('direct-cursor');
      expect(mockDispatch).toHaveBeenCalledWith('messages', { connectionId: 'unregistered-id' });
    });

    it('returns undefined when no cursor', async () => {
      mockDispatch
        .mockResolvedValueOnce(envelope({ connectionId: 'proxy-c1' }))
        .mockResolvedValueOnce(envelope({ messages: [] }));

      const ops = buildWsNodeOperations();
      await ops.connect({ url: 'ws://test', connectionId: 'c1' });
      const cursor = await ops.snapshotCursor({ connectionId: 'c1' });
      expect(cursor).toBeUndefined();
    });
  });

  describe('waitForMessage — jsonPath', () => {
    it('matches by jsonPathMatch', async () => {
      mockDispatch
        .mockResolvedValueOnce(envelope({ connectionId: 'proxy-c1' }))
        .mockResolvedValueOnce(envelope({
          messages: [{ data: '{"status":"ready"}', type: 'text' }],
          cursor: 'c1',
        }));

      const ops = buildWsNodeOperations();
      await ops.connect({ url: 'ws://test', connectionId: 'c1' });
      const msg = await ops.waitForMessage({
        connectionId: 'c1',
        timeoutMs: 1000,
        matchCriteria: { jsonPathMatch: 'status' },
      });
      expect(msg.data).toBe('{"status":"ready"}');
    });

    it('matches by jsonPathMatch with jsonPathValue', async () => {
      mockDispatch
        .mockResolvedValueOnce(envelope({ connectionId: 'proxy-c1' }))
        .mockResolvedValueOnce(envelope({
          messages: [
            { data: '{"status":"pending"}', type: 'text' },
            { data: '{"status":"ready"}', type: 'text' },
          ],
          cursor: 'c2',
        }));

      const ops = buildWsNodeOperations();
      await ops.connect({ url: 'ws://test', connectionId: 'c1' });
      const msg = await ops.waitForMessage({
        connectionId: 'c1',
        timeoutMs: 1000,
        matchCriteria: { jsonPathMatch: 'status', jsonPathValue: 'ready' },
      });
      expect(msg.data).toBe('{"status":"ready"}');
    });

    it('rejects jsonPath match on non-JSON data', async () => {
      mockDispatch
        .mockResolvedValueOnce(envelope({ connectionId: 'proxy-c1' }))
        .mockResolvedValueOnce(envelope({
          messages: [{ data: 'not-json', type: 'text' }],
          cursor: 'c1',
        }))
        .mockResolvedValueOnce(envelope({ messages: [], cursor: 'c2' }));

      const ops = buildWsNodeOperations();
      await ops.connect({ url: 'ws://test', connectionId: 'c1' });
      await expect(ops.waitForMessage({
        connectionId: 'c1',
        timeoutMs: 300,
        matchCriteria: { jsonPathMatch: 'status' },
      })).rejects.toThrow('timed out');
    });
  });

  describe('waitForMessage — abort', () => {
    it('throws WS_ABORTED when abortSignal is aborted', async () => {
      mockDispatch.mockResolvedValueOnce(envelope({ connectionId: 'proxy-c1' }));

      const controller = new AbortController();
      controller.abort();

      const ops = buildWsNodeOperations();
      await ops.connect({ url: 'ws://test', connectionId: 'c1' });
      await expect(ops.waitForMessage({
        connectionId: 'c1',
        timeoutMs: 5000,
        abortSignal: controller.signal,
      })).rejects.toThrow('aborted');
    });
  });

  describe('waitForMessage — contentRegex', () => {
    it('rejects invalid regex gracefully', async () => {
      mockDispatch
        .mockResolvedValueOnce(envelope({ connectionId: 'proxy-c1' }))
        .mockResolvedValueOnce(envelope({
          messages: [{ data: 'hello', type: 'text' }],
          cursor: 'c1',
        }))
        .mockResolvedValueOnce(envelope({ messages: [], cursor: 'c2' }));

      const ops = buildWsNodeOperations();
      await ops.connect({ url: 'ws://test', connectionId: 'c1' });
      await expect(ops.waitForMessage({
        connectionId: 'c1',
        timeoutMs: 300,
        matchCriteria: { contentRegex: '[invalid' },
      })).rejects.toThrow('timed out');
    });
  });

  describe('connect error handling', () => {
    it('throws when proxy returns success without data', async () => {
      mockDispatch.mockResolvedValueOnce(envelope(undefined));

      const ops = buildWsNodeOperations();
      await expect(ops.connect({ url: 'ws://test' })).rejects.toThrow('missing data');
    });
  });

  describe('waitForMessage — messageType any', () => {
    it('accepts any message type when criteria is any', async () => {
      mockDispatch.mockResolvedValueOnce(envelope({
        messages: [{ data: 'binary-msg', type: 'binary', timestamp: 1000 }],
        cursor: 'c1',
      }));

      const ops = buildWsNodeOperations();
      const msg = await ops.waitForMessage({
        connectionId: 'c1',
        timeoutMs: 5000,
        matchCriteria: { messageType: 'any' },
      });

      expect(msg.data).toBe('binary-msg');
    });
  });

  describe('waitForMessage — jsonPath string value', () => {
    it('matches jsonPathValue against string field values', async () => {
      mockDispatch.mockResolvedValueOnce(envelope({
        messages: [{ data: '{"status":"ready"}', type: 'text' }],
        cursor: 'c1',
      }));

      const ops = buildWsNodeOperations();
      const msg = await ops.waitForMessage({
        connectionId: 'c1',
        timeoutMs: 1000,
        matchCriteria: { jsonPathMatch: 'status', jsonPathValue: 'ready' },
      });
      expect(msg.data).toContain('ready');
    });

    it('matches jsonPathValue against non-string JSON values', async () => {
      mockDispatch.mockResolvedValueOnce(envelope({
        messages: [{ data: '{"count":42}', type: 'text' }],
        cursor: 'c1',
      }));

      const ops = buildWsNodeOperations();
      const msg = await ops.waitForMessage({
        connectionId: 'c1',
        timeoutMs: 1000,
        matchCriteria: { jsonPathMatch: 'count', jsonPathValue: '42' },
      });
      expect(msg.data).toBe('{"count":42}');
    });
  });

  describe('waitForMessage — polling with sinceCursor', () => {
    it('advances cursor across polls until a match arrives', async () => {
      mockDispatch
        .mockResolvedValueOnce(envelope({ messages: [], cursor: 'c0' }))
        .mockResolvedValueOnce(envelope({
          messages: [{ data: 'late', type: 'text', timestamp: 1000 }],
          cursor: 'c1',
        }));

      const ops = buildWsNodeOperations();
      const msg = await ops.waitForMessage({
        connectionId: 'c1',
        timeoutMs: 1000,
        sinceCursor: 'c0',
      });
      expect(msg.data).toBe('late');
    });

    it('handles missing envelope data and default message type', async () => {
      mockDispatch.mockResolvedValueOnce({
        ok: true,
        op: 'messages',
        data: undefined,
      } as never);

      const ops = buildWsNodeOperations();
      await expect(ops.waitForMessage({
        connectionId: 'c1',
        timeoutMs: 50,
      })).rejects.toThrow('timed out');
    });

    it('skips messages that fail jsonPath matching without a value constraint', async () => {
      mockDispatch
        .mockResolvedValueOnce(envelope({
          messages: [{ data: '{"status":"pending"}', type: 'text' }],
          cursor: 'c1',
        }))
        .mockResolvedValueOnce(envelope({ messages: [], cursor: 'c2' }));

      const ops = buildWsNodeOperations();
      await expect(ops.waitForMessage({
        connectionId: 'c1',
        timeoutMs: 300,
        matchCriteria: { jsonPathMatch: 'missing.path' },
      })).rejects.toThrow('timed out');
    });

    it('defaults missing message type to text for criteria matching', async () => {
      mockDispatch.mockResolvedValueOnce(envelope({
        messages: [{ data: 'plain-text', timestamp: 1000 }],
        cursor: 'c1',
      }));

      const ops = buildWsNodeOperations();
      const msg = await ops.waitForMessage({
        connectionId: 'c1',
        timeoutMs: 1000,
        matchCriteria: { messageType: 'text' },
      });
      expect(msg.data).toBe('plain-text');
      expect(msg.type).toBe('text');
    });

    it('handles null messages array in envelope data', async () => {
      mockDispatch.mockResolvedValueOnce({
        ok: true,
        op: 'messages',
        data: { messages: null, cursor: 'c1' },
      } as never);

      const ops = buildWsNodeOperations();
      await expect(ops.waitForMessage({
        connectionId: 'c1',
        timeoutMs: 50,
      })).rejects.toThrow('timed out');
    });

    it('breaks immediately when deadline is already elapsed', async () => {
      mockDispatch.mockResolvedValue(envelope({ messages: [], cursor: 'c1' }));

      const ops = buildWsNodeOperations();
      await expect(ops.waitForMessage({
        connectionId: 'c1',
        timeoutMs: 0,
      })).rejects.toThrow('timed out');
    });

    it('rejects when jsonPath value does not match', async () => {
      mockDispatch
        .mockResolvedValueOnce(envelope({
          messages: [{ data: '{"status":"pending"}', type: 'text' }],
          cursor: 'c1',
        }))
        .mockResolvedValueOnce(envelope({ messages: [], cursor: 'c2' }));

      const ops = buildWsNodeOperations();
      await expect(ops.waitForMessage({
        connectionId: 'c1',
        timeoutMs: 300,
        matchCriteria: { jsonPathMatch: 'status', jsonPathValue: 'ready' },
      })).rejects.toThrow('timed out');
    });

    it('matches jsonPath value when the path value is a non-string (uses JSON.stringify)', async () => {
      // value is a number: 42 → strVal = '42' → compare to jsonPathValue '42'
      mockDispatch.mockResolvedValueOnce(envelope({
        messages: [{ data: '{"code":42}', type: 'text', timestamp: 1000 }],
        cursor: 'c1',
      }));

      const ops = buildWsNodeOperations();
      const msg = await ops.waitForMessage({
        connectionId: 'c1',
        timeoutMs: 1000,
        matchCriteria: { jsonPathMatch: 'code', jsonPathValue: '42' },
      });
      expect(msg.data).toBe('{"code":42}');
    });
  });

  describe('connect — coverage gaps', () => {
    it('does not register user label when connectionId is undefined', async () => {
      mockDispatch
        .mockResolvedValueOnce(envelope({ connectionId: 'proxy-x' }))
        .mockResolvedValueOnce(envelope({ messages: [{ data: 'hi', timestamp: 1000 }], cursor: 'c1' }));

      const ops = buildWsNodeOperations();
      // No connectionId — registry should only have proxy-x → proxy-x
      await ops.connect({ url: 'ws://test' }); // params.connectionId is undefined → false branch
      const msg = await ops.waitForMessage({ connectionId: 'proxy-x', timeoutMs: 1000 });
      expect(msg.data).toBe('hi');
    });
  });

  describe('waitForMessage — cursor update', () => {
    it('does not update cursor when data.cursor is falsy', async () => {
      mockDispatch
        .mockResolvedValueOnce(envelope({ messages: [], cursor: '' })) // falsy cursor
        .mockResolvedValueOnce(envelope({ messages: [{ data: 'found', timestamp: 1000 }], cursor: 'c1' }));

      const ops = buildWsNodeOperations();
      const msg = await ops.waitForMessage({
        connectionId: 'c1',
        timeoutMs: 1000,
        sinceCursor: 'initial',
      });
      expect(msg.data).toBe('found');
    });
  });
});
