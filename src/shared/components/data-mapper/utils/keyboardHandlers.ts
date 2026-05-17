import type { KeyboardEvent } from 'react';

/**
 * Returns keyboard event handlers for commit/cancel on Enter/Escape.
 * Reusable across inline editors (rename, operator value, add field).
 */
export function commitCancelKeyHandler(
  onCommit: () => void,
  onCancel: () => void,
): (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void {
  return (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onCommit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };
}

/**
 * Keyboard handler for disclosure toggles (Enter or Space activates).
 */
export function disclosureKeyHandler(
  onToggle: () => void,
): (e: KeyboardEvent<HTMLElement>) => void {
  return (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  };
}
