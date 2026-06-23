/**
 * Vertical split pane resize hook — similar to useSplitPaneResize but for height.
 * Used for resizing the GraphQL bottom panel up/down.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { readKey, writeKey } from '../utils/storage';

export interface VerticalSplitPaneResizeOptions {
  storageKey: string;
  defaultHeight: number;
  minHeight: number;
  minOppositeHeight: number;
  maxHeightRatio?: number;
  containerRef: RefObject<HTMLElement | null>;
  step?: number;
  pageStep?: number;
  label?: string;
}

export interface VerticalSplitPaneDividerProps {
  role: 'separator';
  'aria-orientation': 'horizontal';
  'aria-label': string;
  'aria-valuenow': number;
  'aria-valuemin': number;
  'aria-valuemax': number;
  tabIndex: 0;
  onMouseDown: (e: React.MouseEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export interface VerticalSplitPaneResizeReturn {
  height: number;
  maxHeight: number;
  dividerProps: VerticalSplitPaneDividerProps;
}

const SAVE_DEBOUNCE_MS = 300;

export function useVerticalSplitPaneResize(options: VerticalSplitPaneResizeOptions): VerticalSplitPaneResizeReturn {
  const {
    storageKey,
    defaultHeight,
    minHeight,
    minOppositeHeight,
    maxHeightRatio,
    containerRef,
    step = 16,
    pageStep = 64,
    label = 'Resize panels',
  } = options;

  const [height, setHeight] = useState(defaultHeight);
  const [maxHeight, setMaxHeight] = useState(defaultHeight);

  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadedRef = useRef(false);

  // Load persisted height on mount
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const raw = await readKey(storageKey);
      if (!cancelled && raw != null) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed > 0) {
          setHeight(Math.max(minHeight, parsed));
        }
      }
      loadedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
    // Load once per storage key
  }, [storageKey, minHeight]);

  // Persist height changes (debounced)
  useEffect(() => {
    if (!loadedRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      void writeKey(storageKey, String(Math.round(height)));
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [height, storageKey]);

  // Measure max height when container changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateMaxHeight = () => {
      const containerHeight = container.clientHeight;
      const computed = containerHeight - minOppositeHeight;
      setMaxHeight(Math.max(minHeight, computed));
    };

    updateMaxHeight();
    
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateMaxHeight);
      observer.observe(container);
      return () => observer.disconnect();
    }
  }, [containerRef, minHeight, minOppositeHeight]);

  const clampHeight = useCallback(
    (h: number) => {
      const liveContainerHeight = containerRef.current?.clientHeight;
      const liveMaxHeight =
        typeof liveContainerHeight === 'number' && liveContainerHeight > 0
          ? Math.max(minHeight, liveContainerHeight - minOppositeHeight)
          : maxHeight;
      const ratio = maxHeightRatio ? liveMaxHeight * maxHeightRatio : liveMaxHeight;
      return Math.max(minHeight, Math.min(h, ratio));
    },
    [containerRef, minHeight, minOppositeHeight, maxHeight, maxHeightRatio],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      dragRef.current = { startY: e.clientY, startH: height };

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = ev.clientY - dragRef.current.startY;
        const newHeight = clampHeight(dragRef.current.startH - delta);
        setHeight(newHeight);
      };

      const handleMouseUp = () => {
        dragRef.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [height, clampHeight],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();

      const isShift = e.shiftKey;
      const isPage = e.key.includes('Page');
      const stepSize = isPage || isShift ? pageStep : step;
      const direction = e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Home' ? 1 : -1;
      const delta = e.key === 'Home' ? minHeight - height : e.key === 'End' ? maxHeight - height : direction * stepSize;

      setHeight(clampHeight(height + delta));
    },
    [height, minHeight, maxHeight, step, pageStep, clampHeight],
  );

  return {
    height,
    maxHeight,
    dividerProps: {
      role: 'separator',
      'aria-orientation': 'horizontal',
      'aria-label': label,
      'aria-valuenow': height,
      'aria-valuemin': minHeight,
      'aria-valuemax': maxHeight,
      tabIndex: 0,
      onMouseDown: handleMouseDown,
      onKeyDown: handleKeyDown,
    },
  };
}
