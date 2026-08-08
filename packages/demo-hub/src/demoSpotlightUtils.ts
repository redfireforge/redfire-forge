/** Shared helpers for demo spotlight visibility (LiveDemo + DemoSpotlight). */

export function isDemoElementVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  let node: Element | null = el;
  while (node) {
    if (node instanceof HTMLElement && node.hidden) return false;
    node = node.parentElement;
  }
  return true;
}

/** True when a selector matches an element that is visible in the active app pane. */
export function isDemoTargetVisible(selector: string): boolean {
  return findFirstVisibleElement(selector) !== null;
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

/** LiveDemo panel may nudge vertically when it covers a spotlight target (never left/right). */
export const DEMO_PANEL_CLEAR_TARGET_EVENT = 'demo-live-panel:clear-target';

export interface DemoPanelClearTargetDetail {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

function rectsOverlap(
  a: { top: number; left: number; right: number; bottom: number },
  b: { top: number; left: number; right: number; bottom: number },
  pad = 0,
): boolean {
  return !(
    a.right + pad <= b.left
    || a.left - pad >= b.right
    || a.bottom + pad <= b.top
    || a.top - pad >= b.bottom
  );
}

/**
 * If the floating LiveDemo panel covers the spotlight target, ask the panel
 * layout hook for a vertical-only dodge. Horizontal jumps are intentionally
 * avoided so the narration card stays in one place across steps.
 */
export function clearLiveDemoPanelFromTarget(el: HTMLElement, pad = 18): void {
  const panel = getDemoPanelRect();
  if (!panel) return;
  const rect = el.getBoundingClientRect();
  // Include spotlight ring inset (~6px) + glow.
  const target = {
    top: rect.top - 8,
    left: rect.left - 8,
    right: rect.right + 8,
    bottom: rect.bottom + 8,
  };
  if (!rectsOverlap(target, panel, pad)) return;
  window.dispatchEvent(
    new CustomEvent<DemoPanelClearTargetDetail>(DEMO_PANEL_CLEAR_TARGET_EVENT, {
      detail: target,
    }),
  );
}

/** Pause demo-driven auto-scroll after the user manually scrolls a panel. */
let demoAutoScrollPausedUntil = 0;
/** Ignore scroll/wheel events while demo code is programmatically scrolling. */
let demoProgrammaticScrollUntil = 0;

export function pauseDemoAutoScroll(durationMs = 10000): void {
  demoAutoScrollPausedUntil = Math.max(demoAutoScrollPausedUntil, Date.now() + durationMs);
}

/** Clear any active auto-scroll pause (e.g. before a new step needs a reading spotlight). */
export function resumeDemoAutoScroll(): void {
  demoAutoScrollPausedUntil = 0;
  demoProgrammaticScrollUntil = 0;
}

export function isDemoAutoScrollPaused(): boolean {
  return Date.now() < demoAutoScrollPausedUntil;
}

/** Mark an upcoming scroll as demo-driven so user-scroll listeners do not pause auto-scroll. */
export function markDemoProgrammaticScroll(durationMs = 700): void {
  demoProgrammaticScrollUntil = Math.max(demoProgrammaticScrollUntil, Date.now() + durationMs);
}

function isDemoProgrammaticScrollActive(): boolean {
  return Date.now() < demoProgrammaticScrollUntil;
}

const DEMO_USER_SCROLL_SELECTOR =
  '.gql-rv-metadata, .gql-auth-panel-scroll, .gql-rv-json-scroll, .gql-rv-headers-scroll, .gql-rv-tracing-scroll';

/** Listen for manual scroll/wheel in studio panels — stops spotlight from fighting the user. */
export function installDemoUserScrollListeners(): () => void {
  const onUserScrollIntent = (event: Event) => {
    // Programmatic scrollTo/scrollIntoView also fires scroll events — ignore those.
    if (isDemoProgrammaticScrollActive()) return;
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

/** Spotlight ring draws ~6–12px above the target — keep that band inside the scrollport. */
const SPOTLIGHT_TOP_CLEARANCE_PX = 20;

/**
 * Scroll a spotlight target into view inside nested scroll containers (Metadata, Auth panel)
 * and above the floating demo narration panel when it occludes the lower part of the scrollport.
 */
export function scrollDemoTargetIntoView(
  el: HTMLElement,
  options: ScrollDemoTargetOptions = {},
): void {
  if (isDemoAutoScrollPaused()) return;
  const block = options.block ?? 'center';
  const scrollParent = findScrollableParent(el);
  const demoPanel = getDemoPanelRect();

  // Instant scroll keeps the spotlight ring aligned; mark programmatic so the
  // resulting scroll events do not trip pauseDemoAutoScroll for later beats.
  markDemoProgrammaticScroll(700);

  if (scrollParent) {
    const elRect = el.getBoundingClientRect();
    const parentRect = scrollParent.getBoundingClientRect();

    let visibleBottom = parentRect.bottom;
    // Only shrink the usable viewport when the LiveDemo panel actually cuts across
    // the scrollport. A top-right floating panel often has panel.top < parent.top;
    // treating that as the visible bottom made visibleHeight 0 and pinned targets
    // flush to the clip edge (Runtime tab ring half-hidden under Advanced nav).
    if (demoPanel) {
      const overlapsX = parentRect.right > demoPanel.left + 8 && parentRect.left < demoPanel.right;
      const panelCutsScrollport =
        overlapsX
        && demoPanel.top > parentRect.top + 8
        && demoPanel.top < parentRect.bottom;
      if (panelCutsScrollport) {
        visibleBottom = Math.min(visibleBottom, demoPanel.top - 12);
      }
    }

    const visibleHeight = Math.max(
      SPOTLIGHT_TOP_CLEARANCE_PX * 2,
      visibleBottom - parentRect.top,
    );
    const offsetTop = elRect.top - parentRect.top + scrollParent.scrollTop;

    let targetScroll: number;
    if (block === 'start') {
      targetScroll = offsetTop - SPOTLIGHT_TOP_CLEARANCE_PX;
    } else if (block === 'end') {
      targetScroll = offsetTop - visibleHeight + elRect.height + 12;
    } else {
      targetScroll = offsetTop - visibleHeight / 2 + elRect.height / 2;
    }

    // Never leave the target (or its ring) flush against / under the top clip.
    const maxScrollForTopClearance = Math.max(0, offsetTop - SPOTLIGHT_TOP_CLEARANCE_PX);
    targetScroll = Math.min(targetScroll, maxScrollForTopClearance);

    scrollParent.scrollTo({
      top: Math.max(0, Math.min(targetScroll, scrollParent.scrollHeight - scrollParent.clientHeight)),
      behavior: 'instant',
    });
    clearLiveDemoPanelFromTarget(el);
    return;
  }

  if (typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ behavior: 'instant', block: block === 'end' ? 'end' : 'center' });
  }
  clearLiveDemoPanelFromTarget(el);
}

export function findFirstVisibleElement(selector: string): HTMLElement | null {
  let all: NodeListOf<Element>;
  try {
    all = document.querySelectorAll(selector);
  } catch {
    return null;
  }
  for (const el of all) {
    if (el instanceof HTMLElement && isDemoElementVisible(el)) return el;
  }
  return null;
}

const APP_MODAL_OVERLAY_SELECTORS =
  '.modal-overlay, .dm-modal-overlay, .dm-expr-overlay, .dm-diff-overlay, .ws-tls-overlay';

/**
 * Topmost visible app modal dialog (excludes demo-player floating panels).
 * When modals are stacked (Edit Test → Data Mapper → Expression Editor),
 * returns the last visible overlay in document order so spotlight targets
 * behind a covering modal are suppressed (prevents ghost rings).
 */
export function findVisibleAppModal(): Element | null {
  const overlays = document.querySelectorAll(APP_MODAL_OVERLAY_SELECTORS);
  let topmost: Element | null = null;
  for (const overlay of overlays) {
    if (!(overlay instanceof HTMLElement)) continue;
    if (!isDemoElementVisible(overlay)) continue;
    topmost = overlay.querySelector('[role="dialog"][aria-modal="true"]') ?? overlay;
  }
  return topmost;
}

/** Hide spotlight when a modal is open and the target element is behind it. */
export function isSpotlightSuppressedForModal(target: Element | null): boolean {
  if (!target) return false;
  const modal = findVisibleAppModal();
  if (modal && !modal.contains(target)) return true;

  // Floating Validation Rules panel sits inside the Data Mapper overlay but covers
  // toolbar targets (e.g. Rules button) — treat it as a covering layer too.
  const vrPanel = document.querySelector('.vr-modal-panel');
  if (
    vrPanel
    && isDemoElementVisible(vrPanel)
    && !vrPanel.contains(target)
  ) {
    return true;
  }

  return false;
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
