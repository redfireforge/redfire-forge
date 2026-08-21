/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppTabSync } from './useAppTabSync';

const {
  setLastProtocolsTab,
  writeTabToUrl,
  isProtocolsTab,
  writeKey,
} = vi.hoisted(() => ({
  setLastProtocolsTab: vi.fn(),
  writeTabToUrl: vi.fn(),
  isProtocolsTab: vi.fn<(tab: string) => boolean>(),
  writeKey: vi.fn(),
}));

vi.mock('../utils/appTabUtils', () => ({
  LAST_PROTOCOLS_TAB_STORAGE_KEY: 'rf:lastProtocolsTab',
  setLastProtocolsTab,
  writeTabToUrl,
  isProtocolsTab,
}));

vi.mock('../../shared/utils/storage', () => ({
  writeKey,
}));

describe('useAppTabSync', () => {
  beforeEach(() => {
    setLastProtocolsTab.mockReset();
    writeTabToUrl.mockReset();
    isProtocolsTab.mockReset();
    isProtocolsTab.mockReturnValue(false);
    writeKey.mockReset();
    writeKey.mockResolvedValue(undefined);
  });

  it('clears export-to-mock when tab is not catalog', () => {
    const setExportToMockItems = vi.fn();
    const setGalleryInitialDomain = vi.fn();

    renderHook(() => useAppTabSync('requests', setExportToMockItems, setGalleryInitialDomain));

    expect(setExportToMockItems).toHaveBeenCalledWith(null);
    expect(setGalleryInitialDomain).toHaveBeenCalledWith(undefined);
    expect(writeTabToUrl).toHaveBeenCalledWith('requests');
  });

  it('does not clear export-to-mock when tab is catalog', () => {
    const setExportToMockItems = vi.fn();
    const setGalleryInitialDomain = vi.fn();

    renderHook(() => useAppTabSync('catalog', setExportToMockItems, setGalleryInitialDomain));

    expect(setExportToMockItems).not.toHaveBeenCalled();
    expect(writeTabToUrl).toHaveBeenCalledWith('catalog');
  });

  it('persists the last protocol tab and swallows write errors', async () => {
    isProtocolsTab.mockReturnValue(true);
    writeKey.mockRejectedValue(new Error('quota'));

    const setExportToMockItems = vi.fn();
    const setGalleryInitialDomain = vi.fn();

    renderHook(() => useAppTabSync('grpc', setExportToMockItems, setGalleryInitialDomain));

    expect(setLastProtocolsTab).toHaveBeenCalledWith('grpc');
    expect(writeKey).toHaveBeenCalledWith('rf:lastProtocolsTab', 'grpc');

    // Flush the rejected promise to execute the inline catch callback.
    await Promise.resolve();
  });

  it('keeps gallery initial domain when the gallery tab is active', () => {
    const setExportToMockItems = vi.fn();
    const setGalleryInitialDomain = vi.fn();

    renderHook(() => useAppTabSync('gallery', setExportToMockItems, setGalleryInitialDomain));

    expect(setGalleryInitialDomain).not.toHaveBeenCalled();
    expect(writeTabToUrl).toHaveBeenCalledWith('gallery');
  });
});
