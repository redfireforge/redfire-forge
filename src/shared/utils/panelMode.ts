/**
 * Shared panel mode persistence for dockable/floating/maximized panels.
 * Used by WorkflowConsolePanel, ResultsExplorerConsolePanel, and similar.
 */

export type PanelMode = 'docked' | 'maximized' | 'floating';

const VALID_MODES: readonly PanelMode[] = ['docked', 'maximized', 'floating'];

export function loadPanelMode(storageKey: string, fallback: PanelMode = 'docked'): PanelMode {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored && (VALID_MODES as readonly string[]).includes(stored)) return stored as PanelMode;
  } catch { /* SSR or restricted storage */ }
  return fallback;
}

export function savePanelMode(storageKey: string, mode: PanelMode): void {
  try {
    localStorage.setItem(storageKey, mode);
  } catch { /* SSR or restricted storage */ }
}
