/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocketFilters } from './useWebSocketFilters';
import type { WsFrame } from '../../shared/websocket/types';

const makeFrame = (overrides: Partial<WsFrame> = {}): WsFrame => ({
  id: Math.random().toString(),
  direction: 'received',
  type: 'text',
  data: 'hello',
  size: 5,
  timestamp: new Date().toISOString(),
  ...overrides,
});

describe('useWebSocketFilters', () => {
  it('initialises with default filter values', () => {
    const { result } = renderHook(() => useWebSocketFilters([], []));
    expect(result.current.searchText).toBe('');
    expect(result.current.searchMode).toBe('text');
    expect(result.current.directionFilter).toBe('all');
    expect(result.current.sizeFilter).toBe('all');
    expect(result.current.timeFilter).toBe('all');
    expect(result.current.contentTypeFilter).toBe('all');
  });

  it('returns all messages when no filters are active', () => {
    const msgs = [makeFrame({ data: 'hello' }), makeFrame({ data: 'world' })];
    const { result } = renderHook(() => useWebSocketFilters(msgs, []));
    expect(result.current.filteredMessages).toHaveLength(2);
  });

  it('filters messages by searchText', () => {
    const msgs = [
      makeFrame({ data: 'alpha' }),
      makeFrame({ data: 'beta' }),
    ];
    const { result } = renderHook(() => useWebSocketFilters(msgs, []));
    act(() => result.current.setSearchText('alpha'));
    expect(result.current.filteredMessages).toHaveLength(1);
    expect(result.current.filteredMessages[0].data).toBe('alpha');
  });

  it('setSearchText updates the searchText value', () => {
    const { result } = renderHook(() => useWebSocketFilters([], []));
    act(() => result.current.setSearchText('my search'));
    expect(result.current.searchText).toBe('my search');
  });

  it('setSearchMode updates the searchMode value', () => {
    const { result } = renderHook(() => useWebSocketFilters([], []));
    act(() => result.current.setSearchMode('regex'));
    expect(result.current.searchMode).toBe('regex');
  });

  it('setDirectionFilter updates directionFilter', () => {
    const { result } = renderHook(() => useWebSocketFilters([], []));
    act(() => result.current.setDirectionFilter('sent'));
    expect(result.current.directionFilter).toBe('sent');
  });

  it('setSizeFilter updates sizeFilter', () => {
    const { result } = renderHook(() => useWebSocketFilters([], []));
    act(() => result.current.setSizeFilter('lt1k'));
    expect(result.current.sizeFilter).toBe('lt1k');
  });

  it('setTimeFilter updates timeFilter', () => {
    const { result } = renderHook(() => useWebSocketFilters([], []));
    act(() => result.current.setTimeFilter('last30s'));
    expect(result.current.timeFilter).toBe('last30s');
  });

  it('setContentTypeFilter updates contentTypeFilter', () => {
    const { result } = renderHook(() => useWebSocketFilters([], []));
    act(() => result.current.setContentTypeFilter('json'));
    expect(result.current.contentTypeFilter).toBe('json');
  });

  it('filters by direction (sent)', () => {
    const msgs = [
      makeFrame({ direction: 'sent', data: 'sent-msg' }),
      makeFrame({ direction: 'received', data: 'recv-msg' }),
    ];
    const { result } = renderHook(() => useWebSocketFilters(msgs, []));
    act(() => result.current.setDirectionFilter('sent'));
    expect(result.current.filteredMessages).toHaveLength(1);
    expect(result.current.filteredMessages[0].data).toBe('sent-msg');
  });

  it('filters by direction (received)', () => {
    const msgs = [
      makeFrame({ direction: 'sent', data: 'sent-msg' }),
      makeFrame({ direction: 'received', data: 'recv-msg' }),
    ];
    const { result } = renderHook(() => useWebSocketFilters(msgs, []));
    act(() => result.current.setDirectionFilter('received'));
    expect(result.current.filteredMessages).toHaveLength(1);
    expect(result.current.filteredMessages[0].data).toBe('recv-msg');
  });

  it('returns bookmarked messages when directionFilter is "bookmarked"', () => {
    const a = makeFrame({ id: 'a', data: 'A' });
    const b = makeFrame({ id: 'b', data: 'B' });
    const msgs = [a, b];
    const bookmarked = [a];
    const { result } = renderHook(() => useWebSocketFilters(msgs, bookmarked));
    act(() => result.current.setDirectionFilter('bookmarked'));
    expect(result.current.filteredMessages).toHaveLength(1);
    expect(result.current.filteredMessages[0].id).toBe('a');
  });

  it('reacts to messages prop changes', () => {
    let msgs: WsFrame[] = [];
    const { result, rerender } = renderHook(() => useWebSocketFilters(msgs, []));
    expect(result.current.filteredMessages).toHaveLength(0);

    msgs = [makeFrame({ data: 'new' })];
    rerender();
    expect(result.current.filteredMessages).toHaveLength(1);
  });
});
