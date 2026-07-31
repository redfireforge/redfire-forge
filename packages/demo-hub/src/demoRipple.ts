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

const SPOTLIGHT_RING_TRACK_INTERVAL_MS = 100;
const activeSpotlightDisposers = new Set<() => void>();

/**
 * Draw a sustained spotlight ring over an element, reusing the same visual as
 * the step-level DemoSpotlight so it reads as "the spotlight moved to here".
 * Used to walk a viewer through a sequence of controls inside one step
 * (e.g. Start stream → Send all → End stream) with paced holds between each.
 *
 * Live-tracks the target for the ring's lifetime (interval + scroll/resize),
 * mirroring DemoSpotlight — so the ring stays accurate even when the element
 * shifts after the ring appears (modal open animations, toolbar reflow,
 * verification results pushing layout). Returns a disposer that removes it.
 */
export function showSpotlightRing(el: HTMLElement): () => void {
  beginManualSpotlight();
  const ring = document.createElement('div');
  ring.className = 'demo-spotlight-ring';

  let disposed = false;
  let interval: ReturnType<typeof setInterval> | null = null;

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    activeSpotlightDisposers.delete(dispose);
    if (interval) clearInterval(interval);
    window.removeEventListener('resize', onLayoutChange);
    window.removeEventListener('scroll', onLayoutChange, true);
    ring.remove();
    endManualSpotlight();
  };

  const position = () => {
    // Drop ghost rings when React replaces the node mid-step (filter clears,
    // results mount, etc.) — a detached node's rect is 0,0 and looks random.
    if (!el.isConnected) {
      dispose();
      return;
    }
    const rect = el.getBoundingClientRect();
    // Match DemoSpotlight's 6px breathing room around the target.
    ring.style.top = `${rect.top - 6}px`;
    ring.style.left = `${rect.left - 6}px`;
    ring.style.width = `${rect.width + 12}px`;
    ring.style.height = `${rect.height + 12}px`;
  };

  const onLayoutChange = () => position();

  position();
  document.body.appendChild(ring);

  interval = setInterval(position, SPOTLIGHT_RING_TRACK_INTERVAL_MS);
  window.addEventListener('resize', onLayoutChange);
  window.addEventListener('scroll', onLayoutChange, true);

  activeSpotlightDisposers.add(dispose);
  return dispose;
}

/**
 * Remove ALL imperative spotlight ring elements from the DOM and reset the
 * manual spotlight counter. Called on step transitions to prevent ghost rings
 * from lingering when actions are interrupted.
 */
export function purgeAllSpotlightRings(): void {
  // Dispose active tracked spotlights first so their intervals/listeners stop.
  for (const dispose of Array.from(activeSpotlightDisposers)) {
    dispose();
  }
  activeSpotlightDisposers.clear();

  // Imperative rings are appended to body; also sweep any strays elsewhere.
  const rings = document.querySelectorAll<HTMLElement>('.demo-spotlight-ring');
  rings.forEach(r => {
    // Keep React-managed DemoSpotlight rings (inside the live overlay tree).
    if (r.parentElement === document.body) r.remove();
  });
  if (readManualSpotlightCount() > 0) {
    setManualSpotlightCount(0);
  }
}
