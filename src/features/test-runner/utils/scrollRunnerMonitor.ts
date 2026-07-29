/**
 * Scroll helpers for Test / Parameterized / Workflow runner Progress monitors.
 * The scroll container is usually `.app-main > div` (overflow-y: auto), not the window.
 */

export function findScrollParent(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node && node !== document.documentElement) {
    const style = getComputedStyle(node);
    const oy = style.overflowY;
    if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && node.scrollHeight > node.clientHeight + 1) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * Bring `el` into view and, when `bottomEl` is provided, nudge the scroll parent
 * so the bottom of the monitor (metrics / charts / completion) is also visible.
 */
export function scrollRunnerMonitorIntoView(
  el: HTMLElement,
  bottomEl?: HTMLElement | null,
  behavior: ScrollBehavior = 'smooth',
): void {
  if (typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ behavior, block: 'start', inline: 'nearest' });
  }

  const bottom = bottomEl && bottomEl !== el ? bottomEl : el;
  const pane = findScrollParent(el);
  if (!pane) {
    if (bottom !== el && typeof bottom.scrollIntoView === 'function') {
      bottom.scrollIntoView({ behavior, block: 'nearest', inline: 'nearest' });
    }
    return;
  }

  const paneRect = pane.getBoundingClientRect();
  const bottomRect = bottom.getBoundingClientRect();
  if (bottomRect.bottom > paneRect.bottom - 12) {
    pane.scrollTop += bottomRect.bottom - paneRect.bottom + 24;
  }
}
