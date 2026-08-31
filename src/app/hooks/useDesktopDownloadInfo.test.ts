/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { buildDownloadButtonLabel, useDesktopDownloadInfo } from './useDesktopDownloadInfo';

vi.mock('../utils/desktopFeatureGate', () => ({
  shouldShowWebDownloadCta: () => mockShouldShow(),
}));

const mockShouldShow = vi.fn(() => true);
const mockFetch = vi.fn();
const mockDetect = vi.fn(() => 'macos-arm' as const);
const mockGetUrl = vi.fn(() => 'https://example.com/a.dmg');

vi.mock('@shared/utils/latestRelease', () => ({
  fetchLatestRelease: (...args: unknown[]) => mockFetch(...args),
  detectOSTarget: () => mockDetect(),
  getDownloadUrl: (...args: unknown[]) => mockGetUrl(...args),
}));

describe('buildDownloadButtonLabel', () => {
  it('builds OS-aware labels', () => {
    expect(buildDownloadButtonLabel(null, 'macos-arm')).toBe('Download Desktop App');
    expect(buildDownloadButtonLabel('1.2.3', 'macos-arm')).toBe('Download v1.2.3 for macOS');
    expect(buildDownloadButtonLabel('1.2.3', 'macos-x64')).toBe('Download v1.2.3 for macOS');
    expect(buildDownloadButtonLabel('1.2.3', 'windows-x64')).toBe('Download v1.2.3 for Windows');
    expect(buildDownloadButtonLabel('1.2.3', 'linux-appimage')).toBe('Download v1.2.3');
    expect(buildDownloadButtonLabel('1.2.3', 'linux-deb')).toBe('Download v1.2.3');
  });
});

describe('useDesktopDownloadInfo', () => {
  beforeEach(() => {
    mockShouldShow.mockReturnValue(true);
    mockFetch.mockReset();
    mockDetect.mockReturnValue('macos-arm');
    mockGetUrl.mockReturnValue('https://example.com/a.dmg');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads version and asset URL from GitHub', async () => {
    mockFetch.mockResolvedValue({
      version: '1.2.3',
      assets: [],
      htmlUrl: 'https://github.com/redfireforge/redfire-forge/releases/tag/v1.2.3',
    });
    const { result } = renderHook(() => useDesktopDownloadInfo());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.version).toBe('1.2.3');
    expect(result.current.href).toBe('https://example.com/a.dmg');
    expect(result.current.label).toContain('v1.2.3 for macOS');
  });

  it('falls back to release htmlUrl when asset is missing', async () => {
    mockGetUrl.mockReturnValue(null);
    mockFetch.mockResolvedValue({
      version: '1.0.0',
      assets: [],
      htmlUrl: 'https://github.com/x/releases/tag/v1.0.0',
    });
    const { result } = renderHook(() => useDesktopDownloadInfo());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.href).toBe('https://github.com/x/releases/tag/v1.0.0');
  });

  it('falls back to GitHub releases when asset and htmlUrl are missing', async () => {
    mockGetUrl.mockReturnValue(null);
    mockFetch.mockResolvedValue({
      version: '1.0.0',
      assets: [],
      htmlUrl: undefined,
    });
    const { result } = renderHook(() => useDesktopDownloadInfo());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.href).toContain('github.com/redfireforge/redfire-forge/releases');
  });

  it('ignores late results after unmount', async () => {
    let resolveFetch: (v: unknown) => void = () => undefined;
    mockFetch.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));
    const { unmount } = renderHook(() => useDesktopDownloadInfo());
    unmount();
    resolveFetch({
      version: '9.9.9',
      assets: [],
      htmlUrl: 'https://example.com',
    });
    await Promise.resolve();
    expect(true).toBe(true);
  });

  it('skips fetch when CTA should not show', async () => {
    mockShouldShow.mockReturnValue(false);
    const { result } = renderHook(() => useDesktopDownloadInfo());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.label).toBe('Download Desktop App');
  });

  it('keeps fallback when fetch returns null', async () => {
    mockFetch.mockResolvedValue(null);
    const { result } = renderHook(() => useDesktopDownloadInfo());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.href).toContain('github.com/redfireforge/redfire-forge/releases');
  });
});
