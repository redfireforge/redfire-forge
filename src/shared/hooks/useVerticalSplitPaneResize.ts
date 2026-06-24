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
  const heightRef = useRef(defaultHeight);
  const loadedRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    heightRef.current = height;
  }, [height]);

  const clampHeight = useCallback(
    (h: number) => {
      const container = containerRef.current;
      if (!container || container.clientHeight <= 0) {
        return Math.max(minHeight, Math.min(h, defaultHeight));
      }
      let max = Math.max(minHeight, container.clientHeight - minOppositeHeight);
      if (maxHeightRatio != null) {
        max = Math.min(max, Math.floor(container.clientHeight * maxHeightRatio));
      }
      return Math.max(minHeight, Math.min(max, h));
    },
    [containerRef, minHeight, minOppositeHeight, maxHeightRatio, defaultHeight],
  );

  const measureContainer = useCallback(() => {
    const container = containerRef.current;
    if (container && container.clientHeight > 0) {
      let max = Math.max(minHeight, container.clientHeight - minOppositeHeight);
      if (maxHeightRatio != null) {
        max = Math.min(max, Math.floor(container.clientHeight * maxHeightRatio));
      }
      setMaxHeight(max);
      setHeight((h) => clampHeight(h));
    }
  }, [containerRef, clampHeight, minHeight, minOppositeHeight, maxHeightRatio]);

  useEffect(() => {
    measureContainer();
    window.addEventListener('resize', measureContainer);
    const container = containerRef.current;
    const observer = container && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => { measureContainer(); })
      : null;
    if (container && observer) observer.observe(container);
    return () => {
      window.removeEventListener('resize', measureContainer);
      observer?.disconnect();
    };
  }, [containerRef, measureContainer]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const raw = await readKey(storageKey);
      if (!cancelled && raw != null) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed > 0) {
          setHeight(clampHeight(parsed));
        }
      }
      loadedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

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

  useEffect(() => {
    return () => {
      if (loadedRef.current) {
        void writeKey(storageKey, String(Math.round(heightRef.current)));
      }
    };
  }, [storageKey]);

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
