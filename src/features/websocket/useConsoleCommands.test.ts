/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useConsoleCommands,
  type ConsoleCommandCapabilities,
} from './useConsoleCommands';
import { WS_CONSOLE_COMMANDS, SSE_CONSOLE_COMMANDS } from './wsConsoleCommands';
import type { WsConsoleEntry } from './wsConsoleTypes';

interface Harness {
  entries: WsConsoleEntry[];
  clear: ReturnType<typeof vi.fn>;
  caps: {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    ping: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    sendTemplate: ReturnType<typeof vi.fn>;
  };
  run: (input: string) => void;
}

function setup(opts: { connected?: boolean; connecting?: boolean; sse?: boolean; templateFound?: boolean; noPing?: boolean } = {}): Harness {
  const entries: WsConsoleEntry[] = [];
  const append = (e: WsConsoleEntry) => entries.push(e);
  const clear = vi.fn();
  const caps = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    ping: vi.fn(),
    send: vi.fn(),
    sendTemplate: vi.fn((_name: string) => opts.templateFound ?? false),
  };
  const capabilities: ConsoleCommandCapabilities = opts.sse
    ? {
        isConnected: opts.connected ?? false,
        isConnecting: opts.connecting ?? false,
        connect: caps.connect,
        disconnect: caps.disconnect,
      }
    : {
        isConnected: opts.connected ?? false,
        isConnecting: opts.connecting ?? false,
        connect: caps.connect,
        disconnect: caps.disconnect,
        ping: opts.noPing ? undefined : caps.ping,
        send: caps.send,
        sendTemplate: caps.sendTemplate,
      };
  const { result } = renderHook(() =>
    useConsoleCommands({
      append,
      clearConsole: clear,
      commands: opts.sse ? SSE_CONSOLE_COMMANDS : WS_CONSOLE_COMMANDS,
      capabilities,
    }),
  );
  return { entries, clear, caps, run: result.current.runCommand };
}

const last = (entries: WsConsoleEntry[]) => entries[entries.length - 1];

describe('useConsoleCommands — echo + parsing', () => {
  it('always echoes the typed input as a command entry', () => {
    const h = setup();
    h.run('/help');
    expect(h.entries[0]).toMatchObject({ direction: 'command', category: 'command', message: '/help' });
  });

  it('errors on non-slash (plain) input', () => {
    const h = setup();
    h.run('hello');
    expect(last(h.entries)).toMatchObject({ level: 'error' });
    expect(last(h.entries).message).toMatch(/Commands start with/);
  });

  it('errors on an unknown command', () => {
    const h = setup();
    h.run('/nope');
    expect(last(h.entries)).toMatchObject({ level: 'error' });
    expect(last(h.entries).message).toMatch(/Unknown command "\/nope"/);
  });
});

describe('useConsoleCommands — /help and /clear', () => {
  it('/help appends the help listing', () => {
    const h = setup();
    h.run('/help');
    expect(last(h.entries).message).toMatch(/Available commands/);
  });

  it('/clear calls clearConsole', () => {
    const h = setup();
    h.run('/clear');
    expect(h.clear).toHaveBeenCalledTimes(1);
  });
});

describe('useConsoleCommands — connect / disconnect', () => {
  it('/connect connects without a url when disconnected', () => {
    const h = setup({ connected: false });
    h.run('/connect');
    expect(h.caps.connect).toHaveBeenCalledWith(undefined);
    expect(last(h.entries).message).toMatch(/Connecting…/);
  });

  it('/connect <url> passes the url through', () => {
    const h = setup({ connected: false });
    h.run('/connect wss://example/ws');
    expect(h.caps.connect).toHaveBeenCalledWith('wss://example/ws');
    expect(last(h.entries).message).toMatch(/Connecting to wss:\/\/example\/ws/);
  });

  it('/connect errors when already connected', () => {
    const h = setup({ connected: true });
    h.run('/connect');
    expect(h.caps.connect).not.toHaveBeenCalled();
    expect(last(h.entries)).toMatchObject({ level: 'error' });
  });

  it('/connect errors while a connect is already in flight', () => {
    const h = setup({ connected: false, connecting: true });
    h.run('/connect');
    expect(h.caps.connect).not.toHaveBeenCalled();
    expect(last(h.entries).message).toMatch(/Already connecting/);
  });

  it('/disconnect disconnects when connected', () => {
    const h = setup({ connected: true });
    h.run('/disconnect');
    expect(h.caps.disconnect).toHaveBeenCalledTimes(1);
  });

  it('/disconnect aborts an in-flight connect', () => {
    const h = setup({ connected: false, connecting: true });
    h.run('/disconnect');
    expect(h.caps.disconnect).toHaveBeenCalledTimes(1);
  });

  it('/disconnect errors when not connected', () => {
    const h = setup({ connected: false });
    h.run('/disconnect');
    expect(h.caps.disconnect).not.toHaveBeenCalled();
    expect(last(h.entries)).toMatchObject({ level: 'error' });
  });
});

