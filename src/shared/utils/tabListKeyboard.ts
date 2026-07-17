/**
 * Phase 11 — Tablist keyboard navigation helper.
 *
 * Implements the WAI-ARIA "tabs with automatic activation" keyboard pattern for
 * the studio tab strips (WS mode/left/right, SSE left/right). On Arrow/Home/End
 * it moves focus to the target tab and activates it (`focus()` + `click()`),
 * matching the immediate panel swap the strips already perform on click.
 *
 * The handler is attached to the tablist container and discovers its
 * `[role="tab"]` children from the DOM, so it works uniformly for every strip
 * without per-tab refs. Tabs themselves carry roving `tabIndex`
 * (`selected ? 0 : -1`) so only the active tab is in the Tab sequence.
 */

/**
 * Compute the next tab index for a tablist keyboard event, or `null` when the
 * key is not a navigation key. Horizontal (Left/Right) and vertical (Up/Down)
 * arrows both move within the strip and wrap around.
 */
export function getNextTabIndex(
  key: string,
  currentIndex: number,
  count: number,
): number | null {
  if (count <= 0) return null;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (currentIndex + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (currentIndex - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/**
 * Keydown handler for a tablist container. Moves focus + activates the target
 * tab. No-op for non-navigation keys or when focus is not on a tab.
 */
export function handleTabListArrowKeys(
  e: React.KeyboardEvent<HTMLElement>,
): void {
  const tabs = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'),
  );
  if (tabs.length === 0) return;
  const currentIndex = tabs.findIndex((t) => t === document.activeElement);
  if (currentIndex < 0) return;
  const next = getNextTabIndex(e.key, currentIndex, tabs.length);
  if (next == null || next === currentIndex) return;
  e.preventDefault();
  const target = tabs[next];
  target.focus();
  target.click();
}
