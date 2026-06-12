/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  SSE_CONSOLE_SETTINGS_KEY,
  WS_CONSOLE_SETTINGS_KEY,
  loadConsoleSettings,
  sanitizeConsoleSettings,
  saveConsoleSettings,
} from './wsConsoleStorage';
import { WS_CONSOLE_DEFAULT_SETTINGS } from './wsConsoleTypes';

describe('sanitizeConsoleSettings', () => {
  it('returns defaults for non-object input', () => {
    expect(sanitizeConsoleSettings(null)).toEqual(WS_CONSOLE_DEFAULT_SETTINGS);
    expect(sanitizeConsoleSettings('bad')).toEqual(WS_CONSOLE_DEFAULT_SETTINGS);
  });

  it('keeps valid values', () => {
    const s = sanitizeConsoleSettings({
      view: 'raw',
      levelFilter: 'warn',
      categoryFilter: 'handshake',
      autoScroll: false,
      maxEntries: 500,
    });
    expect(s).toEqual({
      view: 'raw',
      levelFilter: 'warn',
      categoryFilter: 'handshake',
      autoScroll: false,
      maxEntries: 500,
    });
  });

  it('coerces invalid enum values to safe defaults', () => {
    const s = sanitizeConsoleSettings({
      view: 'weird',
      levelFilter: 'nope',
      categoryFilter: 'nope',
      autoScroll: 'yes',
      maxEntries: 'lots',
    });
    expect(s.view).toBe('structured');
    expect(s.levelFilter).toBe('all');
    expect(s.categoryFilter).toBe('all');
    expect(s.autoScroll).toBe(true);
    expect(s.maxEntries).toBe(WS_CONSOLE_DEFAULT_SETTINGS.maxEntries);
  });

  it('clamps maxEntries to the allowed range', () => {
    expect(sanitizeConsoleSettings({ maxEntries: 5 }).maxEntries).toBe(50);
    expect(sanitizeConsoleSettings({ maxEntries: 999999 }).maxEntries).toBe(50000);
  });

  it('accepts "all" filters', () => {
    const s = sanitizeConsoleSettings({ levelFilter: 'all', categoryFilter: 'all' });
    expect(s.levelFilter).toBe('all');
    expect(s.categoryFilter).toBe('all');
  });
});

describe('load/save console settings', () => {
  beforeEach(() => localStorage.clear());

  it('returns defaults when nothing stored', async () => {
    expect(await loadConsoleSettings(WS_CONSOLE_SETTINGS_KEY)).toEqual(WS_CONSOLE_DEFAULT_SETTINGS);
  });

  it('round-trips through storage', async () => {
    const settings = { ...WS_CONSOLE_DEFAULT_SETTINGS, view: 'raw' as const, autoScroll: false };
    await saveConsoleSettings(WS_CONSOLE_SETTINGS_KEY, settings);
    expect(await loadConsoleSettings(WS_CONSOLE_SETTINGS_KEY)).toEqual(settings);
  });

  it('returns defaults for corrupt JSON', async () => {
    localStorage.setItem(SSE_CONSOLE_SETTINGS_KEY, '{not json');
    expect(await loadConsoleSettings(SSE_CONSOLE_SETTINGS_KEY)).toEqual(WS_CONSOLE_DEFAULT_SETTINGS);
  });

  it('uses distinct keys for WS and SSE', () => {
    expect(WS_CONSOLE_SETTINGS_KEY).not.toBe(SSE_CONSOLE_SETTINGS_KEY);
  });
});
