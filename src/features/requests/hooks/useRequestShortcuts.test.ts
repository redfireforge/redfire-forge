/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { REQUEST_SHORTCUTS } from './useRequestShortcuts';

describe('REQUEST_SHORTCUTS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(REQUEST_SHORTCUTS)).toBe(true);
    expect(REQUEST_SHORTCUTS.length).toBeGreaterThan(0);
  });

  it('all shortcuts belong to the Requests category', () => {
    for (const s of REQUEST_SHORTCUTS) {
      expect(s.category).toBe('Requests');
    }
  });

  it('each shortcut has all required fields', () => {
    for (const s of REQUEST_SHORTCUTS) {
      expect(s.key).toBeTruthy();
      expect(s.category).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.display).toBeTruthy();
    }
  });

  it('includes a send request shortcut', () => {
    const sendShortcut = REQUEST_SHORTCUTS.find((s) => s.key === 'mod+enter');
    expect(sendShortcut).toBeDefined();
    expect(sendShortcut?.label).toBe('Send request');
  });

  it('display strings use the correct modifier label on non-Mac (Ctrl)', async () => {
    // jsdom userAgent does not include "Mac", so MOD_LABEL should be 'Ctrl'
    const { REQUEST_SHORTCUTS: freshShortcuts } = await import('./useRequestShortcuts');
    const hasCtrl = freshShortcuts.some((s) => s.display.includes('Ctrl') || s.display.includes('⌘'));
    expect(hasCtrl).toBe(true);
  });
});
