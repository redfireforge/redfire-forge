/**
 * Per-workflow node layout persistence for the Results Explorer replay canvas.
 *
 * The canvas lets users drag nodes around; when they hit "save layout" the
 * positions are written to localStorage so subsequent visits to the same
 * workflow restore the saved arrangement.
 */
export const REPLAY_LAYOUT_STORAGE_PREFIX = 'replayLayout:';

export type LayoutPositions = Record<string, { x: number; y: number }>;

export function saveLayoutToStorage(workflowId: string, positions: LayoutPositions): void {
  try {
    localStorage.setItem(REPLAY_LAYOUT_STORAGE_PREFIX + workflowId, JSON.stringify(positions));
  } catch {
    /* v8 ignore next */
    // storage quota exceeded or unavailable — silently no-op
  }
}

export function loadLayoutFromStorage(workflowId: string): LayoutPositions | null {
  try {
    const raw = localStorage.getItem(REPLAY_LAYOUT_STORAGE_PREFIX + workflowId);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    /* v8 ignore next */
    return null;
  }
}
