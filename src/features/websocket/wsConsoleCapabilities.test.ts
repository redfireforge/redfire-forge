import { describe, expect, it, vi } from 'vitest';

import type { WsConsoleCapabilitiesDeps } from './wsConsoleCapabilities';
import { buildWsConsoleCapabilities } from './wsConsoleCapabilities';

function makeDeps(overrides: Partial<WsConsoleCapabilitiesDeps> = {}): WsConsoleCapabilitiesDeps {
  return {
    isConnected: false,
    connectionState: 'idle',
    transportMode: 'proxy',
    setDraft: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendPing: vi.fn(),
    send: vi.fn(),
    templates: [],
    ...overrides,
  };
}

describe('buildWsConsoleCapabilities', () => {
  it('exposes the connection flags derived from the studio state', () => {
    expect(buildWsConsoleCapabilities(makeDeps({ isConnected: true })).isConnected).toBe(true);
    expect(
      buildWsConsoleCapabilities(makeDeps({ connectionState: 'connecting' })).isConnecting,
    ).toBe(true);
    expect(buildWsConsoleCapabilities(makeDeps({ connectionState: 'open' })).isConnecting).toBe(
      false,
    );
  });

  it('connect applies the url to the draft before connecting', () => {
    const deps = makeDeps();
    buildWsConsoleCapabilities(deps).connect('wss://example.test');
    expect(deps.setDraft).toHaveBeenCalledWith({ url: 'wss://example.test' });
    expect(deps.connect).toHaveBeenCalledTimes(1);
  });

  it('connect without a url skips the draft update', () => {
    const deps = makeDeps();
    buildWsConsoleCapabilities(deps).connect();
    expect(deps.setDraft).not.toHaveBeenCalled();
    expect(deps.connect).toHaveBeenCalledTimes(1);
  });

  it('connect treats empty url as no-op for draft update', () => {
    const deps = makeDeps();
    buildWsConsoleCapabilities(deps).connect('');
    expect(deps.setDraft).not.toHaveBeenCalled();
    expect(deps.connect).toHaveBeenCalledTimes(1);
  });

  it('disconnect forwards the code/reason when provided', () => {
    const deps = makeDeps();
    buildWsConsoleCapabilities(deps).disconnect({ code: 1000, reason: 'bye' });
    expect(deps.disconnect).toHaveBeenCalledWith({ code: 1000, reason: 'bye' });
  });

  it('disconnect passes undefined when no code is given', () => {
    const deps = makeDeps();
    buildWsConsoleCapabilities(deps).disconnect();
    expect(deps.disconnect).toHaveBeenCalledWith(undefined);
    buildWsConsoleCapabilities(deps).disconnect({ code: undefined as unknown as number });
    expect(deps.disconnect).toHaveBeenLastCalledWith(undefined);
  });

  it('disconnect forwards detail when code is nullish-safe but present', () => {
    const deps = makeDeps();
    buildWsConsoleCapabilities(deps).disconnect({ code: 3001 });
    expect(deps.disconnect).toHaveBeenCalledWith({ code: 3001, reason: undefined });
  });

  it('ping and send delegate to the studio actions', () => {
    const deps = makeDeps();
    const caps = buildWsConsoleCapabilities(deps);
    caps.ping?.();
    caps.send?.('hello');
    expect(deps.sendPing).toHaveBeenCalledTimes(1);
    expect(deps.send).toHaveBeenCalledWith('hello');
  });

  it('omits ping in direct transport mode (raw browser WebSocket has no ping)', () => {
    const deps = makeDeps({ transportMode: 'direct' });
    const caps = buildWsConsoleCapabilities(deps);
    expect(caps.ping).toBeUndefined();
    expect(deps.sendPing).not.toHaveBeenCalled();
  });

  it.each(['proxy', 'native'] as const)('exposes ping in %s transport mode', (transportMode) => {
    const deps = makeDeps({ transportMode });
    const caps = buildWsConsoleCapabilities(deps);
    caps.ping?.();
    expect(deps.sendPing).toHaveBeenCalledTimes(1);
  });

  it('sendTemplate resolves a template case-insensitively and sends it', () => {
    const deps = makeDeps({
      templates: [{ name: 'Ping JSON', body: '{"op":"ping"}', format: 'json' }],
    });
    const result = buildWsConsoleCapabilities(deps).sendTemplate?.('ping json');
    expect(result).toBe(true);
    expect(deps.send).toHaveBeenCalledWith('{"op":"ping"}', 'json');
  });

  it('sendTemplate returns false when no template matches', () => {
    const deps = makeDeps({ templates: [{ name: 'A', body: 'a' }] });
    const result = buildWsConsoleCapabilities(deps).sendTemplate?.('missing');
    expect(result).toBe(false);
    expect(deps.send).not.toHaveBeenCalled();
  });

  it('sendTemplate supports template without explicit format', () => {
    const deps = makeDeps({ templates: [{ name: 'No Format', body: 'plain-body' }] });
    const result = buildWsConsoleCapabilities(deps).sendTemplate?.('no format');
    expect(result).toBe(true);
    expect(deps.send).toHaveBeenCalledWith('plain-body', undefined);
  });
});
