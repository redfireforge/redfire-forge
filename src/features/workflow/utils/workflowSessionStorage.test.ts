/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadConsoleOpen,
  saveConsoleOpen,
  loadConsoleRunBehavior,
  saveConsoleRunBehavior,
} from './workflowSessionStorage';

describe('workflowSessionStorage', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => store[key] ?? null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, val) => { store[key] = val; });
  });

  describe('loadConsoleOpen / saveConsoleOpen', () => {
    it('returns false by default', () => {
      expect(loadConsoleOpen()).toBe(false);
    });

    it('returns true after saving true', () => {
      saveConsoleOpen(true);
      expect(loadConsoleOpen()).toBe(true);
    });

    it('returns false after saving false', () => {
      saveConsoleOpen(true);
      saveConsoleOpen(false);
      expect(loadConsoleOpen()).toBe(false);
    });

    it('returns false when sessionStorage throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
      expect(loadConsoleOpen()).toBe(false);
    });
  });

  describe('loadConsoleRunBehavior / saveConsoleRunBehavior', () => {
    it('returns clear by default', () => {
      expect(loadConsoleRunBehavior()).toBe('clear');
    });

    it('returns append after saving append', () => {
      saveConsoleRunBehavior('append');
      expect(loadConsoleRunBehavior()).toBe('append');
    });

    it('returns clear for invalid stored values', () => {
      store['wf-console-run-behavior'] = 'invalid';
      expect(loadConsoleRunBehavior()).toBe('clear');
    });

    it('returns clear when sessionStorage throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
      expect(loadConsoleRunBehavior()).toBe('clear');
    });
  });
});
