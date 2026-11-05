import { describeObjectLayer } from './dungeon-layer-description';
import { placeLayerLabels } from './layer-label-layout';
import { WIDTH, HEIGHT } from '../engine/model';
import type { EditableMapDocument } from '../engine/model';
import {
  editorOrderedObjects,
  editorOverlaps,
  editorObjectLabel,
} from '../engine/object-editor/editor-view';
import { authoredObjectArea } from '../engine/object-editor/object-geometry';
import type { DrawingContext } from './drawing-context';

/** Export-only annotations. Preview controls and library thumbnails stay separate. */
export function drawObjectLayerIndicators(
  ctx: DrawingContext,
  map: EditableMapDocument,
  pixelsPerTile: number,
): void {
  const items = editorOrderedObjects(map),
    overlaps = editorOverlaps(map);
  ctx.save();
  // Measure annotation fonts at the actual output resolution. Some rasterizers
  // round subpixel font metrics before applying a canvas transform.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.strokeStyle = '#f0d585';
  ctx.lineWidth = 0.035 * pixelsPerTile;
  const covered = new Set(overlaps.flatMap((item) => item.underneath));
  for (const item of items.filter((item) => covered.has(item.id))) {
    const b = authoredObjectArea(item.prop);
    ctx.strokeRect(
      (b.x + 0.04) * pixelsPerTile,
      (b.y + 0.04) * pixelsPerTile,
      (b.width - 0.08) * pixelsPerTile,
      (b.height - 0.08) * pixelsPerTile,
    );
  }
  ctx.font = `bold ${0.2 * pixelsPerTile}px sans-serif`;
  ctx.textAlign = 'center';
  const descriptions = new Map(
    overlaps.map((overlap) => [
      overlap.id,
      describeObjectLayer(items, overlap.underneath, (kind) => editorObjectLabel(map, kind)).text,
    ]),
  );
  const labelWidth = Math.max(
    1.72 * pixelsPerTile,
    ...[...descriptions.values()].map((text) => ctx.measureText(text).width + 0.24 * pixelsPerTile),
  );
  const anchors = overlaps.flatMap((overlap) => {
    const item = items.find((item) => item.id === overlap.id);
    if (!item) return [];
    const b = authoredObjectArea(item.prop);
    return [{ id: item.id, x: (b.x + b.width / 2) * pixelsPerTile, y: b.y * pixelsPerTile }];
  });
  for (const label of placeLayerLabels(
    anchors,
    WIDTH * pixelsPerTile,
    HEIGHT * pixelsPerTile,
    labelWidth,
    0.34 * pixelsPerTile,
    0.1 * pixelsPerTile,
  )) {
    const overlap = overlaps.find((overlap) => overlap.id === label.id);
    if (!overlap) continue;
    const { x, y } = label;
    ctx.beginPath();
    ctx.moveTo(label.anchorX, label.anchorY);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = '#182a30';
    ctx.fillRect(x - labelWidth / 2, y - 0.17 * pixelsPerTile, labelWidth, 0.34 * pixelsPerTile);
    ctx.strokeRect(x - labelWidth / 2, y - 0.17 * pixelsPerTile, labelWidth, 0.34 * pixelsPerTile);
    ctx.fillStyle = '#f0d585';
    ctx.fillText(descriptions.get(overlap.id) ?? '', x, y + 0.07 * pixelsPerTile);
  }
  ctx.restore();
}
