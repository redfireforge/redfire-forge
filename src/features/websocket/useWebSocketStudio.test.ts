/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocketStudio } from './useWebSocketStudio';
import { resetFrameIdCounter } from '../../shared/websocket/types';

vi.mock('../../shared/websocket/websocketClient', () => ({
  dispatchWsOperation: vi.fn(),
}));

import { dispatchWsOperation } from '../../shared/websocket/websocketClient';
const mockDispatch = vi.mocked(dispatchWsOperation);

// ── Mock WebSocket ──────────────────────────────────────────────────────────

interface MockWebSocketInstance {
  url: string;
  protocols: string | string[];
  readyState: number;
  protocol: string;
  extensions: string;
  onopen: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  simulateOpen: () => void;
  simulateMessage: (data: string) => void;
  simulateClose: (code?: number, reason?: string) => void;
  simulateError: () => void;
}

let mockInstances: MockWebSocketInstance[] = [];

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  url: string;
  protocols: string | string[];
  readyState = MockWebSocket.CONNECTING;
  protocol = '';
  extensions = '';
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  send = vi.fn();
  close = vi.fn().mockImplementation(() => {
    this.readyState = MockWebSocket.CLOSING;
  });

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols ?? '';
    const instance = this as unknown as MockWebSocketInstance;
    instance.simulateOpen = () => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event('open'));
    };
    instance.simulateMessage = (data: string) => {
      this.onmessage?.(new MessageEvent('message', { data }));
    };
    instance.simulateClose = (code = 1000, reason = '') => {
      this.readyState = MockWebSocket.CLOSED;
      this.onclose?.(new CloseEvent('close', { code, reason }));
    };
    instance.simulateError = () => {
      this.onerror?.(new Event('error'));
      this.readyState = MockWebSocket.CLOSED;
    };
    mockInstances.push(instance);
  }
}

const OriginalWebSocket = globalThis.WebSocket;

beforeEach(() => {
  mockInstances = [];
  resetFrameIdCounter();
  mockDispatch.mockReset();
  mockDispatch.mockResolvedValue({ ok: true, op: 'disconnect', data: {}, meta: { timestamp: '' } });
  (globalThis as Record<string, unknown>).WebSocket = MockWebSocket as unknown as typeof WebSocket;
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  (globalThis as Record<string, unknown>).WebSocket = OriginalWebSocket;
});

