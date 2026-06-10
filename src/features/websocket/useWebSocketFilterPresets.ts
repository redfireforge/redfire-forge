import { useCallback, useEffect, useState } from 'react';
import type { WsFilterPreset } from '../../shared/websocket/types';
import type { WsSearchMode, WsSizeFilter, WsTimeFilter, WsContentTypeFilter } from './useWebSocketStudioTypes';
import { loadWsFilterPresets, saveWsFilterPresets } from '../../shared/websocket/websocketStorage';

export interface FilterPresetActions {
  filterPresets: WsFilterPreset[];
  handleSavePreset: () => void;
  handleDeletePreset: (id: string) => void;
  handleApplyPreset: (preset: WsFilterPreset) => void;
}

export interface FilterPresetDeps {
  searchMode: WsSearchMode;
  searchText: string;
  sizeFilter: WsSizeFilter;
  timeFilter: WsTimeFilter;
  contentTypeFilter: WsContentTypeFilter;
  setSearchMode: (v: WsSearchMode) => void;
  setSearchText: (v: string) => void;
  setSizeFilter: (v: WsSizeFilter) => void;
  setTimeFilter: (v: WsTimeFilter) => void;
  setContentTypeFilter: (v: WsContentTypeFilter) => void;
  setShowFilterBar: (fn: (v: boolean) => boolean) => void;
  setPresetDropdownOpen: (v: boolean) => void;
}

export function useWebSocketFilterPresets(deps: FilterPresetDeps): FilterPresetActions {
  const {
    searchMode, searchText, sizeFilter, timeFilter, contentTypeFilter,
    setSearchMode, setSearchText, setSizeFilter, setTimeFilter, setContentTypeFilter,
    setShowFilterBar, setPresetDropdownOpen,
  } = deps;

  const [filterPresets, setFilterPresets] = useState<WsFilterPreset[]>([]);

  useEffect(() => {
    loadWsFilterPresets().then(setFilterPresets).catch(() => {});
  }, []);

  const handleSavePreset = useCallback(() => {
    const name = window.prompt('Preset name:');
    if (!name?.trim()) return;
    const preset: WsFilterPreset = {
      id: `fp-${Date.now()}`,
      name: name.trim(),
      searchMode,
      searchQuery: searchText,
      sizeFilter,
      timeFilter,
      contentTypeFilter,
      createdAt: new Date().toISOString(),
    };
    const next = [preset, ...filterPresets].slice(0, 20);
    setFilterPresets(next);
    saveWsFilterPresets(next).catch(() => {});
  }, [searchMode, searchText, sizeFilter, timeFilter, contentTypeFilter, filterPresets]);

  const handleDeletePreset = useCallback((id: string) => {
    const next = filterPresets.filter((p) => p.id !== id);
    setFilterPresets(next);
    saveWsFilterPresets(next).catch(() => {});
  }, [filterPresets]);

  const handleApplyPreset = useCallback((preset: WsFilterPreset) => {
    setSearchMode(preset.searchMode || 'text');
    setSearchText(preset.searchQuery || '');
    setSizeFilter(preset.sizeFilter || 'all');
    setTimeFilter(preset.timeFilter || 'all');
    setContentTypeFilter(preset.contentTypeFilter || 'all');
    setPresetDropdownOpen(false);
    const hasAttrFilters = (preset.sizeFilter && preset.sizeFilter !== 'all')
      || (preset.timeFilter && preset.timeFilter !== 'all')
      || (preset.contentTypeFilter && preset.contentTypeFilter !== 'all');
    if (hasAttrFilters) setShowFilterBar(() => true);
  }, [setSearchMode, setSearchText, setSizeFilter, setTimeFilter, setContentTypeFilter, setPresetDropdownOpen, setShowFilterBar]);

  return { filterPresets, handleSavePreset, handleDeletePreset, handleApplyPreset };
}
