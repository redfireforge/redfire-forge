/** Shared helpers for demo spotlight visibility (LiveDemo + DemoSpotlight). */

export function isDemoElementVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
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
