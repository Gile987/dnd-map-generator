import type { Point } from './model';
import type { ReservedArea } from './feature-reservation';
import type { TowerFloor } from './tower';

/** Shared with the renderer; the wall stroke sits on this circular path. */
export const TOWER_INNER_WALL_RADIUS = 5.92;
export const TOWER_WALL_STROKE_WIDTH = 0.14;
export function towerFloorCenter(floor: Pick<TowerFloor, 'x' | 'y'>): Point {
  return { x: floor.x + 7, y: floor.y + 6.5 };
}
/** A convex rectangle fits in a circle exactly when its farthest corner does.
 * The tile mask is sampled at cell centers and cannot describe partial edge
 * cells. Use the actual inside edge of the painted wall for authored artwork. */
export function towerAreaInsideWalls(
  floor: Pick<TowerFloor, 'x' | 'y'>,
  area: ReservedArea,
): boolean {
  const center = towerFloorCenter(floor),
    dx = Math.max(Math.abs(area.x - center.x), Math.abs(area.x + area.width - center.x)),
    dy = Math.max(Math.abs(area.y - center.y), Math.abs(area.y + area.height - center.y)),
    radius = TOWER_INNER_WALL_RADIUS - TOWER_WALL_STROKE_WIDTH / 2;
  return dx * dx + dy * dy <= radius * radius;
}
