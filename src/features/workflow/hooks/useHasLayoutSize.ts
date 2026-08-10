import { useLayoutEffect, useState, type RefObject } from 'react';

/** True when the element has a non-zero layout box (width and height). */
export function elementHasLayoutSize(el: HTMLElement): boolean {
  // Keep-mounted Workflow Designer parks under `[hidden]` while other tabs are
  // active. React Flow still measures during that park and logs error #004 if
  // we mount it — treat hidden ancestors as no layout.
  if (el.closest('[hidden]')) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export type UseHasLayoutSizeOptions = {
  /** Force ResizeObserver tracking even under Vitest (jsdom has 0×0 layout by default). */
  trackInTest?: boolean;
};

/**
 * Track whether a container has measurable layout size.
 *
 * React Flow logs error #004 when its own root is 0×0 (it measures itself, not
 * the parent). Gate `<ReactFlow>` until the canvas container has a measurable
 * box — pair with absolute-fill CSS on `.react-flow` so root size tracks parent.
 *
 * In Vitest/jsdom, layout is always 0×0 — stay ready so unit tests can render
 * unless `trackInTest` is set.
 */
export function useHasLayoutSize(
  ref: RefObject<HTMLElement | null>,
  opts?: UseHasLayoutSizeOptions,
): boolean {
  const skipTracking = import.meta.env.MODE === 'test' && !opts?.trackInTest;
  const [hasSize, setHasSize] = useState(skipTracking);

  useLayoutEffect(() => {
    if (skipTracking) return;

    const el = ref.current;
    if (!el) return;

    const update = () => {
      setHasSize(elementHasLayoutSize(el));
    };

    update();

    const cleanups: Array<() => void> = [];

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        update();
      });
      ro.observe(el);
      cleanups.push(() => ro.disconnect());
    }

    // Parent `[hidden]` toggles (Workflow Designer keep-mount) do not always
    // resize the canvas — watch the attribute so we unmount React Flow promptly.
    const mount = el.closest('.workflow-designer-mount') ?? el.parentElement;
    if (mount && typeof MutationObserver !== 'undefined') {
      const mo = new MutationObserver(() => {
        update();
      });
      mo.observe(mount, { attributes: true, attributeFilter: ['hidden'] });
      cleanups.push(() => mo.disconnect());
    }

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [ref, skipTracking]);

  return hasSize;
}
