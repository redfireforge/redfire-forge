/**
 * Compute the final drop index for tab reorder.
 *
 * Given `fromIndex` (the dragged tab), `targetIndex` (the tab being dropped on),
 * the cursor X, and the target tab's bounding rect, returns the new position
 * after the move — or `null` if the tab would stay in its current position.
 */
export function computeDropIndex(
  fromIndex: number,
  targetIndex: number,
  clientX: number,
  rectLeft: number,
  rectWidth: number,
): number | null {
  const midX = rectLeft + rectWidth / 2;
  let toIndex = clientX < midX ? targetIndex : targetIndex + 1;
  if (fromIndex < toIndex) toIndex -= 1;
  if (fromIndex === toIndex) return null;
  return toIndex;
}
