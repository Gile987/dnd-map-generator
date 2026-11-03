export interface LayerLabelAnchor {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}
export interface LayerLabelPosition extends LayerLabelAnchor {
  readonly anchorX: number;
  readonly anchorY: number;
}

/** Place labels near their anchors without overlapping each other or clipping.
 * Coordinates may be CSS pixels (workbench) or tiles (PNG).
 * Labels that cannot fit are omitted; the workbench provides a list fallback.
 */
export function placeLayerLabels(
  anchors: readonly LayerLabelAnchor[],
  width: number,
  height: number,
  labelWidth: number,
  labelHeight: number,
  gap: number,
): readonly LayerLabelPosition[] {
  if (width < labelWidth || height < labelHeight) return [];
  const placed: LayerLabelPosition[] = [];
  const dx = labelWidth + gap,
    dy = labelHeight + gap;
  for (const anchor of anchors) {
    const x = Math.max(labelWidth / 2, Math.min(width - labelWidth / 2, anchor.x));
    const y = Math.max(
      labelHeight / 2,
      Math.min(height - labelHeight / 2, anchor.y - gap - labelHeight / 2),
    );
    const candidates: { x: number; y: number; distance: number }[] = [];
    for (let row = -Math.ceil(height / dy); row <= Math.ceil(height / dy); row++)
      for (let col = -Math.ceil(width / dx); col <= Math.ceil(width / dx); col++) {
        const cx = x + col * dx,
          cy = y + row * dy;
        if (
          cx < labelWidth / 2 ||
          cx > width - labelWidth / 2 ||
          cy < labelHeight / 2 ||
          cy > height - labelHeight / 2
        )
          continue;
        candidates.push({ x: cx, y: cy, distance: (cx - x) ** 2 + (cy - y) ** 2 });
      }
    candidates.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
    const position = candidates.find((candidate) =>
      placed.every(
        (label) => Math.abs(candidate.x - label.x) >= dx || Math.abs(candidate.y - label.y) >= dy,
      ),
    );
    if (position)
      placed.push({
        id: anchor.id,
        x: position.x,
        y: position.y,
        anchorX: anchor.x,
        anchorY: anchor.y,
      });
  }
  return placed;
}