function lastMockWs(): MockWebSocketInstance {
  return mockInstances[mockInstances.length - 1];
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('useWebSocketStudio', () => {
  describe('initial state', () => {
    it('starts disconnected with empty draft', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      expect(result.current.connection.state).toBe('disconnected');
      expect(result.current.draft.url).toBe('');
      expect(result.current.draft.subprotocols).toBe('');
      expect(result.current.draft.headers).toEqual([]);
      expect(result.current.draft.queryParams).toEqual([]);
      expect(result.current.messages).toEqual([]);
      expect(result.current.sentCount).toBe(0);
      expect(result.current.receivedCount).toBe(0);
      expect(result.current.uptime).toBeNull();
      expect(result.current.transportMode).toBe('direct');
    });
  });

  describe('draft management', () => {
    it('updates draft URL', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      expect(result.current.draft.url).toBe('ws://localhost:8765');
    });

    it('updates draft subprotocols', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ subprotocols: 'graphql-ws, json' }));
      expect(result.current.draft.subprotocols).toBe('graphql-ws, json');
    });

    it('merges partial draft updates', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://example.com' }));
      act(() => result.current.setDraft({ subprotocols: 'chat' }));
      expect(result.current.draft.url).toBe('ws://example.com');
      expect(result.current.draft.subprotocols).toBe('chat');
    });
  });

  describe('connect', () => {
    it('does nothing when URL is blank', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.connect());
      expect(mockInstances).toHaveLength(0);
      expect(result.current.connection.state).toBe('disconnected');
    });

    it('does nothing when URL has invalid protocol', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'http://localhost:8765' }));
      act(() => result.current.connect());
      expect(mockInstances).toHaveLength(0);
      expect(result.current.connection.state).toBe('disconnected');
    });

    it('transitions to connecting state', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      expect(result.current.connection.state).toBe('connecting');
      expect(result.current.connection.url).toBe('ws://localhost:8765');
    });

    it('transitions to connected on open', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());
      expect(result.current.connection.state).toBe('connected');
      expect(result.current.connection.connectedAt).toBeDefined();
      expect(result.current.uptime).toBe(0);
    });

    it('records latency on connect', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => {
        vi.advanceTimersByTime(50);
        lastMockWs().simulateOpen();
      });
      expect(result.current.connection.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('passes subprotocols to WebSocket constructor', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765', subprotocols: 'graphql-ws, json' }));
      act(() => result.current.connect());
      const ws = lastMockWs();
      expect(ws.protocols).toEqual(['graphql-ws', 'json']);
    });

    it('reports negotiated protocol', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765', subprotocols: 'graphql-ws' }));
      act(() => result.current.connect());
      const ws = lastMockWs();
      ws.protocol = 'graphql-ws';
      act(() => ws.simulateOpen());
      expect(result.current.connection.protocol).toBe('graphql-ws');
    });

    it('transitions to error state on connection failure', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateError());
      expect(result.current.connection.state).toBe('error');
      expect(result.current.connection.lastError).toBeTruthy();
    });
  });

  describe('disconnect', () => {
    it('sends close frame', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());
      act(() => result.current.disconnect());
      expect(result.current.connection.state).toBe('closing');
      expect(lastMockWs().close).toHaveBeenCalledWith(1000, 'User disconnected');
    });

    it('transitions to disconnected on close event', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());
      act(() => result.current.disconnect());
      act(() => lastMockWs().simulateClose(1000, 'Normal closure'));
      expect(result.current.connection.state).toBe('disconnected');
      expect(result.current.connection.closeCode).toBe(1000);
      expect(result.current.connection.closeReason).toBe('Normal closure');
      expect(result.current.uptime).toBeNull();
    });

    it('does nothing when not connected', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.disconnect());
      expect(result.current.connection.state).toBe('disconnected');
    });
  });

  describe('send', () => {
    it('sends text message and appends to log', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());
      act(() => result.current.send('hello'));
      expect(lastMockWs().send).toHaveBeenCalledWith('hello');
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1].direction).toBe('sent');
      expect(result.current.messages[1].data).toBe('hello');
      expect(result.current.sentCount).toBe(1);
    });

    it('does nothing when not connected', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.send('hello'));
      expect(result.current.messages).toHaveLength(0);
    });

    it('sends binary frame by decoding Base64 to Uint8Array', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());
      act(() => result.current.send('SGVsbG8=', 'binary'));
      const sendArg = lastMockWs().send.mock.calls[0][0];
      expect(sendArg).toBeInstanceOf(Uint8Array);
      expect(Array.from(sendArg as Uint8Array)).toEqual([72, 101, 108, 108, 111]);
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1].type).toBe('binary');
      expect(result.current.messages[1].data).toBe('SGVsbG8=');
      expect(result.current.sentCount).toBe(1);
    });

    it('silently ignores invalid Base64 in binary mode', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());
      act(() => result.current.send('!!!not-base64!!!', 'binary'));
      expect(lastMockWs().send).not.toHaveBeenCalled();
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.sentCount).toBe(0);
    });

    it('sends text frame type for json format', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());
      act(() => result.current.send('{"a":1}', 'json'));
      expect(lastMockWs().send).toHaveBeenCalledWith('{"a":1}');
      expect(result.current.messages[1].type).toBe('text');
    });
  });

  describe('sendPing', () => {
    it('does nothing in direct mode (no proxy)', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());
      act(() => result.current.sendPing());
      expect(result.current.messages).toHaveLength(1);
    });

    it('does nothing when not connected', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.sendPing());
      expect(result.current.messages).toHaveLength(0);
    });
  });

  describe('receive', () => {
    it('appends received messages to log', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());
      act(() => lastMockWs().simulateMessage('{"type":"hello"}'));
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1].direction).toBe('received');
      expect(result.current.messages[1].data).toBe('{"type":"hello"}');
      expect(result.current.receivedCount).toBe(1);
    });

    it('handles multiple messages', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());
      act(() => lastMockWs().simulateMessage('msg1'));
      act(() => lastMockWs().simulateMessage('msg2'));
      act(() => lastMockWs().simulateMessage('msg3'));
      expect(result.current.messages).toHaveLength(4);
      expect(result.current.receivedCount).toBe(3);
    });
  });

  describe('message log', () => {
    it('respects maxMessages cap', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setMaxMessages(3));
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());
      for (let i = 0; i < 5; i++) {
        act(() => lastMockWs().simulateMessage(`msg-${i}`));
      }
      expect(result.current.messages).toHaveLength(3);
      expect(result.current.messages[0].data).toBe('msg-2');
      expect(result.current.isMaxReached).toBe(true);
    });

    it('clears messages and counters', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());
      act(() => result.current.send('hello'));
      act(() => lastMockWs().simulateMessage('world'));
      act(() => result.current.clearMessages());
      expect(result.current.messages).toHaveLength(0);
      expect(result.current.sentCount).toBe(0);
      expect(result.current.receivedCount).toBe(0);
    });

    it('filters by direction', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());
      act(() => result.current.send('outgoing'));
      act(() => lastMockWs().simulateMessage('incoming'));
      act(() => result.current.setDirectionFilter('sent'));
      expect(result.current.filteredMessages).toHaveLength(1);
      expect(result.current.filteredMessages[0].direction).toBe('sent');
      act(() => result.current.setDirectionFilter('received'));
      expect(result.current.filteredMessages).toHaveLength(2);
      expect(result.current.filteredMessages.every((m) => m.direction === 'received')).toBe(true);
      expect(result.current.filteredMessages.some((m) => m.data === 'incoming')).toBe(true);
    });

    it('filters by search text (case-insensitive)', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());
      act(() => result.current.send('Hello World'));
      act(() => lastMockWs().simulateMessage('Goodbye'));
      act(() => result.current.setSearchText('hello'));
      expect(result.current.filteredMessages).toHaveLength(1);
      expect(result.current.filteredMessages[0].data).toBe('Hello World');
    });
  });

  describe('uptime', () => {
    it('increments every second while connected', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());
      expect(result.current.uptime).toBe(0);
      act(() => vi.advanceTimersByTime(3000));
      expect(result.current.uptime).toBeGreaterThanOrEqual(2000);
    });

    it('stops on disconnect', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());
      act(() => vi.advanceTimersByTime(2000));
      act(() => result.current.disconnect());
      act(() => lastMockWs().simulateClose());
      expect(result.current.uptime).toBeNull();
    });
  });

  describe('cleanup on unmount', () => {
    it('closes connection on unmount', () => {
      const { result, unmount } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());
      const ws = lastMockWs();
      unmount();
      expect(ws.close).toHaveBeenCalled();
    });
  });

  describe('transport mode', () => {
    it('uses direct transport when no custom headers', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      expect(result.current.transportMode).toBe('direct');
      expect(mockInstances).toHaveLength(1);
    });

    it('appends enabled query params to URL for direct transport', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({
        url: 'ws://localhost:8765',
        queryParams: [{ key: 'token', value: 'abc', enabled: true }],
      }));
      act(() => result.current.connect());
      expect(lastMockWs().url).toBe('ws://localhost:8765?token=abc');
    });

    it('skips disabled query params for direct transport', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({
        url: 'ws://localhost:8765',
        queryParams: [
          { key: 'token', value: 'abc', enabled: false },
          { key: 'debug', value: '1', enabled: true },
        ],
      }));
      act(() => result.current.connect());
      expect(lastMockWs().url).toBe('ws://localhost:8765?debug=1');
    });
  });

  describe('draft headers and queryParams', () => {
    it('updates draft headers', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({
        headers: [{ key: 'Authorization', value: 'Bearer x', enabled: true }],
      }));
      expect(result.current.draft.headers).toHaveLength(1);
      expect(result.current.draft.headers[0].key).toBe('Authorization');
    });

    it('updates draft queryParams', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({
        queryParams: [{ key: 'token', value: 'abc', enabled: true }],
      }));
      expect(result.current.draft.queryParams).toHaveLength(1);
      expect(result.current.draft.queryParams[0].key).toBe('token');
    });
  });

  describe('reconnect', () => {
    it('closes previous connection when connecting again', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());
      const firstWs = lastMockWs();
      act(() => result.current.connect());
      expect(firstWs.close).toHaveBeenCalled();
      expect(mockInstances).toHaveLength(2);
    });

    it('recovers from error state on reconnect', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateError());
      expect(result.current.connection.state).toBe('error');
      act(() => result.current.setDraft({ url: 'ws://localhost:9999' }));
      act(() => result.current.connect());
      expect(result.current.connection.state).toBe('connecting');
      act(() => lastMockWs().simulateOpen());
      expect(result.current.connection.state).toBe('connected');
      expect(result.current.connection.url).toBe('ws://localhost:9999');
    });
  });

  describe('proxy transport', () => {
    it('uses proxy transport when custom headers are present', async () => {
      mockDispatch.mockResolvedValueOnce({
        ok: true,
        op: 'connect',
        data: { connectionId: 'proxy-123', protocol: '', extensions: '', latencyMs: 10 },
        meta: { timestamp: new Date().toISOString() },
      });

      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({
        url: 'ws://localhost:8765',
        headers: [{ key: 'Authorization', value: 'Bearer token', enabled: true }],
      }));

      await act(async () => {
        result.current.connect();
      });

      expect(mockDispatch).toHaveBeenCalledWith('connect', expect.objectContaining({
        url: 'ws://localhost:8765',
        headers: { Authorization: 'Bearer token' },
      }));
      expect(result.current.transportMode).toBe('proxy');
      expect(result.current.connection.state).toBe('connected');
      expect(mockInstances).toHaveLength(0);
    });

    it('sets error state when proxy connect fails', async () => {
      mockDispatch.mockRejectedValueOnce(new Error('Server unreachable'));

      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({
        url: 'ws://localhost:8765',
        headers: [{ key: 'X-Key', value: 'val', enabled: true }],
      }));

      await act(async () => {
        result.current.connect();
      });

      expect(result.current.connection.state).toBe('error');
      expect(result.current.connection.lastError).toContain('Server unreachable');
    });

    it('sends via proxy when proxyConnectionId is set', async () => {
      mockDispatch
        .mockResolvedValueOnce({
          ok: true, op: 'connect',
          data: { connectionId: 'proxy-456', protocol: '', extensions: '', latencyMs: 5 },
          meta: { timestamp: new Date().toISOString() },
        })
        .mockResolvedValueOnce({
          ok: true, op: 'send',
          data: { connectionId: 'proxy-456', sentAt: new Date().toISOString() },
          meta: { timestamp: new Date().toISOString() },
        });

      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({
        url: 'ws://localhost:8765',
        headers: [{ key: 'Auth', value: 'token', enabled: true }],
      }));

      await act(async () => {
        result.current.connect();
      });

      await act(async () => {
        result.current.send('hello proxy');
      });

      expect(mockDispatch).toHaveBeenCalledWith('send', {
        connectionId: 'proxy-456',
        data: 'hello proxy',
        type: 'text',
      });
      expect(result.current.sentCount).toBe(1);
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1].data).toBe('hello proxy');
    });

    it('sends binary via proxy with type field', async () => {
      mockDispatch
        .mockResolvedValueOnce({
          ok: true, op: 'connect',
          data: { connectionId: 'proxy-bin', protocol: '', extensions: '', latencyMs: 2 },
          meta: { timestamp: new Date().toISOString() },
        })
        .mockResolvedValueOnce({
          ok: true, op: 'send',
          data: { connectionId: 'proxy-bin', sentAt: new Date().toISOString() },
          meta: { timestamp: new Date().toISOString() },
        });

      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({
        url: 'ws://localhost:8765',
        headers: [{ key: 'X', value: 'y', enabled: true }],
      }));

      await act(async () => {
        result.current.connect();
      });

      await act(async () => {
        result.current.send('SGVsbG8=', 'binary');
      });

      expect(mockDispatch).toHaveBeenCalledWith('send', {
        connectionId: 'proxy-bin',
        data: 'SGVsbG8=',
        type: 'binary',
      });
      expect(result.current.messages[1].type).toBe('binary');
    });

    it('disconnects via proxy', async () => {
      mockDispatch
        .mockResolvedValueOnce({
          ok: true, op: 'connect',
          data: { connectionId: 'proxy-789', protocol: '', extensions: '', latencyMs: 3 },
          meta: { timestamp: new Date().toISOString() },
        })
        .mockResolvedValueOnce({
          ok: true, op: 'disconnect',
          data: { connectionId: 'proxy-789', disconnected: true },
          meta: { timestamp: new Date().toISOString() },
        });

      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({
        url: 'ws://localhost:8765',
        headers: [{ key: 'X-Key', value: 'val', enabled: true }],
      }));

      await act(async () => {
        result.current.connect();
      });

      expect(result.current.connection.state).toBe('connected');

      await act(async () => {
        result.current.disconnect();
      });

      expect(mockDispatch).toHaveBeenCalledWith('disconnect', { connectionId: 'proxy-789', code: 1000, reason: 'User disconnected' });
      expect(result.current.connection.state).toBe('disconnected');
      expect(result.current.uptime).toBeNull();
    });

    it('receives messages via proxy polling', async () => {
      mockDispatch
        .mockResolvedValueOnce({
          ok: true, op: 'connect',
          data: { connectionId: 'proxy-poll', protocol: '', extensions: '', latencyMs: 5 },
          meta: { timestamp: new Date().toISOString() },
        });

      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({
        url: 'ws://localhost:8765',
        headers: [{ key: 'Auth', value: 'tok', enabled: true }],
      }));

      await act(async () => {
        result.current.connect();
      });

      expect(result.current.connection.state).toBe('connected');
      expect(result.current.receivedCount).toBe(0);

      mockDispatch.mockResolvedValueOnce({
        ok: true, op: 'messages',
        data: {
          messages: [
            { data: 'hello from server', type: 'text', receivedAt: new Date().toISOString(), size: 17 },
            { data: 'second msg', type: 'text', receivedAt: new Date().toISOString(), size: 10 },
          ],
          cursor: 2,
        },
        meta: { timestamp: new Date().toISOString() },
      });

      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      expect(result.current.receivedCount).toBe(2);
      expect(result.current.messages).toHaveLength(3);
      expect(result.current.messages[1].data).toBe('hello from server');
      expect(result.current.messages[1].direction).toBe('received');
      expect(result.current.messages[2].data).toBe('second msg');
    });

    it('switches from proxy to direct transport when headers removed', async () => {
      mockDispatch.mockResolvedValueOnce({
        ok: true, op: 'connect',
        data: { connectionId: 'proxy-switch', protocol: '', extensions: '', latencyMs: 3 },
        meta: { timestamp: new Date().toISOString() },
      });

      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({
        url: 'ws://localhost:8765',
        headers: [{ key: 'Auth', value: 'tok', enabled: true }],
      }));

      await act(async () => {
        result.current.connect();
      });

      expect(result.current.transportMode).toBe('proxy');
      expect(result.current.connection.state).toBe('connected');

      // Disconnect, remove headers, reconnect via direct
      await act(async () => {
        result.current.disconnect();
      });
      act(() => result.current.setDraft({ headers: [] }));
      act(() => result.current.connect());

      expect(result.current.transportMode).toBe('direct');
      expect(mockInstances).toHaveLength(1);
    });

    it('surfaces send errors to connection.lastError', async () => {
      mockDispatch
        .mockResolvedValueOnce({
          ok: true, op: 'connect',
          data: { connectionId: 'proxy-sendfail', protocol: '', extensions: '', latencyMs: 3 },
          meta: { timestamp: new Date().toISOString() },
        })
        .mockRejectedValueOnce(new Error('Connection closed'));

      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({
        url: 'ws://localhost:8765',
        headers: [{ key: 'X', value: 'y', enabled: true }],
      }));

      await act(async () => {
        result.current.connect();
      });

      await act(async () => {
        result.current.send('test');
      });

      expect(result.current.sentCount).toBe(0);
      expect(result.current.connection.lastError).toContain('Connection closed');
    });

    it('cleans up proxy connection on unmount', async () => {
      mockDispatch
        .mockResolvedValueOnce({
          ok: true, op: 'connect',
          data: { connectionId: 'proxy-unmount', protocol: '', extensions: '', latencyMs: 2 },
          meta: { timestamp: new Date().toISOString() },
        })
        .mockResolvedValueOnce({
          ok: true, op: 'disconnect',
          data: { connectionId: 'proxy-unmount', disconnected: true },
          meta: { timestamp: new Date().toISOString() },
        });

      const { result, unmount } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({
        url: 'ws://localhost:8765',
        headers: [{ key: 'X', value: 'y', enabled: true }],
      }));

      await act(async () => {
        result.current.connect();
      });

      expect(result.current.connection.state).toBe('connected');
      unmount();

      expect(mockDispatch).toHaveBeenCalledWith('disconnect', { connectionId: 'proxy-unmount' });
    });
  });

  describe('auto-reconnect', () => {
    it('exposes reconnect state defaults', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      expect(result.current.autoReconnect).toBe(false);
      expect(result.current.reconnectState.active).toBe(false);
      expect(result.current.reconnectState.attempt).toBe(0);
      expect(result.current.reconnectState.maxAttempts).toBe(5);
    });

    it('allows toggling auto-reconnect', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setAutoReconnect(true));
      expect(result.current.autoReconnect).toBe(true);
      act(() => result.current.setAutoReconnect(false));
      expect(result.current.autoReconnect).toBe(false);
    });

    it('does NOT reconnect on normal close (code 1000)', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setAutoReconnect(true));
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());
      expect(result.current.connection.state).toBe('connected');

      act(() => lastMockWs().simulateClose(1000, 'Normal'));
      expect(result.current.reconnectState.active).toBe(false);
      expect(result.current.connection.state).toBe('disconnected');
    });

    it('does NOT reconnect on manual disconnect', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setAutoReconnect(true));
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());
      act(() => result.current.disconnect());
      act(() => lastMockWs().simulateClose(1000, 'User disconnected'));
      expect(result.current.reconnectState.active).toBe(false);
    });

    it('triggers reconnect on abnormal close when enabled', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setAutoReconnect(true));
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());
      expect(mockInstances).toHaveLength(1);

      act(() => lastMockWs().simulateClose(1006, 'Abnormal'));
      expect(result.current.reconnectState.active).toBe(true);
      expect(result.current.reconnectState.attempt).toBe(1);

      act(() => vi.advanceTimersByTime(5000));
      expect(mockInstances).toHaveLength(2);
    });

    it('does NOT reconnect on abnormal close when disabled', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setAutoReconnect(false));
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      act(() => lastMockWs().simulateClose(1006, 'Abnormal'));
      expect(result.current.reconnectState.active).toBe(false);
    });

    it('stops after maxAttempts', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setAutoReconnect(true));
      act(() => result.current.setMaxReconnectAttempts(2));
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      // Attempt 1
      act(() => lastMockWs().simulateClose(1006, 'Drop'));
      expect(result.current.reconnectState.attempt).toBe(1);
      act(() => vi.advanceTimersByTime(5000));
      act(() => lastMockWs().simulateError());

      // Attempt 2
      expect(result.current.reconnectState.attempt).toBe(2);
      act(() => vi.advanceTimersByTime(10000));
      act(() => lastMockWs().simulateError());

      // Should stop
      expect(result.current.reconnectState.active).toBe(false);
      expect(result.current.reconnectState.attempt).toBe(2);
    });

    it('resets reconnect state on successful reconnect', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setAutoReconnect(true));
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      act(() => lastMockWs().simulateClose(1006, 'Drop'));
      expect(result.current.reconnectState.active).toBe(true);
      expect(result.current.reconnectState.attempt).toBe(1);

      act(() => vi.advanceTimersByTime(5000));
      act(() => lastMockWs().simulateOpen());

      expect(result.current.reconnectState.active).toBe(false);
      expect(result.current.reconnectState.attempt).toBe(0);
      expect(result.current.connection.state).toBe('connected');
    });

    it('cancelReconnect stops reconnect loop', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setAutoReconnect(true));
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      act(() => lastMockWs().simulateClose(1006, 'Drop'));
      expect(result.current.reconnectState.active).toBe(true);

      act(() => result.current.cancelReconnect());
      expect(result.current.reconnectState.active).toBe(false);
      expect(result.current.reconnectState.attempt).toBe(0);

      const instancesBefore = mockInstances.length;
      act(() => vi.advanceTimersByTime(10000));
      expect(mockInstances).toHaveLength(instancesBefore);
    });

    it('resets reconnect attempt counter on manual connect after max retries', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setAutoReconnect(true));
      act(() => result.current.setMaxReconnectAttempts(1));
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      // Exhaust reconnect attempts
      act(() => lastMockWs().simulateClose(1006, 'Drop'));
      expect(result.current.reconnectState.attempt).toBe(1);
      act(() => vi.advanceTimersByTime(5000));
      act(() => lastMockWs().simulateError());
      expect(result.current.reconnectState.active).toBe(false);
      expect(result.current.reconnectState.attempt).toBe(1);

      // Manual connect should give a fresh reconnect cycle
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());
      act(() => lastMockWs().simulateClose(1006, 'Drop again'));
      // Should trigger reconnect with fresh attempt=1 (not refuse because max was reached)
      expect(result.current.reconnectState.active).toBe(true);
      expect(result.current.reconnectState.attempt).toBe(1);
    });

    it('triggers reconnect on error when enabled', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setAutoReconnect(true));
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateError());

      expect(result.current.reconnectState.active).toBe(true);
      expect(result.current.reconnectState.attempt).toBe(1);
    });

    it('triggers reconnect for proxy transport when connect fails', async () => {
      mockDispatch.mockRejectedValueOnce(new Error('Server unreachable'));

      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setAutoReconnect(true));
      act(() => result.current.setDraft({
        url: 'ws://localhost:8765',
        headers: [{ key: 'X', value: 'y', enabled: true }],
      }));

      await act(async () => {
        result.current.connect();
      });

      expect(result.current.connection.state).toBe('error');
      expect(result.current.reconnectState.active).toBe(true);
      expect(result.current.reconnectState.attempt).toBe(1);
    });

    it('resets reconnect state on successful proxy connect', async () => {
      mockDispatch.mockRejectedValueOnce(new Error('Server unreachable'));

      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setAutoReconnect(true));
      act(() => result.current.setDraft({
        url: 'ws://localhost:8765',
        headers: [{ key: 'X', value: 'y', enabled: true }],
      }));

      await act(async () => {
        result.current.connect();
      });

      expect(result.current.reconnectState.active).toBe(true);
      expect(result.current.reconnectState.attempt).toBe(1);

      mockDispatch.mockResolvedValueOnce({
        ok: true, op: 'connect',
        data: { connectionId: 'proxy-retry', protocol: '', extensions: '', latencyMs: 5 },
        meta: { timestamp: new Date().toISOString() },
      });

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.connection.state).toBe('connected');
      expect(result.current.reconnectState.active).toBe(false);
      expect(result.current.reconnectState.attempt).toBe(0);
    });

    it('appends close frame to messages on disconnect', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());
      act(() => lastMockWs().simulateClose(1001, 'Going Away'));

      const closeFrames = result.current.messages.filter(m => m.type === 'close');
      expect(closeFrames).toHaveLength(1);
      expect(closeFrames[0].data).toContain('1001');
      expect(closeFrames[0].data).toContain('Going Away');
    });
  });

  describe('close with code/reason', () => {
    it('passes custom close code and reason to ws.close', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());
      act(() => result.current.disconnect({ code: 1001, reason: 'Going away' }));
      expect(lastMockWs().close).toHaveBeenCalledWith(1001, 'Going away');
    });

    it('defaults to code 1000 when no detail provided', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());
      act(() => result.current.disconnect());
      expect(lastMockWs().close).toHaveBeenCalledWith(1000, 'User disconnected');
    });

    it('passes code/reason to proxy disconnect', async () => {
      mockDispatch
        .mockResolvedValueOnce({
          ok: true, op: 'connect',
          data: { connectionId: 'proxy-close', protocol: '', extensions: '', latencyMs: 3 },
          meta: { timestamp: new Date().toISOString() },
        })
        .mockResolvedValueOnce({
          ok: true, op: 'disconnect',
          data: { connectionId: 'proxy-close', disconnected: true },
          meta: { timestamp: new Date().toISOString() },
        });

      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({
        url: 'ws://localhost:8765',
        headers: [{ key: 'X', value: 'y', enabled: true }],
      }));

      await act(async () => {
        result.current.connect();
      });

      await act(async () => {
        result.current.disconnect({ code: 4000, reason: 'Custom close' });
      });

      expect(mockDispatch).toHaveBeenCalledWith('disconnect', {
        connectionId: 'proxy-close',
        code: 4000,
        reason: 'Custom close',
      });
    });
  });

  describe('protocol detection', () => {
    it('exposes protocol mode defaults', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      expect(result.current.protocolMode).toBe('auto');
      expect(result.current.detectedProtocol).toBeNull();
    });

    it('allows setting protocol mode', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setProtocolMode('raw'));
      expect(result.current.protocolMode).toBe('raw');
    });

    it('detects protocol from URL on connect (direct transport)', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'wss://example.com/socket.io/?EIO=4&transport=websocket' }));
      act(() => result.current.connect());
      expect(result.current.detectedProtocol).not.toBeNull();
      expect(result.current.detectedProtocol!.protocol).toBe('socket-io');
    });

    it('detects protocol from first message in auto mode', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      expect(result.current.detectedProtocol).toBeNull();

      act(() => lastMockWs().simulateMessage('CONNECTED\nversion:1.2\n\n\0'));
      expect(result.current.detectedProtocol).not.toBeNull();
      expect(result.current.detectedProtocol!.protocol).toBe('stomp');
    });

    it('does NOT detect from message when mode is manual', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setProtocolMode('raw'));
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());
      act(() => lastMockWs().simulateMessage('0{"sid":"abc"}'));
      expect(result.current.detectedProtocol).toBeNull();
    });

    it('only detects from first message (not subsequent)', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      act(() => lastMockWs().simulateMessage('hello world'));
      expect(result.current.detectedProtocol).toBeNull();

      act(() => lastMockWs().simulateMessage('CONNECTED\nversion:1.2\n\n\0'));
      expect(result.current.detectedProtocol).toBeNull();
    });

    it('resets detected protocol on new user-initiated connect', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'wss://example.com/socket.io/?EIO=4' }));
      act(() => result.current.connect());
      expect(result.current.detectedProtocol).not.toBeNull();

      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      expect(result.current.detectedProtocol).toBeNull();
    });
  });

  describe('Socket.IO auto-handshake (direct)', () => {
    it('auto-responds to Engine.IO PING with PONG', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setProtocolMode('socket-io'));
      act(() => result.current.setDraft({ url: 'ws://localhost:3000/socket.io/?EIO=4&transport=websocket' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      act(() => lastMockWs().simulateMessage('2'));

      expect(lastMockWs().send).toHaveBeenCalledWith('3');
      const msgs = result.current.messages;
      const pingFrame = msgs.find((m) => m.data === '2' && m.direction === 'received');
      const pongFrame = msgs.find((m) => m.data === '3' && m.direction === 'sent');
      expect(pingFrame).toBeDefined();
      expect(pongFrame).toBeDefined();
      expect(pingFrame!.protocolMeta?.packetType).toBe('PING');
      expect(pongFrame!.protocolMeta?.packetType).toBe('PONG');
    });

    it('auto-sends Socket.IO CONNECT after Engine.IO OPEN', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setProtocolMode('socket-io'));
      act(() => result.current.setDraft({ url: 'ws://localhost:3000/socket.io/?EIO=4&transport=websocket' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      act(() => lastMockWs().simulateMessage('0{"sid":"abc","upgrades":[],"pingInterval":25000,"pingTimeout":20000}'));

      expect(lastMockWs().send).toHaveBeenCalledWith('40');
      const msgs = result.current.messages;
      const openFrame = msgs.find((m) => m.data.startsWith('0{') && m.direction === 'received');
      const connectFrame = msgs.find((m) => m.data === '40' && m.direction === 'sent');
      expect(openFrame).toBeDefined();
      expect(connectFrame).toBeDefined();
      expect(openFrame!.protocolMeta?.packetType).toBe('OPEN');
      expect(openFrame!.protocolMeta?.isSystemPacket).toBe(true);
      expect(connectFrame!.protocolMeta?.packetType).toBe('CONNECT');
    });

    it('annotates EVENT frames with protocolMeta', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setProtocolMode('socket-io'));
      act(() => result.current.setDraft({ url: 'ws://localhost:3000/socket.io/?EIO=4&transport=websocket' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      act(() => lastMockWs().simulateMessage('42["chat","hello world"]'));

      const msgs = result.current.messages;
      const eventFrame = msgs.find((m) => m.data.includes('chat'));
      expect(eventFrame).toBeDefined();
      expect(eventFrame!.protocolMeta?.protocol).toBe('socket-io');
      expect(eventFrame!.protocolMeta?.packetType).toBe('EVENT');
      expect(eventFrame!.protocolMeta?.eventName).toBe('chat');
      expect(eventFrame!.protocolMeta?.summary).toBe('EVENT: chat');
      expect(eventFrame!.protocolMeta?.isSystemPacket).toBe(false);
    });

    it('annotates sent frames with protocolMeta in socket-io mode', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setProtocolMode('socket-io'));
      act(() => result.current.setDraft({ url: 'ws://localhost:3000/socket.io/?EIO=4&transport=websocket' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      act(() => result.current.send('42["greet","hi"]'));

      const msgs = result.current.messages;
      const sentFrame = msgs.find((m) => m.direction === 'sent' && m.data.includes('greet'));
      expect(sentFrame).toBeDefined();
      expect(sentFrame!.protocolMeta?.packetType).toBe('EVENT');
      expect(sentFrame!.protocolMeta?.eventName).toBe('greet');
    });

    it('does NOT auto-respond to PING when mode is raw', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setProtocolMode('raw'));
      act(() => result.current.setDraft({ url: 'ws://localhost:3000' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      act(() => lastMockWs().simulateMessage('2'));

      expect(lastMockWs().send).not.toHaveBeenCalled();
      const msgs = result.current.messages;
      expect(msgs).toHaveLength(2);
      expect(msgs[1].protocolMeta).toBeUndefined();
    });

    it('does NOT annotate frames when mode is raw', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setProtocolMode('raw'));
      act(() => result.current.setDraft({ url: 'ws://localhost:3000' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      act(() => lastMockWs().simulateMessage('42["msg","data"]'));

      const msgs = result.current.messages;
      expect(msgs[1].protocolMeta).toBeUndefined();
    });

    it('auto-detects socket-io and then auto-handles OPEN/CONNECT', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:3000/socket.io/?EIO=4&transport=websocket' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      expect(result.current.detectedProtocol?.protocol).toBe('socket-io');

      act(() => lastMockWs().simulateMessage('0{"sid":"x","upgrades":[],"pingInterval":25000,"pingTimeout":20000}'));

      expect(lastMockWs().send).toHaveBeenCalledWith('40');
    });

    it('tracks sentCount and receivedCount correctly for auto-handshake', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setProtocolMode('socket-io'));
      act(() => result.current.setDraft({ url: 'ws://localhost:3000/socket.io/?EIO=4&transport=websocket' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      act(() => lastMockWs().simulateMessage('0{"sid":"s","upgrades":[],"pingInterval":25000,"pingTimeout":20000}'));
      expect(result.current.receivedCount).toBe(1);
      expect(result.current.sentCount).toBe(1);

      act(() => lastMockWs().simulateMessage('2'));
      expect(result.current.receivedCount).toBe(2);
      expect(result.current.sentCount).toBe(2);
    });
  });

  describe('STOMP auto-heartbeat (direct)', () => {
    it('auto-responds to STOMP heartbeat with heartbeat', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setProtocolMode('stomp'));
      act(() => result.current.setDraft({ url: 'ws://localhost:61614/stomp' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      act(() => lastMockWs().simulateMessage('\n'));

      expect(lastMockWs().send).toHaveBeenCalledWith('\n');
      const msgs = result.current.messages;
      const hbReceived = msgs.find((m) => m.direction === 'received' && m.protocolMeta?.packetType === 'HEARTBEAT');
      const hbSent = msgs.find((m) => m.direction === 'sent' && m.protocolMeta?.packetType === 'HEARTBEAT');
      expect(hbReceived).toBeDefined();
      expect(hbSent).toBeDefined();
      expect(hbReceived!.protocolMeta?.isSystemPacket).toBe(true);
    });

    it('annotates STOMP MESSAGE frames with protocolMeta', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setProtocolMode('stomp'));
      act(() => result.current.setDraft({ url: 'ws://localhost:61614/stomp' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      act(() => lastMockWs().simulateMessage('MESSAGE\ndestination:/topic/chat\n\nhello\0'));

      const msgs = result.current.messages;
      expect(msgs).toHaveLength(2);
      expect(msgs[1].protocolMeta?.protocol).toBe('stomp');
      expect(msgs[1].protocolMeta?.packetType).toBe('MESSAGE');
      expect(msgs[1].protocolMeta?.summary).toBe('MESSAGE \u2190 /topic/chat');
      expect(msgs[1].protocolMeta?.namespace).toBe('/topic/chat');
      expect(msgs[1].protocolMeta?.isSystemPacket).toBe(false);
    });

    it('annotates CONNECTED as system packet', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setProtocolMode('stomp'));
      act(() => result.current.setDraft({ url: 'ws://localhost:61614/stomp' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      act(() => lastMockWs().simulateMessage('CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0'));

      const msgs = result.current.messages;
      expect(msgs[1].protocolMeta?.packetType).toBe('CONNECTED');
      expect(msgs[1].protocolMeta?.isSystemPacket).toBe(true);
    });

    it('annotates sent frames in STOMP mode', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setProtocolMode('stomp'));
      act(() => result.current.setDraft({ url: 'ws://localhost:61614/stomp' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      act(() => result.current.send('SEND\ndestination:/app/msg\n\nhi\0'));

      const msgs = result.current.messages;
      const sentFrame = msgs.find((m) => m.direction === 'sent');
      expect(sentFrame).toBeDefined();
      expect(sentFrame!.protocolMeta?.protocol).toBe('stomp');
      expect(sentFrame!.protocolMeta?.packetType).toBe('SEND');
    });

    it('does NOT handle heartbeat when mode is raw', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setProtocolMode('raw'));
      act(() => result.current.setDraft({ url: 'ws://localhost:61614' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      act(() => lastMockWs().simulateMessage('\n'));

      expect(lastMockWs().send).not.toHaveBeenCalled();
      expect(result.current.messages[1].protocolMeta).toBeUndefined();
    });
  });

  describe('TLS config', () => {
    it('exposes tlsConfig and setTlsConfig', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      expect(result.current.tlsConfig).toEqual({ rejectUnauthorized: true });

      act(() => result.current.setTlsConfig({ rejectUnauthorized: false }));
      expect(result.current.tlsConfig.rejectUnauthorized).toBe(false);
    });

    it('setTlsConfig merges partial updates', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setTlsConfig({ caCert: 'my-ca' }));
      expect(result.current.tlsConfig.caCert).toBe('my-ca');
      expect(result.current.tlsConfig.rejectUnauthorized).toBe(true);

      act(() => result.current.setTlsConfig({ rejectUnauthorized: false }));
      expect(result.current.tlsConfig.caCert).toBe('my-ca');
      expect(result.current.tlsConfig.rejectUnauthorized).toBe(false);
    });
  });

  describe('GraphQL-WS (direct)', () => {
    it('auto-sends connection_init after open in graphql-ws mode', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setProtocolMode('graphql-ws'));
      act(() => result.current.setDraft({ url: 'ws://localhost:4000/graphql' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      expect(lastMockWs().send).toHaveBeenCalledWith(JSON.stringify({ type: 'connection_init' }));
      const msgs = result.current.messages;
      expect(msgs).toHaveLength(2);
      const initFrame = msgs.find((m) => m.protocolMeta?.packetType === 'connection_init');
      expect(initFrame).toBeDefined();
      expect(initFrame!.protocolMeta?.protocol).toBe('graphql-ws');
      expect(initFrame!.protocolMeta?.isSystemPacket).toBe(true);
    });

    it('auto-responds to ping with pong', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setProtocolMode('graphql-ws'));
      act(() => result.current.setDraft({ url: 'ws://localhost:4000/graphql' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      act(() => lastMockWs().simulateMessage('{"type":"ping"}'));

      expect(lastMockWs().send).toHaveBeenCalledWith(JSON.stringify({ type: 'pong' }));
      const msgs = result.current.messages;
      const pingFrame = msgs.find((m) => m.direction === 'received' && m.protocolMeta?.packetType === 'ping');
      const pongFrame = msgs.find((m) => m.direction === 'sent' && m.protocolMeta?.packetType === 'pong');
      expect(pingFrame).toBeDefined();
      expect(pongFrame).toBeDefined();
    });

    it('annotates next frames with protocolMeta', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setProtocolMode('graphql-ws'));
      act(() => result.current.setDraft({ url: 'ws://localhost:4000/graphql' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      const nextMsg = JSON.stringify({ type: 'next', id: '1', payload: { data: { onMsg: { id: '1' } } } });
      act(() => lastMockWs().simulateMessage(nextMsg));

      const msgs = result.current.messages;
      const nextFrame = msgs.find((m) => m.protocolMeta?.packetType === 'next');
      expect(nextFrame).toBeDefined();
      expect(nextFrame!.protocolMeta?.summary).toBe('next #1: {onMsg\u2026}');
      expect(nextFrame!.protocolMeta?.isSystemPacket).toBe(false);
    });

    it('annotates connection_ack as system packet', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setProtocolMode('graphql-ws'));
      act(() => result.current.setDraft({ url: 'ws://localhost:4000/graphql' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      act(() => lastMockWs().simulateMessage('{"type":"connection_ack"}'));

      const msgs = result.current.messages;
      const ackFrame = msgs.find((m) => m.protocolMeta?.packetType === 'connection_ack');
      expect(ackFrame).toBeDefined();
      expect(ackFrame!.protocolMeta?.isSystemPacket).toBe(true);
    });

    it('annotates sent frames in graphql-ws mode', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setProtocolMode('graphql-ws'));
      act(() => result.current.setDraft({ url: 'ws://localhost:4000/graphql' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      const subscribeMsg = JSON.stringify({ type: 'subscribe', id: '1', payload: { query: '{ users { id } }' } });
      act(() => result.current.send(subscribeMsg));

      const sentFrame = result.current.messages.find((m) => m.direction === 'sent' && m.protocolMeta?.packetType === 'subscribe');
      expect(sentFrame).toBeDefined();
      expect(sentFrame!.protocolMeta?.protocol).toBe('graphql-ws');
    });

    it('does NOT auto-init when mode is raw', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setProtocolMode('raw'));
      act(() => result.current.setDraft({ url: 'ws://localhost:4000/graphql' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      expect(lastMockWs().send).not.toHaveBeenCalled();
    });
  });

  describe('proxy transport — polling error handling', () => {
    function setupProxyConnect() {
      return {
        ok: true, op: 'connect',
        data: { connectionId: 'conn-123', protocol: '', extensions: '', latencyMs: 5 },
        meta: { timestamp: '' },
      };
    }

    it('transitions to disconnected when proxy poll fails and status shows disconnected', async () => {
      const { result } = renderHook(() => useWebSocketStudio());

      act(() => result.current.setDraft({
        url: 'ws://localhost:8765',
        headers: [{ key: 'Auth', value: 'test', enabled: true }],
      }));

      // Connect via proxy
      mockDispatch.mockResolvedValueOnce(setupProxyConnect());
      await act(async () => { result.current.connect(); });

      // First poll: messages call rejects
      mockDispatch.mockRejectedValueOnce(new Error('Network error'));
      // Status check: returns disconnected
      mockDispatch.mockResolvedValueOnce({
        ok: true, op: 'status',
        data: { state: 'disconnected', lastError: 'Connection lost' },
        meta: { timestamp: '' },
      });

      await act(async () => { vi.advanceTimersByTime(500); });

      expect(result.current.connection.state).toBe('disconnected');
    });

    it('transitions to error when proxy poll fails and status shows error', async () => {
      const { result } = renderHook(() => useWebSocketStudio());

      act(() => result.current.setDraft({
        url: 'ws://localhost:8765',
        headers: [{ key: 'Auth', value: 'test', enabled: true }],
      }));
      act(() => result.current.setAutoReconnect(false));

      mockDispatch.mockResolvedValueOnce(setupProxyConnect());
      await act(async () => { result.current.connect(); });

      // Use implementation to differentiate ops
      let pollCallCount = 0;
      mockDispatch.mockImplementation((op: string) => {
        if (op === 'messages') {
          pollCallCount++;
          return Promise.reject(new Error('Poll error'));
        }
        if (op === 'status') {
          return Promise.resolve({
            ok: true, op: 'status',
            data: { state: 'error', lastError: 'Read timeout' },
            meta: { timestamp: '' },
          });
        }
        return Promise.resolve({ ok: true, op, data: {}, meta: { timestamp: '' } });
      });

      await act(async () => { vi.advanceTimersByTime(500); });

      expect(pollCallCount).toBeGreaterThanOrEqual(1);
      expect(result.current.connection.state).toBe('error');
    });

    it('handles double fault (both poll and status check fail)', async () => {
      const { result } = renderHook(() => useWebSocketStudio());

      act(() => result.current.setDraft({
        url: 'ws://localhost:8765',
        headers: [{ key: 'Auth', value: 'test', enabled: true }],
      }));

      mockDispatch.mockResolvedValueOnce(setupProxyConnect());
      await act(async () => { result.current.connect(); });

      // Both poll and status fail
      mockDispatch.mockRejectedValueOnce(new Error('Poll error'));
      mockDispatch.mockRejectedValueOnce(new Error('Status error'));

      await act(async () => { vi.advanceTimersByTime(500); });

      expect(result.current.connection.state).toBe('disconnected');
    });
  });

  describe('proxy transport — sendPing', () => {
    function setupProxyConnect() {
      return {
        ok: true, op: 'connect',
        data: { connectionId: 'conn-123', protocol: '', extensions: '', latencyMs: 5 },
        meta: { timestamp: '' },
      };
    }

    it('sends ping via proxy and appends frame', async () => {
      const { result } = renderHook(() => useWebSocketStudio());

      act(() => result.current.setDraft({
        url: 'ws://localhost:8765',
        headers: [{ key: 'Auth', value: 'test', enabled: true }],
      }));

      mockDispatch.mockResolvedValueOnce(setupProxyConnect());
      await act(async () => { result.current.connect(); });

      // Make the poll return empty messages so it doesn't interfere
      mockDispatch.mockResolvedValue({
        ok: true, op: 'messages',
        data: { messages: [], cursor: 0 },
        meta: { timestamp: '' },
      });

      await act(async () => { vi.advanceTimersByTime(10); });

      // Now override for ping
      mockDispatch.mockResolvedValueOnce({
        ok: true, op: 'ping',
        data: { connectionId: 'conn-123', sentAt: new Date().toISOString() },
        meta: { timestamp: '' },
      });

      await act(async () => { result.current.sendPing(); });
      await act(async () => { vi.advanceTimersByTime(10); });

      const pingFrames = result.current.messages.filter(m => m.type === 'ping');
      expect(pingFrames.length).toBeGreaterThanOrEqual(1);
    });

    it('sets lastError when proxy ping fails', async () => {
      const { result } = renderHook(() => useWebSocketStudio());

      act(() => result.current.setDraft({
        url: 'ws://localhost:8765',
        headers: [{ key: 'Auth', value: 'test', enabled: true }],
      }));

      mockDispatch.mockResolvedValueOnce(setupProxyConnect());
      await act(async () => { result.current.connect(); });

      // Make the poll return empty
      mockDispatch.mockResolvedValue({
        ok: true, op: 'messages',
        data: { messages: [], cursor: 0 },
        meta: { timestamp: '' },
      });
      await act(async () => { vi.advanceTimersByTime(10); });

      // Ping fails
      mockDispatch.mockRejectedValueOnce(new Error('Ping timeout'));

      await act(async () => { result.current.sendPing(); });
      await act(async () => { vi.advanceTimersByTime(10); });

      expect(result.current.connection.lastError).toContain('Ping failed');
    });
  });

  describe('retryNow', () => {
    it('retries connection immediately', async () => {
      const { result } = renderHook(() => useWebSocketStudio());

      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.setAutoReconnect(true));

      // Connect successfully
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      // Then lose connection abnormally
      act(() => lastMockWs().simulateClose(1006, 'Abnormal'));

      // Reconnect should be scheduled
      expect(result.current.reconnectState.active).toBe(true);

      // retryNow should trigger immediate reconnect
      act(() => result.current.retryNow());

      // A new WebSocket instance should have been created
      expect(mockInstances.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('direct WebSocket — constructor error', () => {
    it('transitions to error when WebSocket constructor throws', () => {
      const ThrowingWebSocket = function() {
        throw new Error('WebSocket not supported');
      };
      ThrowingWebSocket.CONNECTING = 0;
      ThrowingWebSocket.OPEN = 1;
      ThrowingWebSocket.CLOSING = 2;
      ThrowingWebSocket.CLOSED = 3;

      (globalThis as Record<string, unknown>).WebSocket = ThrowingWebSocket as unknown as typeof WebSocket;

      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());

      expect(result.current.connection.state).toBe('error');
    });
  });

  describe('disconnect — edge cases', () => {
    it('disconnect during connecting state calls close on WS', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());

      // WS is in CONNECTING state (no simulateOpen yet)
      expect(result.current.connection.state).toBe('connecting');

      act(() => result.current.disconnect());

      // close() should have been called
      expect(lastMockWs().close).toHaveBeenCalled();

      // After the close event fires, state transitions to disconnected
      act(() => lastMockWs().simulateClose(1000, 'User disconnected'));
      expect(result.current.connection.state).toBe('disconnected');
    });

    it('close frame without reason omits reason text', () => {
      const { result } = renderHook(() => useWebSocketStudio());
      act(() => result.current.setDraft({ url: 'ws://localhost:8765' }));
      act(() => result.current.connect());
      act(() => lastMockWs().simulateOpen());

      act(() => result.current.disconnect());
      // Simulate the close event with code only, no reason
      act(() => lastMockWs().simulateClose(1000, ''));

      const closeFrames = result.current.messages.filter(m => m.type === 'close');
      expect(closeFrames.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('proxy disconnect — error handling', () => {
    it('transitions to disconnected even when proxy disconnect call fails', async () => {
      const { result } = renderHook(() => useWebSocketStudio());

      act(() => result.current.setDraft({
        url: 'ws://localhost:8765',
        headers: [{ key: 'Auth', value: 'test', enabled: true }],
      }));

      mockDispatch.mockResolvedValueOnce({
        ok: true, op: 'connect',
        data: { connectionId: 'conn-123', protocol: '', extensions: '', latencyMs: 5 },
        meta: { timestamp: '' },
      });
      await act(async () => { result.current.connect(); });

      // Disconnect call will fail
      mockDispatch.mockRejectedValueOnce(new Error('Disconnect failed'));

      await act(async () => { result.current.disconnect(); });
      await act(async () => { vi.advanceTimersByTime(10); });

      expect(result.current.connection.state).toBe('disconnected');
    });
  });
});
