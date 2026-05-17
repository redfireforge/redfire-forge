import { describe, it, expect, vi } from 'vitest';
import { commitCancelKeyHandler, disclosureKeyHandler } from './keyboardHandlers';

function makeKeyEvent(key: string): { key: string; preventDefault: ReturnType<typeof vi.fn> } {
  return { key, preventDefault: vi.fn() };
}

describe('keyboardHandlers', () => {
  describe('commitCancelKeyHandler', () => {
    it('calls onCommit on Enter', () => {
      const onCommit = vi.fn();
      const onCancel = vi.fn();
      const handler = commitCancelKeyHandler(onCommit, onCancel);
      const e = makeKeyEvent('Enter');
      handler(e as never);
      expect(onCommit).toHaveBeenCalledOnce();
      expect(e.preventDefault).toHaveBeenCalled();
    });

    it('calls onCancel on Escape', () => {
      const onCommit = vi.fn();
      const onCancel = vi.fn();
      const handler = commitCancelKeyHandler(onCommit, onCancel);
      const e = makeKeyEvent('Escape');
      handler(e as never);
      expect(onCancel).toHaveBeenCalledOnce();
      expect(e.preventDefault).toHaveBeenCalled();
    });

    it('does nothing for other keys', () => {
      const onCommit = vi.fn();
      const onCancel = vi.fn();
      const handler = commitCancelKeyHandler(onCommit, onCancel);
      const e = makeKeyEvent('Tab');
      handler(e as never);
      expect(onCommit).not.toHaveBeenCalled();
      expect(onCancel).not.toHaveBeenCalled();
      expect(e.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('disclosureKeyHandler', () => {
    it('calls onToggle on Enter', () => {
      const onToggle = vi.fn();
      const handler = disclosureKeyHandler(onToggle);
      const e = makeKeyEvent('Enter');
      handler(e as never);
      expect(onToggle).toHaveBeenCalledOnce();
      expect(e.preventDefault).toHaveBeenCalled();
    });

    it('calls onToggle on Space', () => {
      const onToggle = vi.fn();
      const handler = disclosureKeyHandler(onToggle);
      const e = makeKeyEvent(' ');
      handler(e as never);
      expect(onToggle).toHaveBeenCalledOnce();
    });

    it('does nothing for other keys', () => {
      const onToggle = vi.fn();
      const handler = disclosureKeyHandler(onToggle);
      const e = makeKeyEvent('a');
      handler(e as never);
      expect(onToggle).not.toHaveBeenCalled();
      expect(e.preventDefault).not.toHaveBeenCalled();
    });
  });
});
