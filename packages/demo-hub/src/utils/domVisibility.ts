/**
 * DOM visibility helpers for demo lessons and the demo hub player.
 * Prefer these over raw querySelector when multiple tab panels may match.
 */

/** First matching element with a non-zero bounding box (skips non-HTMLElement nodes). */
export function firstVisibleElement<T extends HTMLElement = HTMLElement>(
  selector: string,
): T | null {
  const all = document.querySelectorAll(selector);
  for (const el of Array.from(all)) {
    if (!(el instanceof HTMLElement)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return el as T;
  }
  return null;
}

/**
 * All matching elements with a non-zero bounding box, in DOM order.
 * Use this instead of `document.querySelectorAll` whenever the selector could match
 * elements belonging to multiple simultaneously-mounted tab panels (e.g. WebSocket
 * Studio keeps every connection tab's content mounted, hiding inactive ones via
 * `display: none`) — this filters out matches from any hidden panel.
 */
export function visibleElements<T extends HTMLElement = HTMLElement>(
  selector: string,
): T[] {
  const all = document.querySelectorAll(selector);
  return Array.from(all).filter((el): el is T => {
    if (!(el instanceof HTMLElement)) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

/**
 * Returns `selector` when a visible match exists; otherwise returns `selector` if any
 * match exists (even hidden), or null when nothing matches.
 */
export function firstVisibleSelector(selector: string): string | null {
  const all = document.querySelectorAll<HTMLElement>(selector);
  for (const el of Array.from(all)) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return selector;
  }
  return all.length > 0 ? selector : null;
}
