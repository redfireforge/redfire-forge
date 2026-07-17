/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { installClipboardMock, installClipboardReadMock, installEmptyClipboard } from './clipboardMock';

describe('clipboardMock', () => {
  it('installClipboardMock installs a writable clipboard mock', async () => {
    const writeText = installClipboardMock();
    await navigator.clipboard.writeText('hello');
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('installClipboardReadMock installs a readable clipboard mock', async () => {
    const readText = installClipboardReadMock();
    const value = await navigator.clipboard.readText();
    expect(readText).toHaveBeenCalled();
    expect(value).toBe('');
  });

  it('installEmptyClipboard installs empty clipboard and restore function reinstates prior value', () => {
    // First install a real mock so we have something to restore
    installClipboardMock();
    const clipBefore = navigator.clipboard;

    const restore = installEmptyClipboard();
    // After install, the clipboard is an empty object
    const empty = (navigator as Navigator & { clipboard?: unknown }).clipboard as Record<string, unknown>;
    expect(empty.writeText).toBeUndefined();

    restore();
    expect((navigator as Navigator & { clipboard?: unknown }).clipboard).toBe(clipBefore);
  });
});
