import type { ForestDrawing } from '../engine/object-editor/forest-document';
import { FOREST_PALETTES } from './forest-palette';
import type { Prop } from '../engine/model';
import type { DungeonDrawing } from '../engine/object-editor/document';
import type { CourtyardDrawing } from '../engine/object-editor/courtyard-document';
import type { DrawingContext } from './drawing-context';
import { drawDungeonProp } from './dungeon-prop-layer';
import { drawProp } from './props';

export type EditorDrawing = DungeonDrawing | CourtyardDrawing | ForestDrawing;
/** Accepted artwork and placement ghosts use exactly the same anchors and scale. */
export function drawEditorProp(ctx: DrawingContext, prop: Prop, map: EditorDrawing): void {
  if (map.type === 'dungeon') return drawDungeonProp(ctx, prop, map);
  const palette = map.type === 'forest' ? FOREST_PALETTES[map.decoration.character] : undefined;
  const turn = map.objectEdits === 'resolved' ? map.artTurns.get(prop) : undefined;
  if (!turn) return drawProp(ctx, prop, palette);
  ctx.save();
  ctx.translate(prop.x + 0.5, prop.y + 0.5);
  ctx.rotate((turn * Math.PI) / 2);
  ctx.translate(-prop.x - 0.5, -prop.y - 0.5);
  drawProp(ctx, prop, palette);
  ctx.restore();
}
