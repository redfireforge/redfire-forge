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
  const ring = document.createElement('div');
  ring.className = 'demo-spotlight-ring';
  const rect = el.getBoundingClientRect();
  // Match DemoSpotlight's 6px breathing room around the target.
  ring.style.top = `${rect.top - 6}px`;
  ring.style.left = `${rect.left - 6}px`;
  ring.style.width = `${rect.width + 12}px`;
  ring.style.height = `${rect.height + 12}px`;
  document.body.appendChild(ring);
  return () => ring.remove();
}
