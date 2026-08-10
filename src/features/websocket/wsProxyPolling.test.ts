import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFrame, type WsConnectionSnapshot } from '../../shared/websocket/types';
import { startWsProxyPolling } from './wsProxyPolling';
import { dispatchWsOperation } from '../../shared/websocket/websocketClient';
import { processReceivedMessage } from './wsMessageProcessing';
import type { WsProtocolMode, WsProtocolDetectionResult } from '../../shared/websocket/protocols/protocolTypes';
import type { SioServerParams } from './wsProtocolHelpers';
import type { WsEnvelope } from '../../shared/websocket/websocketClient';

vi.mock('../../shared/websocket/websocketClient', () => ({
  dispatchWsOperation: vi.fn(),
}));

vi.mock('./wsMessageProcessing', () => ({
  processReceivedMessage: vi.fn(),
}));

function makeRefs() {
  return {
    mountedRef: { current: true },
    proxyCursorRef: { current: 0 },
    protocolModeRef: { current: 'raw' as WsProtocolMode },
    detectedProtocolRef: { current: null as WsProtocolDetectionResult | null },
    messageDetectionDoneRef: { current: false },
  };
}

type MessagesData = {
  state: string;
  cursor: number;
  messages: Array<{ data: string; type: string; receivedAt: string; size: number }>;
  closeCode?: number;
  closeReason?: string;
};

type StatusData = { state: string; lastError?: string };

function wsEnvelope<T>(data: T): WsEnvelope<T> {
  return { ok: true, op: 'messages', data };
}

