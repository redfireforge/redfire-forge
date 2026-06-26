/** Shared helpers for demo spotlight visibility (LiveDemo + DemoSpotlight). */

export function isDemoElementVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

/** Nearest ancestor with vertical overflow scrolling (e.g. Metadata tab, Auth panel). */
export function findScrollableParent(el: Element): HTMLElement | null {
  let node = el.parentElement;
  while (node) {
    const { overflowY, overflow } = getComputedStyle(node);
    const scrollable = /auto|scroll/.test(`${overflowY} ${overflow}`);
    if (scrollable && node.scrollHeight > node.clientHeight + 1) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function getDemoPanelRect(): DOMRect | null {
  const panel = document.querySelector('.demo-live-panel');
  if (!(panel instanceof HTMLElement) || !isDemoElementVisible(panel)) return null;
  return panel.getBoundingClientRect();
}

/** Pause demo-driven auto-scroll after the user manually scrolls a panel. */
let demoAutoScrollPausedUntil = 0;

export function pauseDemoAutoScroll(durationMs = 10000): void {
  demoAutoScrollPausedUntil = Math.max(demoAutoScrollPausedUntil, Date.now() + durationMs);
}

export function isDemoAutoScrollPaused(): boolean {
  return Date.now() < demoAutoScrollPausedUntil;
}

const DEMO_USER_SCROLL_SELECTOR =
  '.gql-rv-metadata, .gql-auth-panel-scroll, .gql-rv-json-scroll, .gql-rv-headers-scroll, .gql-rv-tracing-scroll';

/** Listen for manual scroll/wheel in studio panels — stops spotlight from fighting the user. */
export function installDemoUserScrollListeners(): () => void {
  const onUserScrollIntent = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest(DEMO_USER_SCROLL_SELECTOR)) return;
    pauseDemoAutoScroll(10000);
  };

  document.addEventListener('wheel', onUserScrollIntent, { passive: true, capture: true });
  document.addEventListener('scroll', onUserScrollIntent, { passive: true, capture: true });
  document.addEventListener('touchmove', onUserScrollIntent, { passive: true, capture: true });

  return () => {
    document.removeEventListener('wheel', onUserScrollIntent, true);
    document.removeEventListener('scroll', onUserScrollIntent, true);
    document.removeEventListener('touchmove', onUserScrollIntent, true);
  };
}

/** True when the element is unobstructed and within scroll-parent + demo-panel safe area. */
export function isElementVisibleInViewport(el: Element, padding = 10): boolean {
  if (!isDemoElementVisible(el)) return false;

  const rect = el.getBoundingClientRect();
  const viewTop = padding;
  const viewLeft = padding;
  let viewRight = window.innerWidth - padding;
  let viewBottom = window.innerHeight - padding;

  const demoPanel = getDemoPanelRect();
  if (demoPanel && rect.right > demoPanel.left - padding && rect.bottom > demoPanel.top - padding) {
    viewBottom = Math.min(viewBottom, demoPanel.top - padding);
    viewRight = Math.min(viewRight, demoPanel.left - padding);
  }

  if (
    rect.top < viewTop
    || rect.bottom > viewBottom
    || rect.left < viewLeft
    || rect.right > viewRight
  ) {
    return false;
  }

  let parent = el.parentElement;
  while (parent) {
    const style = getComputedStyle(parent);
    const scrollable = /auto|scroll/.test(`${style.overflowY} ${style.overflow}`);
    if (scrollable && parent.scrollHeight > parent.clientHeight + 1) {
      const pr = parent.getBoundingClientRect();
      if (rect.top < pr.top + padding || rect.bottom > pr.bottom - padding) {
        return false;
      }
    }
    parent = parent.parentElement;
  }

  return true;
}

export interface ScrollDemoTargetOptions {
  block?: 'start' | 'center' | 'end';
}

/**
 * Scroll a spotlight target into view inside nested scroll containers (Metadata, Auth panel)
 * and above the floating demo narration panel when it overlaps the right/bottom edge.
 */
export function scrollDemoTargetIntoView(
  el: HTMLElement,
  options: ScrollDemoTargetOptions = {},
): void {
  if (isDemoAutoScrollPaused()) return;
  const block = options.block ?? 'center';
  const scrollParent = findScrollableParent(el);
  const demoPanel = getDemoPanelRect();

  if (scrollParent) {
    const elRect = el.getBoundingClientRect();
    const parentRect = scrollParent.getBoundingClientRect();

    let visibleBottom = parentRect.bottom;
    if (demoPanel) {
      if (parentRect.right > demoPanel.left && parentRect.bottom > demoPanel.top) {
        visibleBottom = Math.min(visibleBottom, demoPanel.top - 12);
      }
    }

    const visibleHeight = Math.max(0, visibleBottom - parentRect.top);
    const offsetTop = elRect.top - parentRect.top + scrollParent.scrollTop;

    let targetScroll: number;
    if (block === 'start') {
      targetScroll = offsetTop - 12;
    } else if (block === 'end') {
      targetScroll = offsetTop - visibleHeight + elRect.height + 12;
    } else {
      targetScroll = offsetTop - visibleHeight / 2 + elRect.height / 2;
    }

    scrollParent.scrollTo({
      top: Math.max(0, Math.min(targetScroll, scrollParent.scrollHeight - scrollParent.clientHeight)),
      behavior: 'smooth',
    });
    return;
  }

  if (typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ behavior: 'smooth', block: block === 'end' ? 'end' : 'center' });
  }
}

export function findFirstVisibleElement(selector: string): HTMLElement | null {
  const all = document.querySelectorAll(selector);
  for (const el of all) {
    if (el instanceof HTMLElement && isDemoElementVisible(el)) return el;
  }
  return null;
}

const APP_MODAL_OVERLAY_SELECTORS = '.modal-overlay, .dm-modal-overlay, .ws-tls-overlay';

/** Topmost visible app modal dialog (excludes demo-player floating panels). */
export function findVisibleAppModal(): Element | null {
  const overlays = document.querySelectorAll(APP_MODAL_OVERLAY_SELECTORS);
  for (const overlay of overlays) {
    if (!(overlay instanceof HTMLElement)) continue;
    if (!isDemoElementVisible(overlay)) continue;
    return overlay.querySelector('[role="dialog"][aria-modal="true"]') ?? overlay;
  }
  return null;
}

/** Hide spotlight when a modal is open and the target element is behind it. */
export function isSpotlightSuppressedForModal(target: Element | null): boolean {
  if (!target) return false;
  const modal = findVisibleAppModal();
  if (!modal) return false;
  return !modal.contains(target);
}

/** True when the user is selecting copyable text in a demo hub floating panel. */
export function hasDemoHubTextSelection(): boolean {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return false;
  const node = sel.anchorNode;
  if (!node) return false;
  const el = node instanceof Element ? node : node.parentElement;
  if (!el) return false;
  return !!el.closest('.demo-live-panel, .demo-overview-modal');
}
