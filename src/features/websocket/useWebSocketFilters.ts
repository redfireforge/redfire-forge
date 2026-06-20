import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { applyFilters } from './wsProtocolHelpers';
import { FILTER_TICK_INTERVAL_MS } from './useWebSocketStudioTypes';
import type { WsFrame } from '../../shared/websocket/types';
import type {
  WsDirectionFilter,
  WsSearchMode,
  WsSizeFilter,
  WsTimeFilter,
  WsContentTypeFilter,
} from './useWebSocketStudioTypes';
export interface UseWebSocketFiltersReturn {
  searchText: string;
  setSearchText: (v: string) => void;
  searchMode: WsSearchMode;
  setSearchMode: (v: WsSearchMode) => void;
  directionFilter: WsDirectionFilter;
  setDirectionFilter: (v: WsDirectionFilter) => void;
  sizeFilter: WsSizeFilter;
  setSizeFilter: (v: WsSizeFilter) => void;
  timeFilter: WsTimeFilter;
  setTimeFilter: (v: WsTimeFilter) => void;
  contentTypeFilter: WsContentTypeFilter;
  setContentTypeFilter: (v: WsContentTypeFilter) => void;
  filteredMessages: WsFrame[];
}

/**
 * Manages all filter/search state for the WebSocket message list and derives
 * the filtered message array. Extracted from useWebSocketStudio to keep that
 * hook under the 900-line monolithic threshold.
 */
export function useWebSocketFilters(
  messages: WsFrame[],
  bookmarkedMessages: WsFrame[],
): UseWebSocketFiltersReturn {
  const [searchText, setSearchTextState] = useState('');
  const [searchMode, setSearchMode] = useState<WsSearchMode>('text');
  const [directionFilter, setDirectionFilter] = useState<WsDirectionFilter>('all');
  const [sizeFilter, setSizeFilter] = useState<WsSizeFilter>('all');
  const [timeFilter, setTimeFilter] = useState<WsTimeFilter>('all');
  const [contentTypeFilter, setContentTypeFilter] = useState<WsContentTypeFilter>('all');

  const filterTickRef = useRef(0);
  const [filterTick, setFilterTick] = useState(0);

  const setSearchText = useCallback((v: string) => setSearchTextState(v), []);

  useEffect(() => {
    if (timeFilter === 'all') return;
    const id = setInterval(() => {
      filterTickRef.current += 1;
      setFilterTick(filterTickRef.current);
    }, FILTER_TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [timeFilter]);

  const filteredMessages = useMemo(
    () => applyFilters(messages, {
      searchText,
      searchMode,
      directionFilter,
      sizeFilter,
      timeFilter,
      contentTypeFilter,
      nowMs: Date.now(),
      bookmarkedMessages,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, searchText, searchMode, directionFilter, sizeFilter, timeFilter, contentTypeFilter, bookmarkedMessages, filterTick],
  );

  return {
    searchText,
    setSearchText,
    searchMode,
    setSearchMode,
    directionFilter,
    setDirectionFilter,
    sizeFilter,
    setSizeFilter,
    timeFilter,
    setTimeFilter,
    contentTypeFilter,
    setContentTypeFilter,
    filteredMessages,
  };
}
