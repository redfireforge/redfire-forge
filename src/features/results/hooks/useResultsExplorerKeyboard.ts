import { useEffect } from 'react';
import type { WorkflowExecutionTrace } from '../../../shared/types';
import { getIterationByIndex } from '../utils/iterationLookup';

interface UseResultsExplorerKeyboardOptions {
  onClose: () => void;
  selectedNodeId: string | undefined;
  currentTrace: WorkflowExecutionTrace;
  selectedIteration: number | undefined;
  consoleOpen: boolean;
  mapperOverlayOpen: boolean;
  setMapperOverlayOpen: (open: boolean) => void;
  setConsoleOpen: (next: boolean) => void;
  setSelectedNodeId: (id: string | undefined) => void;
  setSelectedIteration: (next: number | undefined | ((prev: number | undefined) => number | undefined)) => void;
  setMatrixCollapsed: (next: boolean | ((prev: boolean) => boolean)) => void;
  setViewMode: (next: 'diagram' | 'timeline' | ((prev: 'diagram' | 'timeline') => 'diagram' | 'timeline')) => void;
  setDetailCollapsed: (next: boolean | ((prev: boolean) => boolean)) => void;
  focusSearchInput: () => void;
}

export function useResultsExplorerKeyboard({
  onClose,
  selectedNodeId,
  currentTrace,
  selectedIteration,
  consoleOpen,
  mapperOverlayOpen,
  setMapperOverlayOpen,
  setConsoleOpen,
  setSelectedNodeId,
  setSelectedIteration,
  setMatrixCollapsed,
  setViewMode,
  setDetailCollapsed,
  focusSearchInput,
}: UseResultsExplorerKeyboardOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mapperOverlayOpen) {
          setMapperOverlayOpen(false);
        } else if (consoleOpen) {
          setConsoleOpen(false);
        } else if (selectedNodeId) {
          setSelectedNodeId(undefined);
        } else {
          onClose();
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setConsoleOpen(!consoleOpen);
        return;
      }

      if (currentTrace.totalIterations <= 1) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedIteration(prev => {
          if (prev === undefined) return currentTrace.totalIterations - 1;
          return prev > 0 ? prev - 1 : prev;
        });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedIteration(prev => {
          if (prev === undefined) return 0;
          return prev < currentTrace.totalIterations - 1 ? prev + 1 : prev;
        });
      } else if ((e.key === 'a' || e.key === 'A') && !e.ctrlKey && !e.metaKey) {
        setSelectedIteration(undefined);
      } else if (e.key === 'm' || e.key === 'M') {
        setMatrixCollapsed(prev => !prev);
      } else if (e.key === ' ') {
        e.preventDefault();
        setSelectedIteration(prev => prev === undefined ? 0 : undefined);
      } else if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < currentTrace.totalIterations) {
          setSelectedIteration(idx);
        }
      } else if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        const active = document.activeElement;
        if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA') return;
        e.preventDefault();
        focusSearchInput();
      } else if ((e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey) {
        const active = document.activeElement;
        if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA') return;
        setViewMode(prev => prev === 'diagram' ? 'timeline' : 'diagram');
      } else if ((e.key === 'd' || e.key === 'D') && !e.ctrlKey && !e.metaKey) {
        const active = document.activeElement;
        if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA') return;
        setDetailCollapsed(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    onClose,
    selectedNodeId,
    currentTrace.totalIterations,
    consoleOpen,
    mapperOverlayOpen,
    setMapperOverlayOpen,
    setConsoleOpen,
    setSelectedNodeId,
    setSelectedIteration,
    setMatrixCollapsed,
    setViewMode,
    setDetailCollapsed,
    focusSearchInput,
  ]);

  useEffect(() => {
    if (selectedIteration === undefined) return;
    if (!getIterationByIndex(currentTrace, selectedIteration)) {
      setSelectedIteration(undefined);
    }
  }, [currentTrace, selectedIteration, setSelectedIteration]);
}
