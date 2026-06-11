import { describe, expect, it, vi } from 'vitest';

import type { WsConsoleCapabilitiesDeps } from './wsConsoleCapabilities';
import { buildWsConsoleCapabilities } from './wsConsoleCapabilities';

function makeDeps(overrides: Partial<WsConsoleCapabilitiesDeps> = {}): WsConsoleCapabilitiesDeps {
  return {
    isConnected: false,
    connectionState: 'idle',
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

  it('ping and send delegate to the studio actions', () => {
    const deps = makeDeps();
    const caps = buildWsConsoleCapabilities(deps);
    caps.ping?.();
    caps.send?.('hello');
    expect(deps.sendPing).toHaveBeenCalledTimes(1);
    expect(deps.send).toHaveBeenCalledWith('hello');
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
});