describe('useConsoleCommands — /ping', () => {
  it('sends a ping when connected', () => {
    const h = setup({ connected: true });
    h.run('/ping');
    expect(h.caps.ping).toHaveBeenCalledTimes(1);
    expect(last(h.entries).message).toMatch(/Ping sent\./);
  });

  it('errors when not connected', () => {
    const h = setup({ connected: false });
    h.run('/ping');
    expect(h.caps.ping).not.toHaveBeenCalled();
    expect(last(h.entries)).toMatchObject({ level: 'error' });
  });

  it('reports not supported when connected but ping is unavailable (direct transport)', () => {
    const h = setup({ connected: true, noPing: true });
    h.run('/ping');
    expect(h.caps.ping).not.toHaveBeenCalled();
    expect(last(h.entries)).toMatchObject({ level: 'error' });
    expect(last(h.entries).message).toMatch(/not supported here/);
  });
});

describe('useConsoleCommands — /close', () => {
  it('closes with no args', () => {
    const h = setup({ connected: true });
    h.run('/close');
    expect(h.caps.disconnect).toHaveBeenCalledWith(undefined);
  });

  it('closes with a code and reason', () => {
    const h = setup({ connected: true });
    h.run('/close 1000 going away');
    expect(h.caps.disconnect).toHaveBeenCalledWith({ code: 1000, reason: 'going away' });
  });

  it('rejects a non-numeric code', () => {
    const h = setup({ connected: true });
    h.run('/close abc');
    expect(h.caps.disconnect).not.toHaveBeenCalled();
    expect(last(h.entries).message).toMatch(/Invalid close code/);
  });

  it('rejects a code below the valid range', () => {
    const h = setup({ connected: true });
    h.run('/close 5');
    expect(h.caps.disconnect).not.toHaveBeenCalled();
    expect(last(h.entries).message).toMatch(/range 1000–4999/);
  });

  it('rejects a code above the valid range', () => {
    const h = setup({ connected: true });
    h.run('/close 9999');
    expect(h.caps.disconnect).not.toHaveBeenCalled();
    expect(last(h.entries).message).toMatch(/range 1000–4999/);
  });

  it('accepts a code in the 3000–4999 custom range', () => {
    const h = setup({ connected: true });
    h.run('/close 4001 bye');
    expect(h.caps.disconnect).toHaveBeenCalledWith({ code: 4001, reason: 'bye' });
  });

  it('rejects a reason longer than 123 bytes', () => {
    const h = setup({ connected: true });
    h.run(`/close 1000 ${'x'.repeat(124)}`);
    expect(h.caps.disconnect).not.toHaveBeenCalled();
    expect(last(h.entries).message).toMatch(/too long/);
  });

  it('errors when not connected', () => {
    const h = setup({ connected: false });
    h.run('/close 1000');
    expect(h.caps.disconnect).not.toHaveBeenCalled();
    expect(last(h.entries)).toMatchObject({ level: 'error' });
  });
});

describe('useConsoleCommands — /send', () => {
  it('sends the rest verbatim when connected', () => {
    const h = setup({ connected: true });
    h.run('/send {"a": 1}');
    expect(h.caps.send).toHaveBeenCalledWith('{"a": 1}');
    expect(last(h.entries).message).toMatch(/Message sent\./);
  });

  it('errors with usage when no data', () => {
    const h = setup({ connected: true });
    h.run('/send');
    expect(h.caps.send).not.toHaveBeenCalled();
    expect(last(h.entries).message).toMatch(/Usage: \/send/);
  });

  it('errors when not connected', () => {
    const h = setup({ connected: false });
    h.run('/send hi');
    expect(h.caps.send).not.toHaveBeenCalled();
    expect(last(h.entries)).toMatchObject({ level: 'error' });
  });
});

describe('useConsoleCommands — /template', () => {
  it('sends a found template', () => {
    const h = setup({ connected: true, templateFound: true });
    h.run('/template greeting');
    expect(h.caps.sendTemplate).toHaveBeenCalledWith('greeting');
    expect(last(h.entries).message).toMatch(/Sent template "greeting"/);
  });

  it('errors when the template is not found', () => {
    const h = setup({ connected: true, templateFound: false });
    h.run('/template nope');
    expect(last(h.entries)).toMatchObject({ level: 'error' });
    expect(last(h.entries).message).toMatch(/No template named "nope"/);
  });

  it('errors with usage when no name', () => {
    const h = setup({ connected: true });
    h.run('/template');
    expect(h.caps.sendTemplate).not.toHaveBeenCalled();
    expect(last(h.entries).message).toMatch(/Usage: \/template/);
  });

  it('errors when not connected', () => {
    const h = setup({ connected: false });
    h.run('/template greeting');
    expect(h.caps.sendTemplate).not.toHaveBeenCalled();
    expect(last(h.entries)).toMatchObject({ level: 'error' });
  });
});

describe('useConsoleCommands — SSE limited set', () => {
  let h: Harness;
  beforeEach(() => {
    h = setup({ sse: true, connected: true });
  });

  it('rejects /ping as unknown', () => {
    h.run('/ping');
    expect(h.caps.ping).not.toHaveBeenCalled();
    expect(last(h.entries).message).toMatch(/Unknown command/);
  });

  it('rejects /send as unknown', () => {
    h.run('/send hi');
    expect(last(h.entries).message).toMatch(/Unknown command/);
  });

  it('rejects /template as unknown', () => {
    h.run('/template x');
    expect(last(h.entries).message).toMatch(/Unknown command/);
  });

  it('still supports /connect and /disconnect', () => {
    h.run('/disconnect');
    expect(h.caps.disconnect).toHaveBeenCalledTimes(1);
  });
});
