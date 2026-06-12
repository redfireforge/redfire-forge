/**
 * Phase 11 — Shared resizable split-pane hook.
 *
 * Unifies the left-pane resize logic that was previously copy-pasted in
 * `WebSocketStudioShell` and `SseStudioShell`. It:
 *   - owns the left-pane width as state,
 *   - persists it (async `readKey` load on mount + debounced `writeKey` save +
 *     a flush on unmount, mirroring the Phase 9 console-settings pattern),
 *   - keeps the original mouse-drag mechanics (so existing drag tests stay
 *     valid — `onMouseDown` on the divider, window `mousemove`/`mouseup`),
 *   - adds keyboard resize for accessibility, and
 *   - returns ready-to-spread `dividerProps` with the full WAI-ARIA
 *     `separator` semantics (`aria-valuenow/valuemin/valuemax`, `tabIndex`).
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { readKey, writeKey } from '../utils/storage';

export interface SplitPaneResizeOptions {
  /** localStorage / Tauri-store key the width persists under. */
  storageKey: string;
  /** Initial left-pane width in px (used until a persisted value loads). */
  defaultWidth: number;
  /** Minimum left-pane width in px. */
  minWidth: number;
  /** Minimum width reserved for the opposite (right) pane in px. */
  minOppositeWidth: number;
  /** Ref to the split container (used to clamp against its measured width). */
  containerRef: RefObject<HTMLElement | null>;
  /** Arrow-key step in px (default 16). */
  step?: number;
  /** PageUp/PageDown and Shift+Arrow step in px (default 64). */
  pageStep?: number;
  /** Accessible label for the divider (default 'Resize panels'). */
  label?: string;
}

export interface SplitPaneDividerProps {
  role: 'separator';
  'aria-orientation': 'vertical';
  'aria-label': string;
  'aria-valuenow': number;
  'aria-valuemin': number;
  'aria-valuemax': number;
  tabIndex: 0;
  onMouseDown: (e: React.MouseEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export interface SplitPaneResizeReturn {
  /** Current left-pane width in px. */
  width: number;
  /** Measured max left-pane width (container width − opposite min), or the
   * current width when the container has not been measured yet. */
  maxWidth: number;
  /** Props to spread onto the divider element. */
  dividerProps: SplitPaneDividerProps;
}

const SAVE_DEBOUNCE_MS = 300;

export function useSplitPaneResize(options: SplitPaneResizeOptions): SplitPaneResizeReturn {
  const {
    storageKey,
    defaultWidth,
    minWidth,
    minOppositeWidth,
    containerRef,
    step = 16,
    pageStep = 64,
    label = 'Resize panels',
  } = options;

  const [width, setWidth] = useState(defaultWidth);
  const [maxWidth, setMaxWidth] = useState(defaultWidth);

  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  const widthRef = useRef(defaultWidth);
  const loadedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep a ref of the latest width for the drag start, keyboard handler, and
  // unmount flush (so those closures never read a stale value).
  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  const clampWidth = useCallback(
    (w: number): number => {
      const container = containerRef.current;
      const max = container
        ? Math.max(minWidth, container.clientWidth - minOppositeWidth)
        : Number.POSITIVE_INFINITY;
      return Math.max(minWidth, Math.min(max, w));
    },
    [containerRef, minWidth, minOppositeWidth],
  );

  // Measure the max width for `aria-valuemax` on mount and on window resize.
  // Also re-clamp the current width down when the container shrinks so the
  // left pane never overflows and squeezes the right pane below its minimum.
  useEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      if (container && container.clientWidth > 0) {
        const max = Math.max(minWidth, container.clientWidth - minOppositeWidth);
        setMaxWidth(max);
        setWidth((w) => (w > max ? max : w));
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [containerRef, minWidth, minOppositeWidth]);

  // Load the persisted width on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const raw = await readKey(storageKey);
      if (!cancelled && raw != null) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed > 0) {
          setWidth(clampWidth(parsed));
        }
      }
      loadedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
    // clampWidth is intentionally excluded: the load should run once per key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Debounced save whenever the width changes (after the initial load, so the
  // default is never written back over a not-yet-loaded persisted value).
  useEffect(() => {
    if (!loadedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void writeKey(storageKey, String(Math.round(width)));
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [width, storageKey]);

  // Flush the latest width on unmount (covers a resize within the debounce
  // window immediately followed by a teardown — same guard as the console).
  useEffect(() => {
    return () => {
      if (loadedRef.current) {
        void writeKey(storageKey, String(Math.round(widthRef.current)));
      }
    };
  }, [storageKey]);

  // Mouse drag — window-level listeners so the drag continues outside the
  // divider. Preserved from the original shells for behavioral parity.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { startX, startW } = dragRef.current;
      setWidth(clampWidth(startW + (e.clientX - startX)));
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [clampWidth]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: widthRef.current };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let next: number | null = null;
      const arrowStep = e.shiftKey ? pageStep : step;
      switch (e.key) {
        case 'ArrowLeft':
          next = widthRef.current - arrowStep;
          break;
        case 'ArrowRight':
          next = widthRef.current + arrowStep;
          break;
        case 'PageDown':
          next = widthRef.current - pageStep;
          break;
        case 'PageUp':
          next = widthRef.current + pageStep;
          break;
        case 'Home':
          next = minWidth;
          break;
        case 'End': {
          const container = containerRef.current;
          next = container && container.clientWidth > 0
            ? container.clientWidth - minOppositeWidth
            : widthRef.current + pageStep;
          break;
        }
        default:
          return;
      }
      e.preventDefault();
      setWidth(clampWidth(next));
    },
    [clampWidth, containerRef, minWidth, minOppositeWidth, step, pageStep],
  );

  const dividerProps: SplitPaneDividerProps = {
    role: 'separator',
    'aria-orientation': 'vertical',
    'aria-label': label,
    'aria-valuenow': Math.round(width),
    'aria-valuemin': minWidth,
    'aria-valuemax': Math.round(Math.max(maxWidth, width)),
    tabIndex: 0,
    onMouseDown,
    onKeyDown,
  };

  return { width, maxWidth, dividerProps };
}
