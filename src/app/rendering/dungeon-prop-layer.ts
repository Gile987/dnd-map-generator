import type { Dungeon, Prop } from '../engine/model';
import type { DrawingContext } from './drawing-context';
import { drawProp } from './props';
import { drawFittedStudyProp } from './study-props';

/** Shared by painting and reverse-order selection. Architecture remains a separate layer. */
export function isDungeonGroundProp(prop: Prop): boolean {
  return prop.kind === 'rug' || prop.kind === 'moss';
}

/** Generated objects, accepted edits and placement ghosts share the same art
 * and tile anchor. Only the existing study artwork opts into wall fitting.
 */
export function drawDungeonProp(
  ctx: DrawingContext,
  prop: Prop,
  map: Pick<Dungeon, 'layout' | 'decoration'>,
): void {
  if (map.decoration.studySurface === 1 && drawFittedStudyProp(ctx, prop, map.layout)) return;
  drawProp(ctx, prop);
}
