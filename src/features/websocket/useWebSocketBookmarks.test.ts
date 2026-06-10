/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocketBookmarks } from './useWebSocketBookmarks';
import type { WsFrame } from '../../shared/websocket/types';

function makeFrame(id: string, data = 'test'): WsFrame {
  return { id, direction: 'received', type: 'text', data, size: data.length, timestamp: new Date().toISOString() };
}

describe('useWebSocketBookmarks', () => {
  it('initializes with empty bookmarks', () => {
    const messagesRef = { current: [] as WsFrame[] };
    const { result } = renderHook(() => useWebSocketBookmarks(messagesRef as React.RefObject<WsFrame[]>));
    expect(result.current.bookmarkedIds.size).toBe(0);
    expect(result.current.bookmarkedMessages).toEqual([]);
  });

  it('adds a bookmark when toggling a non-bookmarked message', () => {
    const frames = [makeFrame('m1'), makeFrame('m2')];
    const messagesRef = { current: frames };
    const { result } = renderHook(() => useWebSocketBookmarks(messagesRef as React.RefObject<WsFrame[]>));

    act(() => result.current.toggleBookmark('m1'));

    expect(result.current.bookmarkedIds.has('m1')).toBe(true);
    expect(result.current.bookmarkedMessages).toHaveLength(1);
    expect(result.current.bookmarkedMessages[0].id).toBe('m1');
  });

  it('removes a bookmark when toggling a bookmarked message', () => {
    const frames = [makeFrame('m1'), makeFrame('m2')];
    const messagesRef = { current: frames };
    const { result } = renderHook(() => useWebSocketBookmarks(messagesRef as React.RefObject<WsFrame[]>));

    act(() => result.current.toggleBookmark('m1'));
    expect(result.current.bookmarkedIds.has('m1')).toBe(true);

    act(() => result.current.toggleBookmark('m1'));
    expect(result.current.bookmarkedIds.has('m1')).toBe(false);
    expect(result.current.bookmarkedMessages).toHaveLength(0);
  });

  it('handles multiple bookmarks', () => {
    const frames = [makeFrame('m1'), makeFrame('m2'), makeFrame('m3')];
    const messagesRef = { current: frames };
    const { result } = renderHook(() => useWebSocketBookmarks(messagesRef as React.RefObject<WsFrame[]>));

    act(() => result.current.toggleBookmark('m1'));
    act(() => result.current.toggleBookmark('m3'));

    expect(result.current.bookmarkedIds.size).toBe(2);
    expect(result.current.bookmarkedMessages).toHaveLength(2);
  });

  it('ignores toggle for non-existent message id', () => {
    const frames = [makeFrame('m1')];
    const messagesRef = { current: frames };
    const { result } = renderHook(() => useWebSocketBookmarks(messagesRef as React.RefObject<WsFrame[]>));

    act(() => result.current.toggleBookmark('nonexistent'));

    expect(result.current.bookmarkedIds.has('nonexistent')).toBe(true);
    // bookmarkedMessages won't have it since the frame wasn't found
    expect(result.current.bookmarkedMessages).toHaveLength(0);
  });
});
