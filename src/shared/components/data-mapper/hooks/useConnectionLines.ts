import { useMemo, useState, useEffect, useCallback } from 'react';
import type { Mapping } from '../types';

export type ArrayLineKind = 'loop' | 'aggregate' | 'spread' | 'direct' | null;

export interface ConnectionLine {
  id: string;
  mappingId: string;
  sourcePath: string;
  targetPath: string;
  sourceY: number;
  targetY: number;
  hasExpression: boolean;
  isAutoMapped: boolean;
  hasTypeMismatch?: boolean;
  isPending?: boolean;
  arrayKind?: ArrayLineKind;
  arrayLabel?: string;
  driftSeverity?: 'warning' | 'breaking';
  traceValue?: string;
  traceError?: boolean;
}

/**
 * Compute connection line positions + container height, recomputing whenever
 * layout changes (scroll, expand/collapse, resize).
 *
 * Returns `{ lines, containerHeight }` so the canvas can size itself.
 */
export function useConnectionLines(
  mappings: Mapping[],
  containerRef: React.RefObject<HTMLElement | null>,
  layoutTick: number,
  mismatchIds?: Set<string>,
  arrayInfoMap?: Map<string, { kind: ArrayLineKind; label?: string }>,
): { lines: ConnectionLine[]; containerHeight: number } {
  return useMemo(() => {
    const container = containerRef.current;
    if (!container) return { lines: [], containerHeight: 0 };

    const containerRect = container.getBoundingClientRect();
    const lines: ConnectionLine[] = [];
    const esc = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape : (s: string) => s;

    for (const mapping of mappings) {
      const sourceEl = container.querySelector(
        `.dm-panel--source [data-path="${esc(mapping.sourcePath)}"]`,
      );
      const targetEl = container.querySelector(
        `.dm-panel--target [data-path="${esc(mapping.targetPath)}"]`,
      );

      if (!sourceEl || !targetEl) continue;

      const sourceRect = sourceEl.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();

      const arrInfo = arrayInfoMap?.get(mapping.id);
      lines.push({
        id: `line-${mapping.id}`,
        mappingId: mapping.id,
        sourcePath: mapping.sourcePath,
        targetPath: mapping.targetPath,
        sourceY: sourceRect.top + sourceRect.height / 2 - containerRect.top,
        targetY: targetRect.top + targetRect.height / 2 - containerRect.top,
        hasExpression: !!mapping.expression,
        isAutoMapped: !!mapping.isAutoMapped,
        hasTypeMismatch: mismatchIds?.has(mapping.id) ?? false,
        isPending: !!mapping.isPending,
        arrayKind: arrInfo?.kind ?? null,
        arrayLabel: arrInfo?.label,
      });
    }

    return { lines, containerHeight: containerRect.height };
    // layoutTick forces recalc on scroll/resize/expand events
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mappings, containerRef, layoutTick, mismatchIds, arrayInfoMap]);
}

/**
 * Lightweight layout tracker: bumps a counter on scroll, resize,
 * and DOM mutations within the container so connection lines redraw.
 */
export function useLayoutTick(
  containerRef: React.RefObject<HTMLElement | null>,
): number {
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Scroll on tree containers
    const scrollables = el.querySelectorAll('.dm-tree-container');
    scrollables.forEach((s) => s.addEventListener('scroll', bump));

    // Resize on container
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(bump);
      ro.observe(el);
    }

    // DOM mutations (expand/collapse adds/removes children)
    const mo = new MutationObserver(bump);
    mo.observe(el, { childList: true, subtree: true });

    return () => {
      scrollables.forEach((s) => s.removeEventListener('scroll', bump));
      ro?.disconnect();
      mo.disconnect();
    };
  }, [containerRef, bump]);

  return tick;
}
