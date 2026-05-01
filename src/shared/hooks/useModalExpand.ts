import { useState, useCallback } from 'react';

export type ExpandMode = 'expanded' | 'fullscreen';

/**
 * Shared hook for modal expand/shrink state.
 * Returns the expanded flag, a toggle function, and a CSS class string
 * that can be appended to the modal element's className.
 *
 * @param mode - 'expanded' gives 95vw/90vh, 'fullscreen' gives 100%/100%
 *
 * Usage:
 *   const { expanded, toggleExpand, expandClass } = useModalExpand();
 *   <div className={`modal my-modal ${expandClass}`}>
 */
export function useModalExpand(initial = false, mode: ExpandMode = 'expanded') {
  const [expanded, setExpanded] = useState(initial);
  const toggleExpand = useCallback(() => setExpanded(v => !v), []);
  const cls = mode === 'fullscreen' ? 'modal-fullscreen' : 'modal-expanded';
  const expandClass = expanded ? cls : '';

  return { expanded, setExpanded, toggleExpand, expandClass } as const;
}
