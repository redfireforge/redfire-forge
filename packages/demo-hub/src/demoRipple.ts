/** Brief CSS ripple on demo lesson clicks — isolated to avoid lesson ↔ registry import cycles. */
export function showClickRipple(el: HTMLElement): void {
  const ring = document.createElement('div');
  ring.className = 'demo-click-ripple';
  const rect = el.getBoundingClientRect();
  ring.style.top = `${rect.top + rect.height / 2}px`;
  ring.style.left = `${rect.left + rect.width / 2}px`;
  document.body.appendChild(ring);
  ring.addEventListener('animationend', () => ring.remove());
}

const MANUAL_SPOTLIGHT_COUNT_ATTR = 'data-demo-manual-spotlight-count';
const MANUAL_SPOTLIGHT_EVENT = 'demo-manual-spotlight-change';

function readManualSpotlightCount(): number {
  if (typeof document === 'undefined') return 0;
  const raw = document.body.getAttribute(MANUAL_SPOTLIGHT_COUNT_ATTR);
  const parsed = Number(raw ?? '0');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function setManualSpotlightCount(next: number): void {
  if (typeof document === 'undefined') return;
  if (next > 0) {
    document.body.setAttribute(MANUAL_SPOTLIGHT_COUNT_ATTR, String(next));
  } else {
    document.body.removeAttribute(MANUAL_SPOTLIGHT_COUNT_ATTR);
  }
  window.dispatchEvent(new CustomEvent<number>(MANUAL_SPOTLIGHT_EVENT, { detail: next }));
}

function beginManualSpotlight(): void {
  setManualSpotlightCount(readManualSpotlightCount() + 1);
}

function endManualSpotlight(): void {
  setManualSpotlightCount(Math.max(0, readManualSpotlightCount() - 1));
}

export function isManualSpotlightActive(): boolean {
  return readManualSpotlightCount() > 0;
}

export function getManualSpotlightEventName(): string {
  return MANUAL_SPOTLIGHT_EVENT;
}

/**
 * Draw a sustained spotlight ring over an element, reusing the same visual as
 * the step-level DemoSpotlight so it reads as "the spotlight moved to here".
 * Used to walk a viewer through a sequence of controls inside one step
 * (e.g. Start stream → Send all → End stream) with paced holds between each.
 *
 * Positions once at call time — intended for controls that do not move while
 * the ring is shown. Returns a disposer that removes the ring.
 */
export function showSpotlightRing(el: HTMLElement): () => void {
  beginManualSpotlight();
  const ring = document.createElement('div');
  ring.className = 'demo-spotlight-ring';
  const rect = el.getBoundingClientRect();
  // Match DemoSpotlight's 6px breathing room around the target.
  ring.style.top = `${rect.top - 6}px`;
  ring.style.left = `${rect.left - 6}px`;
  ring.style.width = `${rect.width + 12}px`;
  ring.style.height = `${rect.height + 12}px`;
  document.body.appendChild(ring);
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    ring.remove();
    endManualSpotlight();
  };
}

/**
 * Remove ALL imperative spotlight ring elements from the DOM and reset the
 * manual spotlight counter. Called on step transitions to prevent ghost rings
 * from lingering when actions are interrupted.
 */
export function purgeAllSpotlightRings(): void {
  const rings = document.querySelectorAll<HTMLElement>('body > .demo-spotlight-ring');
  rings.forEach(r => r.remove());
  if (readManualSpotlightCount() > 0) {
    setManualSpotlightCount(0);
  }
}
