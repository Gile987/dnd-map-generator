import { drawRitualCandles } from './ritual-props';
import { isDungeonSurface } from '../engine/object-editor/dungeon-occupancy';
import type { Dungeon, Prop, QuarterTurn } from '../engine/model';
import type { DrawingContext } from './drawing-context';
import { drawProp } from './props';
import { drawFittedStudyProp } from './study-props';

/** Shared by painting and reverse-order selection. Architecture remains a separate layer. */
export function isDungeonGroundProp(prop: Prop): boolean {
  return isDungeonSurface(prop.kind);
}

/** Generated objects, accepted edits and placement ghosts share the same art
 * and tile anchor. Only the existing study artwork opts into wall fitting.
 */
export function drawDungeonProp(
  ctx: DrawingContext,
  prop: Prop,
  map: Pick<Dungeon, 'layout' | 'decoration'> & {
    readonly artTurns?: ReadonlyMap<Prop, QuarterTurn>;
  },
): void {
  const turn = map.artTurns?.get(prop) ?? 0;
  if (map.decoration.studySurface === 1 && drawFittedStudyProp(ctx, prop, map.layout, turn)) return;
  if (turn && prop.kind === 'ritual_candles') {
    // Turn the candle cluster; flames and their lighting remain upright.
    ctx.save();
    ctx.translate(prop.x + 0.5, prop.y + 0.5);
    ctx.lineWidth = 0.025;
    drawRitualCandles(ctx, prop, turn);
    ctx.restore();
    return;
  }
  if (!turn) {
    drawProp(ctx, prop);
    return;
  }
  ctx.save();
  ctx.translate(prop.x + 0.5, prop.y + 0.5);
  ctx.rotate((turn * Math.PI) / 2);
  ctx.translate(-prop.x - 0.5, -prop.y - 0.5);
  drawProp(ctx, prop);
  ctx.restore();
}