function makeArgs(overrides: Partial<Parameters<typeof startWsProxyPolling>[0]> = {}) {
  const refs = makeRefs();
  const appendMessage = vi.fn();
  const appendMessages = vi.fn();
  const setSentCount = vi.fn();
  const setReceivedCount = vi.fn();
  const setSioServerParams = vi.fn();
  const updateDetectedProtocol = vi.fn();
  const failProxyConnection = vi.fn();

  return {
    args: {
      connectionId: 'conn-1',
      pollIntervalMs: 10,
      ...refs,
      appendMessage,
      appendMessages,
      setSentCount,
      setReceivedCount,
      setSioServerParams,
      updateDetectedProtocol,
      failProxyConnection,
      ...overrides,
    },
    refs,
    appendMessage,
    appendMessages,
    setSentCount,
    setReceivedCount,
    setSioServerParams,
    updateDetectedProtocol,
    failProxyConnection,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('startWsProxyPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(dispatchWsOperation).mockReset();
    vi.mocked(processReceivedMessage).mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('processes messages, auto-replies, and advances the cursor', async () => {
    const { args, refs, appendMessages, setSentCount, setReceivedCount, setSioServerParams, updateDetectedProtocol } = makeArgs();

    vi.mocked(dispatchWsOperation).mockResolvedValue(wsEnvelope({}));

    vi.mocked(dispatchWsOperation)
      .mockResolvedValueOnce(wsEnvelope<MessagesData>({
        state: 'connected',
        cursor: 7,
        messages: [
          { data: 'auto', type: 'text', receivedAt: '2026-07-19T00:00:00.000Z', size: 4 },
          { data: 'plain', type: 'text', receivedAt: '2026-07-19T00:00:00.000Z', size: 5 },
        ],
      }));

    vi.mocked(processReceivedMessage)
      .mockImplementationOnce(() => {
        updateDetectedProtocol({ protocol: 'auto-detected' } as WsProtocolDetectionResult);
        return {
          frame: createFrame('received', 'text', 'auto'),
          autoRespond: {
            replyData: 'reply-data',
            replyFrame: createFrame('sent', 'text', 'reply-frame'),
            sioServerParams: { host: 'localhost', port: 3000 } as SioServerParams,
          },
          detectionNowDone: true,
        };
      })
      .mockReturnValueOnce({
        frame: createFrame('received', 'text', 'plain'),
        autoRespond: null,
        detectionNowDone: false,
      });

    const intervalId = startWsProxyPolling(args);
    await vi.advanceTimersByTimeAsync(10);
    await Promise.resolve();
    await Promise.resolve();
    clearInterval(intervalId);

    expect(appendMessages).toHaveBeenCalledTimes(1);
    expect(appendMessages.mock.calls[0][0]).toHaveLength(3);
    expect(setSentCount).toHaveBeenCalledWith(expect.any(Function));
    expect(setReceivedCount).toHaveBeenCalledWith(expect.any(Function));
    expect(setSioServerParams).toHaveBeenCalledWith({ host: 'localhost', port: 3000 });
    expect(updateDetectedProtocol).toHaveBeenCalled();
    expect(refs.proxyCursorRef.current).toBe(7);
  });

  it('fails the proxy when the connection is no longer connected', async () => {
    const { args, appendMessage, failProxyConnection } = makeArgs();

    vi.mocked(dispatchWsOperation).mockResolvedValueOnce({
      data: {
        state: 'error',
        closeCode: 4321,
        closeReason: 'boom',
        messages: [],
        cursor: 0,
      },
    } as WsEnvelope<MessagesData>);

    const intervalId = startWsProxyPolling(args);
    await vi.advanceTimersByTimeAsync(10);
    clearInterval(intervalId);

    expect(appendMessage).toHaveBeenCalled();
    expect(failProxyConnection).toHaveBeenCalledWith(expect.objectContaining({
      state: 'error',
      closeCode: 4321,
      closeReason: 'boom',
    } as Partial<WsConnectionSnapshot>));
  });

  it('falls back to status polling after a messages failure', async () => {
    const { args, failProxyConnection } = makeArgs();

    vi.mocked(dispatchWsOperation)
      .mockRejectedValueOnce(new Error('messages failed'))
      .mockResolvedValueOnce({ data: { state: 'disconnected', lastError: 'offline' } } as WsEnvelope<StatusData>);

    const intervalId = startWsProxyPolling(args);
    await vi.advanceTimersByTimeAsync(10);
    clearInterval(intervalId);

    expect(failProxyConnection).toHaveBeenCalledWith(expect.objectContaining({
      state: 'disconnected',
      lastError: 'offline',
    } as Partial<WsConnectionSnapshot>));
  });

  it('returns early when the proxy is unmounted before or after polling', async () => {
    const { args, refs, failProxyConnection } = makeArgs();
    refs.mountedRef.current = false;

    vi.mocked(dispatchWsOperation).mockResolvedValue({
      data: {
        state: 'connected',
        cursor: 1,
        messages: [],
      },
    } as WsEnvelope<MessagesData>);

    const intervalId = startWsProxyPolling(args);
    await vi.advanceTimersByTimeAsync(10);
    clearInterval(intervalId);

    expect(failProxyConnection).not.toHaveBeenCalled();
  });

  it('returns early when the proxy unmounts after messages resolve', async () => {
    const { args, refs, failProxyConnection } = makeArgs();
    const messages = deferred<{ data: { state: string; cursor: number; messages: [] } }>();

    vi.mocked(dispatchWsOperation).mockReturnValueOnce(messages.promise as Promise<WsEnvelope<MessagesData>>);

    const intervalId = startWsProxyPolling(args);
    refs.mountedRef.current = false;
    messages.resolve({ data: { state: 'connected', cursor: 1, messages: [] } });
    await vi.advanceTimersByTimeAsync(10);
    await Promise.resolve();
    clearInterval(intervalId);

    expect(failProxyConnection).not.toHaveBeenCalled();
  });

  it('returns early from messages failure when the proxy unmounts before catch handling', async () => {
    const { args, refs, failProxyConnection } = makeArgs();

    refs.mountedRef.current = false;
    vi.mocked(dispatchWsOperation).mockRejectedValueOnce(new Error('messages failed'));

    const intervalId = startWsProxyPolling(args);
    await vi.advanceTimersByTimeAsync(10);
    clearInterval(intervalId);

    expect(failProxyConnection).not.toHaveBeenCalled();
  });

  it('returns early when the proxy unmounts while status polling is pending', async () => {
    const { args, refs, failProxyConnection } = makeArgs();
    const status = deferred<{ data: { state: string; lastError?: string } }>();

    vi.mocked(dispatchWsOperation)
      .mockRejectedValueOnce(new Error('messages failed'))
      .mockReturnValueOnce(status.promise as Promise<WsEnvelope<StatusData>>);

    const intervalId = startWsProxyPolling(args);
    await vi.advanceTimersByTimeAsync(10);
    refs.mountedRef.current = false;
    status.resolve({ data: { state: 'disconnected', lastError: 'offline' } });
    await Promise.resolve();
    clearInterval(intervalId);

    expect(failProxyConnection).not.toHaveBeenCalled();
  });

  it('returns early when the proxy unmounts before status failure handling', async () => {
    const { args, refs, failProxyConnection } = makeArgs();
    const status = deferred<{ data: { state: string; lastError?: string } }>();

    vi.mocked(dispatchWsOperation)
      .mockRejectedValueOnce(new Error('messages failed'))
      .mockReturnValueOnce(status.promise as Promise<WsEnvelope<StatusData>>);

    const intervalId = startWsProxyPolling(args);
    await vi.advanceTimersByTimeAsync(10);
    refs.mountedRef.current = false;
    status.reject(new Error('status failed'));
    await Promise.resolve();
    clearInterval(intervalId);

    expect(failProxyConnection).not.toHaveBeenCalled();
  });

  it('falls back to disconnected when both messages and status polling fail', async () => {
    const { args, failProxyConnection } = makeArgs();

    vi.mocked(dispatchWsOperation)
      .mockRejectedValueOnce(new Error('messages failed'))
      .mockRejectedValueOnce(new Error('status failed'));

    const intervalId = startWsProxyPolling(args);
    await vi.advanceTimersByTimeAsync(10);
    clearInterval(intervalId);

    expect(failProxyConnection).toHaveBeenCalledWith({ state: 'disconnected' });
  });
});