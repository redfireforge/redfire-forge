import { useCallback } from 'react';

interface UseDataMapperFocusCallbacksParams {
  selectMapping: (id: string | null) => void;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  clearHover: () => void;
  rawNavigateToFailure: (path: string) => void;
  setScrollToPathSignal: React.Dispatch<
    React.SetStateAction<{ path: string; tick: number } | null>
  >;
  setCompactMode: React.Dispatch<React.SetStateAction<boolean>>;
  setAdvancedControlsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useDataMapperFocusCallbacks({
  selectMapping,
  setSelectedIds,
  clearHover,
  rawNavigateToFailure,
  setScrollToPathSignal,
  setCompactMode,
  setAdvancedControlsOpen,
}: UseDataMapperFocusCallbacksParams) {
  const handleSelectMappingExclusive = useCallback(
    (id: string | null) => {
      selectMapping(id);
      setSelectedIds(new Set());
      clearHover();
    },
    [selectMapping, setSelectedIds, clearHover],
  );

  const handleNavigateToFailure = useCallback(
    (path: string) => {
      rawNavigateToFailure(path);
      setScrollToPathSignal({ path, tick: Date.now() });
    },
    [rawNavigateToFailure, setScrollToPathSignal],
  );

  const handleJumpToNode = useCallback(
    (path: string) => {
      setScrollToPathSignal({ path, tick: Date.now() });
    },
    [setScrollToPathSignal],
  );

  const handleToggleCompactMode = useCallback(() => {
    setCompactMode((mode) => {
      const nextMode = !mode;
      if (nextMode) {
        setAdvancedControlsOpen(false);
      }
      return nextMode;
    });
  }, [setCompactMode, setAdvancedControlsOpen]);

  return {
    handleSelectMappingExclusive,
    handleNavigateToFailure,
    handleJumpToNode,
    handleToggleCompactMode,
  };
}
