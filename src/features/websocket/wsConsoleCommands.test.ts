import { describe, it, expect } from 'vitest';
import {
  parseConsoleCommand,
  navigateHistory,
  buildCommandHint,
  WS_CONSOLE_COMMANDS,
  SSE_CONSOLE_COMMANDS,
  WS_CONSOLE_HINT,
  SSE_CONSOLE_HINT,
} from './wsConsoleCommands';

describe('parseConsoleCommand', () => {
  it('treats blank/whitespace input as empty', () => {
    expect(parseConsoleCommand('')).toEqual({ kind: 'empty' });
    expect(parseConsoleCommand('   ')).toEqual({ kind: 'empty' });
  });

  it('treats non-slash input as plain text', () => {
    expect(parseConsoleCommand('hello world')).toEqual({ kind: 'plain', text: 'hello world' });
  });

  it('parses a bare command', () => {
    expect(parseConsoleCommand('/ping')).toEqual({
      kind: 'command',
      name: 'ping',
      args: [],
      rest: '',
    });
  });

  it('lowercases the command name', () => {
    expect(parseConsoleCommand('/PING')).toMatchObject({ kind: 'command', name: 'ping' });
  });

  it('splits args and preserves rest verbatim', () => {
    const parsed = parseConsoleCommand('/close 1000 going away now');
    expect(parsed).toEqual({
      kind: 'command',
      name: 'close',
      args: ['1000', 'going', 'away', 'now'],
      rest: '1000 going away now',
    });
  });

  it('keeps inner spacing of the rest for /send', () => {
    const parsed = parseConsoleCommand('/send {"a":  1}');
    expect(parsed).toMatchObject({ kind: 'command', name: 'send', rest: '{"a":  1}' });
  });

  it('tolerates extra leading/trailing whitespace', () => {
    expect(parseConsoleCommand('   /connect   wss://h   ')).toEqual({
      kind: 'command',
      name: 'connect',
      args: ['wss://h'],
      rest: 'wss://h',
    });
  });

  it('tolerates whitespace immediately after the slash', () => {
    expect(parseConsoleCommand('/  send hello world')).toEqual({
      kind: 'command',
      name: 'send',
      args: ['hello', 'world'],
      rest: 'hello world',
    });
  });

  it('parses a lone slash as an empty-named command', () => {
    expect(parseConsoleCommand('/')).toEqual({
      kind: 'command',
      name: '',
      args: [],
      rest: '',
    });
  });
});

describe('navigateHistory', () => {
  it('returns the index unchanged for empty history', () => {
    expect(navigateHistory('up', null, 0)).toBeNull();
    expect(navigateHistory('down', 2, 0)).toBe(2);
  });

  it('up from live recalls the newest entry', () => {
    expect(navigateHistory('up', null, 3)).toBe(2);
  });

  it('up steps toward older entries, clamped at 0', () => {
    expect(navigateHistory('up', 2, 3)).toBe(1);
    expect(navigateHistory('up', 0, 3)).toBe(0);
  });

  it('down from live is a no-op', () => {
    expect(navigateHistory('down', null, 3)).toBeNull();
  });

  it('down steps toward newer entries', () => {
    expect(navigateHistory('down', 0, 3)).toBe(1);
  });

  it('down past the newest returns to live', () => {
    expect(navigateHistory('down', 2, 3)).toBeNull();
  });
});

describe('command registries', () => {
  it('WS includes the full command set', () => {
    const names = WS_CONSOLE_COMMANDS.map((c) => c.name);
    expect(names).toEqual([
      'help',
      'clear',
      'connect',
      'disconnect',
      'ping',
      'close',
      'send',
      'template',
    ]);
  });

  it('SSE is limited to the one-way subset', () => {
    const names = SSE_CONSOLE_COMMANDS.map((c) => c.name);
    expect(names).toEqual(['help', 'clear', 'connect', 'disconnect']);
    expect(names).not.toContain('ping');
    expect(names).not.toContain('send');
    expect(names).not.toContain('template');
  });

  it('every spec has a usage and description', () => {
    for (const spec of [...WS_CONSOLE_COMMANDS, ...SSE_CONSOLE_COMMANDS]) {
      expect(spec.usage.startsWith('/')).toBe(true);
      expect(spec.description.length).toBeGreaterThan(0);
    }
  });
});

describe('buildCommandHint', () => {
  it('lists slash commands after the history hint', () => {
    const hint = buildCommandHint(SSE_CONSOLE_COMMANDS);
    expect(hint).toContain('↑↓ history');
    expect(hint).toContain('/connect');
    expect(hint).toContain('/disconnect');
  });

  it('exposes precomputed per-variant hints', () => {
    expect(WS_CONSOLE_HINT).toBe(buildCommandHint(WS_CONSOLE_COMMANDS));
    expect(SSE_CONSOLE_HINT).toBe(buildCommandHint(SSE_CONSOLE_COMMANDS));
    expect(WS_CONSOLE_HINT).toContain('/ping');
    expect(SSE_CONSOLE_HINT).not.toContain('/ping');
  });
});
