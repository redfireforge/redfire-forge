/**
 * Map a normalised intensity to a colour on the standard heat-map gradient
 * (green → yellow → orange → red). Used by the replay canvas to colour nodes
 * by relative execution time.
 *
 * @param t intensity in [0,1] (values outside the range are clamped).
 */
export function heatmapColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  let r: number, g: number, b: number;
  if (clamped < 0.5) {
    // green → yellow
    const s = clamped * 2;
    r = Math.round(34 + s * (234 - 34));
    g = Math.round(197 + s * (179 - 197));
    b = Math.round(94 + s * (8 - 94));
  } else {
    // yellow → red
    const s = (clamped - 0.5) * 2;
    r = Math.round(234 + s * (239 - 234));
    g = Math.round(179 - s * 179);
    b = Math.round(8 + s * (68 - 8));
  }
  return `rgb(${r}, ${g}, ${b})`;
}
