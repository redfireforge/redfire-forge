import { useMemo, useState, useEffect, useCallback } from 'react';
import type { Mapping } from '../types';
import { normalizeMapperPath } from '../utils/pathNormalization';

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
  /** Confidence score (0–100) for auto-mapped lines. */
  confidenceScore?: number;
  /** Whether this mapping was restored from pattern history. */
  isFromPattern?: boolean;
}

/**
 * Lookup an element from the path map, falling back to the normalized path
 * (strips leading `$` / `$.`) so JSONPath-style mapping source paths match
 * tree nodes that use plain dot-notation paths.
 */
function resolvePathEl(pathMap: Map<string, HTMLElement>, rawPath: string): HTMLElement | undefined {
  return pathMap.get(rawPath) ?? pathMap.get(normalizeMapperPath(rawPath));
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

    // Line coordinates should be relative to the body/canvas region, not the full
    // container (which includes toolbar + status bars above the body).
    const body = container.querySelector('.dm-body') as HTMLElement | null;
    const anchorRoot = body ?? container;
    const anchorRect = anchorRoot.getBoundingClientRect();
    const lines: ConnectionLine[] = [];

    const buildPathMap = (
      panelSelector: '.dm-panel--source' | '.dm-panel--target',
    ): Map<string, HTMLElement> => {
      const pathMap = new Map<string, HTMLElement>();
      const panel = container.querySelector(panelSelector) as HTMLElement | null;
      if (!panel) return pathMap;
      const candidates = panel.querySelectorAll<HTMLElement>('[data-path]');
      for (const node of candidates) {
        const path = node.getAttribute('data-path');
        if (path == null || pathMap.has(path)) continue;
        pathMap.set(path, node);
      }
      return pathMap;
    };

    const sourcePathMap = buildPathMap('.dm-panel--source');
    const targetPathMap = buildPathMap('.dm-panel--target');

    for (const mapping of mappings) {
      const sourceEl = resolvePathEl(sourcePathMap, mapping.sourcePath);
      const targetEl = resolvePathEl(targetPathMap, mapping.targetPath);

      if (!sourceEl || !targetEl) continue;

      const sourceRect = sourceEl.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();

      const arrInfo = arrayInfoMap?.get(mapping.id);
      lines.push({
        id: `line-${mapping.id}`,
        mappingId: mapping.id,
        sourcePath: mapping.sourcePath,
        targetPath: mapping.targetPath,
        sourceY: sourceRect.top + sourceRect.height / 2 - anchorRect.top,
        targetY: targetRect.top + targetRect.height / 2 - anchorRect.top,
        hasExpression: !!mapping.expression,
        isAutoMapped: !!mapping.isAutoMapped,
        hasTypeMismatch: mismatchIds?.has(mapping.id) ?? false,
        isPending: !!mapping.isPending,
        arrayKind: arrInfo?.kind ?? null,
        arrayLabel: arrInfo?.label,
      });
    }

    return { lines, containerHeight: anchorRect.height };
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
