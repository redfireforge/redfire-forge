/**
 * @vitest-environment node
 *
 * Unit tests for subscriptionProtocolHandlers.ts
 * All tests are purely synchronous — no sockets required.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  handleGraphqlTransportWsMessage,
  handleGraphqlWsMessage,
  type SubscriptionState,
  type SubscriptionOperationParams,
} from './subscriptionProtocolHandlers.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWs() {
  return { send: vi.fn(), close: vi.fn() };
}

function makeSendEvent() {
  return vi.fn();
}

function makeParams(overrides?: Partial<SubscriptionOperationParams>): SubscriptionOperationParams {
  return {
    query: '{ users { id } }',
    variables: {},
    operationName: undefined,
    operationId: '1',
    ...overrides,
  };
}

function makeState(subscribed = false): SubscriptionState {
  return { subscribed };
}

// ─── handleGraphqlTransportWsMessage ─────────────────────────────────────────

describe('handleGraphqlTransportWsMessage', () => {
  it('connection_ack: sends connected event and subscribe message, sets subscribed=true', () => {
    const ws = makeWs();
    const sendEvent = makeSendEvent();
    const state = makeState();

    handleGraphqlTransportWsMessage({ type: 'connection_ack' }, ws, sendEvent, makeParams(), state);

    expect(sendEvent).toHaveBeenCalledWith('connected', {});
    expect(ws.send).toHaveBeenCalledOnce();
    const sent = JSON.parse(ws.send.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(sent.type).toBe('subscribe');
    expect(sent.id).toBe('1');
    expect((sent.payload as Record<string, unknown>).query).toBe('{ users { id } }');
    expect(state.subscribed).toBe(true);
  });

  it('connection_ack: includes variables when non-empty', () => {
    const ws = makeWs();
    const params = makeParams({ variables: { id: '42' } });

    handleGraphqlTransportWsMessage({ type: 'connection_ack' }, ws, vi.fn(), params, makeState());

    const sent = JSON.parse(ws.send.mock.calls[0][0] as string) as { payload: { variables?: unknown } };
    expect(sent.payload.variables).toEqual({ id: '42' });
  });

  it('connection_ack: omits variables when empty', () => {
    const ws = makeWs();
    handleGraphqlTransportWsMessage({ type: 'connection_ack' }, ws, vi.fn(), makeParams({ variables: {} }), makeState());

    const sent = JSON.parse(ws.send.mock.calls[0][0] as string) as { payload: Record<string, unknown> };
    expect(sent.payload.variables).toBeUndefined();
  });

  it('connection_ack: includes operationName when provided', () => {
    const ws = makeWs();
    const params = makeParams({ operationName: 'GetUsers' });
    handleGraphqlTransportWsMessage({ type: 'connection_ack' }, ws, vi.fn(), params, makeState());

    const sent = JSON.parse(ws.send.mock.calls[0][0] as string) as { payload: { operationName?: string } };
    expect(sent.payload.operationName).toBe('GetUsers');
  });

  it('next: relays payload as next SSE event when id matches', () => {
    const sendEvent = makeSendEvent();
    handleGraphqlTransportWsMessage(
      { type: 'next', id: '1', payload: { data: { users: [] } } },
      makeWs(), sendEvent, makeParams(), makeState(),
    );
    expect(sendEvent).toHaveBeenCalledWith('next', { data: { users: [] } });
  });

  it('next: falls back to empty object when payload is undefined', () => {
    const sendEvent = makeSendEvent();
    handleGraphqlTransportWsMessage(
      { type: 'next', id: '1' },
      makeWs(), sendEvent, makeParams(), makeState(),
    );
    expect(sendEvent).toHaveBeenCalledWith('next', {});
  });

  it('next: does nothing when id does not match operationId', () => {
    const sendEvent = makeSendEvent();
    handleGraphqlTransportWsMessage(
      { type: 'next', id: 'other', payload: { data: {} } },
      makeWs(), sendEvent, makeParams(), makeState(),
    );
    expect(sendEvent).not.toHaveBeenCalled();
  });

  it('error: sends error event and closes when id matches', () => {
    const ws = makeWs();
    const sendEvent = makeSendEvent();
    handleGraphqlTransportWsMessage(
      { type: 'error', id: '1', payload: [{ message: 'bad' }] },
      ws, sendEvent, makeParams(), makeState(),
    );
    expect(sendEvent).toHaveBeenCalledWith('error', [{ message: 'bad' }]);
    expect(ws.close).toHaveBeenCalledWith(1000);
  });

  it('error: uses fallback payload when payload is undefined', () => {
    const sendEvent = makeSendEvent();
    handleGraphqlTransportWsMessage(
      { type: 'error', id: '1' },
      makeWs(), sendEvent, makeParams(), makeState(),
    );
    expect(sendEvent).toHaveBeenCalledWith('error', [{ message: 'Unknown subscription error' }]);
  });

  it('error: does nothing when id does not match', () => {
    const ws = makeWs();
    handleGraphqlTransportWsMessage({ type: 'error', id: 'other' }, ws, vi.fn(), makeParams(), makeState());
    expect(ws.close).not.toHaveBeenCalled();
  });

  it('complete: sends complete event and closes when id matches', () => {
    const ws = makeWs();
    const sendEvent = makeSendEvent();
    handleGraphqlTransportWsMessage(
      { type: 'complete', id: '1' },
      ws, sendEvent, makeParams(), makeState(),
    );
    expect(sendEvent).toHaveBeenCalledWith('complete', {});
    expect(ws.close).toHaveBeenCalledWith(1000);
  });

  it('complete: does nothing when id does not match', () => {
    const ws = makeWs();
    handleGraphqlTransportWsMessage({ type: 'complete', id: 'other' }, ws, vi.fn(), makeParams(), makeState());
    expect(ws.close).not.toHaveBeenCalled();
  });

  it('connection_error: sends error event and closes with code 4499', () => {
    const ws = makeWs();
    const sendEvent = makeSendEvent();
    handleGraphqlTransportWsMessage(
      { type: 'connection_error', payload: { message: 'auth failed' } },
      ws, sendEvent, makeParams(), makeState(),
    );
    expect(sendEvent).toHaveBeenCalledWith('error', [{ message: 'auth failed' }]);
    expect(ws.close).toHaveBeenCalledWith(4499, 'Connection rejected');
  });

  it('connection_error: uses fallback message when payload has no message string', () => {
    const sendEvent = makeSendEvent();
    handleGraphqlTransportWsMessage(
      { type: 'connection_error', payload: {} },
      makeWs(), sendEvent, makeParams(), makeState(),
    );
    expect(sendEvent).toHaveBeenCalledWith('error', [{ message: 'Connection rejected by server' }]);
  });

  it('ping: responds with pong message', () => {
    const ws = makeWs();
    handleGraphqlTransportWsMessage({ type: 'ping' }, ws, vi.fn(), makeParams(), makeState());
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'pong' }));
  });

  it('unknown type: silently ignored', () => {
    const ws = makeWs();
    const sendEvent = makeSendEvent();
    handleGraphqlTransportWsMessage({ type: 'unknown_type' }, ws, sendEvent, makeParams(), makeState());
    expect(ws.send).not.toHaveBeenCalled();
    expect(sendEvent).not.toHaveBeenCalled();
    expect(ws.close).not.toHaveBeenCalled();
  });
});

// ─── handleGraphqlWsMessage ───────────────────────────────────────────────────

describe('handleGraphqlWsMessage', () => {
  it('connection_ack: sends connected event and start message, sets subscribed=true', () => {
    const ws = makeWs();
    const sendEvent = makeSendEvent();
    const state = makeState();
    handleGraphqlWsMessage({ type: 'connection_ack' }, ws, sendEvent, makeParams(), state);

    expect(sendEvent).toHaveBeenCalledWith('connected', {});
    const sent = JSON.parse(ws.send.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(sent.type).toBe('start');
    expect(sent.id).toBe('1');
    expect(state.subscribed).toBe(true);
  });

  it('connection_ack: includes non-empty variables in start payload', () => {
    const ws = makeWs();
    handleGraphqlWsMessage(
      { type: 'connection_ack' },
      ws, vi.fn(), makeParams({ variables: { id: '5' } }), makeState(),
    );
    const sent = JSON.parse(ws.send.mock.calls[0][0] as string) as { payload: { variables?: unknown } };
    expect(sent.payload.variables).toEqual({ id: '5' });
  });

  it('connection_keep_alive: silently consumed', () => {
    const ws = makeWs();
    handleGraphqlWsMessage({ type: 'connection_keep_alive' }, ws, vi.fn(), makeParams(), makeState());
    expect(ws.send).not.toHaveBeenCalled();
  });

  it('ka: silently consumed (short alias)', () => {
    const ws = makeWs();
    handleGraphqlWsMessage({ type: 'ka' }, ws, vi.fn(), makeParams(), makeState());
    expect(ws.send).not.toHaveBeenCalled();
  });

  it('connection_error: sends error event with message and closes', () => {
    const ws = makeWs();
    const sendEvent = makeSendEvent();
    handleGraphqlWsMessage(
      { type: 'connection_error', payload: { message: 'rejected' } },
      ws, sendEvent, makeParams(), makeState(),
    );
    expect(sendEvent).toHaveBeenCalledWith('error', [{ message: 'rejected' }]);
    expect(ws.close).toHaveBeenCalledWith(4499, 'Connection rejected');
  });

  it('connection_error: uses fallback when payload has no message string', () => {
    const sendEvent = makeSendEvent();
    handleGraphqlWsMessage({ type: 'connection_error' }, makeWs(), sendEvent, makeParams(), makeState());
    expect(sendEvent).toHaveBeenCalledWith('error', [{ message: 'Connection rejected by server' }]);
  });

  it('data: relays data payload as next SSE event when id matches', () => {
    const sendEvent = makeSendEvent();
    handleGraphqlWsMessage(
      { type: 'data', id: '1', payload: { data: { users: [] } } },
      makeWs(), sendEvent, makeParams(), makeState(),
    );
    expect(sendEvent).toHaveBeenCalledWith('next', { data: { users: [] } });
  });

  it('data: includes errors in next payload when present', () => {
    const sendEvent = makeSendEvent();
    handleGraphqlWsMessage(
      { type: 'data', id: '1', payload: { data: null, errors: [{ message: 'fail' }] } },
      makeWs(), sendEvent, makeParams(), makeState(),
    );
    expect(sendEvent).toHaveBeenCalledWith('next', { data: null, errors: [{ message: 'fail' }] });
  });

  it('data: omits errors from next payload when not an array', () => {
    const sendEvent = makeSendEvent();
    handleGraphqlWsMessage(
      { type: 'data', id: '1', payload: { data: { x: 1 }, errors: 'not-array' } },
      makeWs(), sendEvent, makeParams(), makeState(),
    );
    const called = sendEvent.mock.calls[0][1] as Record<string, unknown>;
    expect(called.errors).toBeUndefined();
  });

  it('data: does nothing when id does not match', () => {
    const sendEvent = makeSendEvent();
    handleGraphqlWsMessage(
      { type: 'data', id: 'other', payload: { data: {} } },
      makeWs(), sendEvent, makeParams(), makeState(),
    );
    expect(sendEvent).not.toHaveBeenCalled();
  });

  it('data: uses empty object when payload is missing', () => {
    const sendEvent = makeSendEvent();
    handleGraphqlWsMessage({ type: 'data', id: '1' }, makeWs(), sendEvent, makeParams(), makeState());
    expect(sendEvent).toHaveBeenCalledWith('next', { data: null });
  });

  it('error: sends error event and closes when id matches and payload is array', () => {
    const ws = makeWs();
    const sendEvent = makeSendEvent();
    handleGraphqlWsMessage(
      { type: 'error', id: '1', payload: [{ message: 'bad field' }] },
      ws, sendEvent, makeParams(), makeState(),
    );
    expect(sendEvent).toHaveBeenCalledWith('error', [{ message: 'bad field' }]);
    expect(ws.close).toHaveBeenCalledWith(1000);
  });

  it('error: wraps string payload in array', () => {
    const sendEvent = makeSendEvent();
    handleGraphqlWsMessage(
      { type: 'error', id: '1', payload: 'something went wrong' },
      makeWs(), sendEvent, makeParams(), makeState(),
    );
    expect(sendEvent).toHaveBeenCalledWith('error', [{ message: 'something went wrong' }]);
  });

  it('error: uses fallback message when payload is neither array nor string', () => {
    const sendEvent = makeSendEvent();
    handleGraphqlWsMessage(
      { type: 'error', id: '1', payload: null },
      makeWs(), sendEvent, makeParams(), makeState(),
    );
    expect(sendEvent).toHaveBeenCalledWith('error', [{ message: 'Unknown legacy subscription error' }]);
  });

  it('error: does nothing when id does not match', () => {
    const ws = makeWs();
    handleGraphqlWsMessage({ type: 'error', id: 'other' }, ws, vi.fn(), makeParams(), makeState());
    expect(ws.close).not.toHaveBeenCalled();
  });

  it('complete: sends complete event and closes when id matches', () => {
    const ws = makeWs();
    const sendEvent = makeSendEvent();
    handleGraphqlWsMessage({ type: 'complete', id: '1' }, ws, sendEvent, makeParams(), makeState());
    expect(sendEvent).toHaveBeenCalledWith('complete', {});
    expect(ws.close).toHaveBeenCalledWith(1000);
  });

  it('complete: does nothing when id does not match', () => {
    const ws = makeWs();
    handleGraphqlWsMessage({ type: 'complete', id: 'other' }, ws, vi.fn(), makeParams(), makeState());
    expect(ws.close).not.toHaveBeenCalled();
  });

  it('unknown type: silently ignored', () => {
    const ws = makeWs();
    handleGraphqlWsMessage({ type: 'unknown' }, ws, vi.fn(), makeParams(), makeState());
    expect(ws.send).not.toHaveBeenCalled();
    expect(ws.close).not.toHaveBeenCalled();
  });
});
