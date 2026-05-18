/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  isDataMapperOverlayOpen,
  resolvePortalRoot,
} from './dataMapperOverlay';

describe('dataMapperOverlay', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('isDataMapperOverlayOpen', () => {
    it('returns false when no overlay elements exist', () => {
      expect(isDataMapperOverlayOpen()).toBe(false);
    });

    it('returns true when .dm-expr-overlay exists', () => {
      const el = document.createElement('div');
      el.className = 'dm-expr-overlay';
      document.body.appendChild(el);
      expect(isDataMapperOverlayOpen()).toBe(true);
    });

    it('returns true when .dm-diff-overlay exists', () => {
      const el = document.createElement('div');
      el.className = 'dm-diff-overlay';
      document.body.appendChild(el);
      expect(isDataMapperOverlayOpen()).toBe(true);
    });

    it('returns true when .dm-example-overlay exists', () => {
      const el = document.createElement('div');
      el.className = 'dm-example-overlay';
      document.body.appendChild(el);
      expect(isDataMapperOverlayOpen()).toBe(true);
    });

    it('returns true when validation-rules-docked exists', () => {
      const el = document.createElement('div');
      el.className = 'validation-rules-docked';
      document.body.appendChild(el);
      expect(isDataMapperOverlayOpen()).toBe(true);
    });
  });

  describe('resolvePortalRoot', () => {
    it('returns document.body when no element provided', () => {
      expect(resolvePortalRoot()).toBe(document.body);
    });

    it('returns .dm-modal-shell if element is inside one', () => {
      const shell = document.createElement('div');
      shell.className = 'dm-modal-shell';
      const child = document.createElement('span');
      shell.appendChild(child);
      document.body.appendChild(shell);
      expect(resolvePortalRoot(child)).toBe(shell);
    });

    it('returns .dm-modal-overlay as fallback', () => {
      const overlay = document.createElement('div');
      overlay.className = 'dm-modal-overlay';
      const child = document.createElement('span');
      overlay.appendChild(child);
      document.body.appendChild(overlay);
      expect(resolvePortalRoot(child)).toBe(overlay);
    });

    it('falls back to global .dm-modal-shell if element has no ancestor', () => {
      const shell = document.createElement('div');
      shell.className = 'dm-modal-shell';
      document.body.appendChild(shell);
      const orphan = document.createElement('div');
      document.body.appendChild(orphan);
      expect(resolvePortalRoot(orphan)).toBe(shell);
    });

    it('returns document.body when nothing matches', () => {
      const orphan = document.createElement('div');
      document.body.appendChild(orphan);
      expect(resolvePortalRoot(orphan)).toBe(document.body);
    });
  });
});
