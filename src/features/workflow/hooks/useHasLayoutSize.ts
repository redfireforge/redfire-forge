import { useLayoutEffect, useState, type RefObject } from 'react';

/** True when the element is considered visible for layout (matches RF checkVisibility). */
function elementIsLayoutVisible(el: HTMLElement): boolean {
  if (typeof el.checkVisibility === 'function') {
    try {
      return el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true });
    } catch {
      /* older browsers / incomplete options — fall through */
    }
  }
  let cur: HTMLElement | null = el;
  while (cur) {
    const style = getComputedStyle(cur);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    cur = cur.parentElement;
  }
  return true;
}

/** True when the element has a non-zero layout box (width and height). */
export function elementHasLayoutSize(el: HTMLElement): boolean {
  // Keep-mounted Workflow Designer parks under `[hidden]` while other tabs are
  // active. React Flow still measures during that park and logs error #004 if
  // we mount it — treat hidden ancestors as no layout.
  if (el.closest('[hidden]')) return false;
  // Maximized console parks `.wf-body` with visibility:hidden (still non-zero
  // getBoundingClientRect). Unmount RF instead of letting it measure a dead box.
  if (!elementIsLayoutVisible(el)) return false;
  // RF uses offsetWidth/offsetHeight — prefer the same signal as the library.
  if (el.offsetWidth <= 0 || el.offsetHeight <= 0) return false;
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

    // Keep RAF ids in the effect closure — do not add hooks here (HMR-safe).
    let confirmRaf = 0;
    const clearConfirm = () => {
      if (confirmRaf) {
        cancelAnimationFrame(confirmRaf);
        confirmRaf = 0;
      }
    };

    const update = () => {
      const ok = elementHasLayoutSize(el);
      if (!ok) {
        // Collapse immediately so RF unmounts before it can log #004.
        clearConfirm();
        setHasSize(false);
        return;
      }
      // Tab unhide / flex reflow can report a transient non-zero box for one
      // frame before collapsing — confirm on the next paint before mounting RF.
      clearConfirm();
      confirmRaf = requestAnimationFrame(() => {
        confirmRaf = requestAnimationFrame(() => {
          confirmRaf = 0;
          setHasSize(elementHasLayoutSize(el));
        });
      });
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

    // Parent `[hidden]` toggles (Workflow Designer keep-mount) and console
    // maximize class changes do not always resize the canvas — watch both.
    const mount = el.closest('.workflow-designer-mount') ?? el.parentElement;
    const designer = el.closest('.wf-designer');
    if (typeof MutationObserver !== 'undefined') {
      const mo = new MutationObserver(() => {
        update();
      });
      if (mount) {
        mo.observe(mount, { attributes: true, attributeFilter: ['hidden', 'class', 'style'] });
      }
      if (designer && designer !== mount) {
        mo.observe(designer, { attributes: true, attributeFilter: ['class', 'style'] });
      }
      // Console maximize toggles a class on the panel (sibling under .wf-designer).
      const consolePanel = designer?.querySelector('.wf-console-panel');
      if (consolePanel) {
        mo.observe(consolePanel, { attributes: true, attributeFilter: ['class'] });
      }
      cleanups.push(() => mo.disconnect());
    }

    return () => {
      clearConfirm();
      for (const cleanup of cleanups) cleanup();
    };
  }, [ref, skipTracking]);

  return hasSize;
}
