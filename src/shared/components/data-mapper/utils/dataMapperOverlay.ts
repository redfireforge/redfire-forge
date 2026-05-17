/**
 * Shared overlay detection for the Data Mapper modal system.
 * Centralizes the selectors used to determine if a blocking overlay is open,
 * preventing inconsistent behavior between DataMapperModal and useMapperKeyboard.
 */

const BLOCKING_OVERLAY_SELECTORS = [
  '.dm-expr-overlay',
  '.dm-diff-overlay',
  '.dm-example-overlay',
  '.validation-rules-docked',
  '.validation-rules-floating',
  '.validation-rules-maximized',
] as const;

export function isDataMapperOverlayOpen(): boolean {
  return BLOCKING_OVERLAY_SELECTORS.some(sel => document.querySelector(sel) !== null);
}

/**
 * Resolves the best DOM node to use as a portal root for Data Mapper overlays.
 * Prefers the modal shell container, falls back to document.body.
 */
export function resolvePortalRoot(element?: Element | null): HTMLElement {
  if (element) {
    const shell = element.closest('.dm-modal-shell') ?? element.closest('.dm-modal-overlay');
    if (shell instanceof HTMLElement) return shell;
  }
  const globalShell = document.querySelector('.dm-modal-shell');
  if (globalShell instanceof HTMLElement) return globalShell;
  return document.body;
}
