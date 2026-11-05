import type { Prop } from '../engine/model';
import type { DungeonDrawing } from '../engine/object-editor/document';
import type { CourtyardDrawing } from '../engine/object-editor/courtyard-document';
import type { DrawingContext } from './drawing-context';
import { drawDungeonProp } from './dungeon-prop-layer';
import { drawProp } from './props';

export type EditorDrawing = DungeonDrawing | CourtyardDrawing;
/** Accepted artwork and placement ghosts use exactly the same anchors and scale. */
export function drawEditorProp(ctx: DrawingContext, prop: Prop, map: EditorDrawing): void {
  if (map.type === 'dungeon') return drawDungeonProp(ctx, prop, map);
  const turn = map.objectEdits === 'resolved' ? map.artTurns.get(prop) : undefined;
  if (!turn) return drawProp(ctx, prop);
  ctx.save();
  ctx.translate(prop.x + 0.5, prop.y + 0.5);
  ctx.rotate((turn * Math.PI) / 2);
  ctx.translate(-prop.x - 0.5, -prop.y - 0.5);
  drawProp(ctx, prop);
  ctx.restore();
}
