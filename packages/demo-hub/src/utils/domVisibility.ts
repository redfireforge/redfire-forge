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
