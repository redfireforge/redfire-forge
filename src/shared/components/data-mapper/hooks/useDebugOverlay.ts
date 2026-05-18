/**
 * Hook that manages the debug trace overlay state for the Data Mapper.
 * Extracts trace processing, error popover state, and overlay maps
 * from the main DataMapper component.
 */

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { MappingTrace } from '../utils/mappingTrace';
import { formatTraceValue, isTraceError } from '../utils/mappingTrace';
import type { TraceValueOverlay } from '../types';
import type { ErrorDetailData } from '../MappingCanvas';

interface UseDebugOverlayOptions {
  traceData?: MappingTrace[];
  currentMappingIds: Set<string>;
  activeSourceId: string;
}

export function useDebugOverlay({ traceData, currentMappingIds, activeSourceId }: UseDebugOverlayOptions) {
  const [debugMode, setDebugMode] = useState(false);
  const [errorPopover, setErrorPopover] = useState<{ data: ErrorDetailData; y: number } | null>(null);
  const errorPopoverRef = useRef<HTMLDivElement | null>(null);

  const traceByMappingId = useMemo(() => {
    if (!traceData || traceData.length === 0) return null;
    const map = new Map<string, MappingTrace>();
    for (const t of traceData) {
      if (currentMappingIds.has(t.mappingId)) map.set(t.mappingId, t);
    }
    return map.size > 0 ? map : null;
  }, [traceData, currentMappingIds]);

  const hasTraceData = traceByMappingId != null;

  useEffect(() => {
    if (!hasTraceData) {
      setDebugMode(false);
      setErrorPopover(null);
    }
  }, [hasTraceData]);

  useEffect(() => {
    if (!debugMode) setErrorPopover(null);
  }, [debugMode]);

  useEffect(() => {
    if (!errorPopover) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (errorPopoverRef.current && !errorPopoverRef.current.contains(e.target as Node)) {
        setErrorPopover(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setErrorPopover(null);
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [errorPopover]);

  const handleShowErrorDetail = useCallback((data: ErrorDetailData, y: number) => {
    setErrorPopover({ data, y });
  }, []);

  const traceErrorCount = useMemo(() => {
    if (!traceByMappingId) return 0;
    let count = 0;
    for (const t of traceByMappingId.values()) if (isTraceError(t)) count++;
    return count;
  }, [traceByMappingId]);

  const sourceTraceOverlay = useMemo<Map<string, TraceValueOverlay> | undefined>(() => {
    if (!debugMode || !traceByMappingId) return undefined;
    const map = new Map<string, TraceValueOverlay>();
    for (const trace of traceByMappingId.values()) {
      const effectiveSourceId = trace.sourceId || activeSourceId;
      if (effectiveSourceId !== activeSourceId) continue;
      if (!map.has(trace.sourcePath)) {
        map.set(trace.sourcePath, {
          value: formatTraceValue(trace.sourceValue, 30),
          isError: trace.sourceValue === undefined,
        });
      }
    }
    return map;
  }, [debugMode, traceByMappingId, activeSourceId]);

  const targetTraceOverlay = useMemo<Map<string, TraceValueOverlay> | undefined>(() => {
    if (!debugMode || !traceByMappingId) return undefined;
    const map = new Map<string, TraceValueOverlay>();
    for (const trace of traceByMappingId.values()) {
      map.set(trace.targetPath, {
        value: formatTraceValue(trace.targetValue, 30),
        isError: isTraceError(trace),
      });
    }
    return map;
  }, [debugMode, traceByMappingId]);

  return {
    debugMode,
    setDebugMode,
    errorPopover,
    setErrorPopover,
    errorPopoverRef,
    traceByMappingId,
    hasTraceData,
    handleShowErrorDetail,
    traceErrorCount,
    sourceTraceOverlay,
    targetTraceOverlay,
  };
}
