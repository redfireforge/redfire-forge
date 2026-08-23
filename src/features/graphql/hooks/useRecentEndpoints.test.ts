/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/utils/storage', () => ({
  readKey: vi.fn().mockResolvedValue(null),
  writeKey: vi.fn().mockResolvedValue(undefined),
}));

import { renderHook, act, waitFor } from '@testing-library/react';
import { readKey, writeKey } from '@shared/utils/storage';
import { useRecentEndpoints } from './useRecentEndpoints';

beforeEach(() => resetAllMocks());

describe('useRecentEndpoints', () => {
  it('starts with empty endpoints when no stored data', async () => {
    vi.mocked(readKey).mockResolvedValue(null);
    const { result } = renderHook(() => useRecentEndpoints());
    await waitFor(() => expect(result.current.endpoints).toEqual([]));
  });

  it('loads stored endpoints on mount', async () => {
    vi.mocked(readKey).mockResolvedValue(JSON.stringify(['http://a.com', 'http://b.com']));
    const { result } = renderHook(() => useRecentEndpoints());
    await waitFor(() => expect(result.current.endpoints).toHaveLength(2));
    expect(result.current.endpoints[0]).toBe('http://a.com');
  });

  it('ignores stored data that is not a JSON array', async () => {
    vi.mocked(readKey).mockResolvedValue('"just a string"');
    const { result } = renderHook(() => useRecentEndpoints());
    await waitFor(() => expect(vi.mocked(readKey)).toHaveBeenCalled());
    expect(result.current.endpoints).toEqual([]);
  });

  it('ignores stored data that is malformed JSON', async () => {
    vi.mocked(readKey).mockResolvedValue('{bad json}');
    const { result } = renderHook(() => useRecentEndpoints());
    await waitFor(() => expect(vi.mocked(readKey)).toHaveBeenCalled());
    expect(result.current.endpoints).toEqual([]);
  });

  it('filters non-string values from stored array', async () => {
    vi.mocked(readKey).mockResolvedValue(JSON.stringify(['http://a.com', 42, null, 'http://b.com']));
    const { result } = renderHook(() => useRecentEndpoints());
    await waitFor(() => expect(result.current.endpoints).toHaveLength(2));
    expect(result.current.endpoints).toEqual(['http://a.com', 'http://b.com']);
  });

  it('push() adds an endpoint to the front', async () => {
    vi.mocked(readKey).mockResolvedValue(JSON.stringify(['http://b.com']));
    const { result } = renderHook(() => useRecentEndpoints());
    await waitFor(() => expect(result.current.endpoints).toHaveLength(1));
    act(() => { result.current.push('http://a.com'); });
    expect(result.current.endpoints[0]).toBe('http://a.com');
    expect(result.current.endpoints[1]).toBe('http://b.com');
  });

  it('push() deduplicates existing entries', async () => {
    vi.mocked(readKey).mockResolvedValue(JSON.stringify(['http://a.com', 'http://b.com']));
    const { result } = renderHook(() => useRecentEndpoints());
    await waitFor(() => expect(result.current.endpoints).toHaveLength(2));
    act(() => { result.current.push('http://b.com'); });
    expect(result.current.endpoints).toEqual(['http://b.com', 'http://a.com']);
  });

  it('push() ignores empty/whitespace-only strings', async () => {
    const { result } = renderHook(() => useRecentEndpoints());
    act(() => { result.current.push('   '); });
    expect(result.current.endpoints).toEqual([]);
  });

  it('push() caps the list at 10 entries', async () => {
    const initial = Array.from({ length: 10 }, (_, i) => `http://ep${i}.com`);
    vi.mocked(readKey).mockResolvedValue(JSON.stringify(initial));
    const { result } = renderHook(() => useRecentEndpoints());
    await waitFor(() => expect(result.current.endpoints).toHaveLength(10));
    act(() => { result.current.push('http://new.com'); });
    expect(result.current.endpoints).toHaveLength(10);
    expect(result.current.endpoints[0]).toBe('http://new.com');
  });

  it('push() persists via writeKey', async () => {
    const { result } = renderHook(() => useRecentEndpoints());
    act(() => { result.current.push('http://persist.com'); });
    expect(vi.mocked(writeKey)).toHaveBeenCalled();
  });

  it('remove() removes a specific endpoint', async () => {
    vi.mocked(readKey).mockResolvedValue(JSON.stringify(['http://a.com', 'http://b.com']));
    const { result } = renderHook(() => useRecentEndpoints());
    await waitFor(() => expect(result.current.endpoints).toHaveLength(2));
    act(() => { result.current.remove('http://a.com'); });
    expect(result.current.endpoints).toEqual(['http://b.com']);
  });

  it('clear() empties all endpoints', async () => {
    vi.mocked(readKey).mockResolvedValue(JSON.stringify(['http://a.com', 'http://b.com']));
    const { result } = renderHook(() => useRecentEndpoints());
    await waitFor(() => expect(result.current.endpoints).toHaveLength(2));
    act(() => { result.current.clear(); });
    expect(result.current.endpoints).toEqual([]);
    expect(vi.mocked(writeKey)).toHaveBeenCalledWith(expect.any(String), JSON.stringify([]));
  });

  it('handles readKey storage failure gracefully', async () => {
    vi.mocked(readKey).mockRejectedValue(new Error('storage down'));
    const { result } = renderHook(() => useRecentEndpoints());
    await waitFor(() => expect(vi.mocked(readKey)).toHaveBeenCalled());
    expect(result.current.endpoints).toEqual([]);
  });

  it('handles writeKey failure when pushing an endpoint', async () => {
    vi.mocked(writeKey).mockRejectedValue(new Error('quota exceeded'));
    const { result } = renderHook(() => useRecentEndpoints());
    act(() => { result.current.push('http://fail.com'); });
    expect(result.current.endpoints).toEqual(['http://fail.com']);
  });
});
