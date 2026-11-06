import {
  towerStairFootprint,
  towerPortalFootprint,
  towerFootprintBounds,
  towerShapeInsideWalls,
} from '../tower-connection-geometry';
import type { Point } from '../model';
import type { FootprintShape, ReservedArea } from '../feature-reservation';
import { shapesOverlap } from '../feature-reservation';
import { towerFloorAt, towerStairStyle } from '../tower';
import type { Tower } from '../tower';
import { towerStairLandings } from '../tower-landings';
import type { StairLanding } from '../tower-landings';
import type { TowerDocument } from './tower-document';

export interface TowerStairMove extends Point {
  readonly id: string;
}
export interface EditableStairLanding extends StairLanding {
  readonly id: string;
}
/** Identity comes from the original routes, never from an authored coordinate. */
export function towerStairId(landing: StairLanding): string {
  return `stairs-${landing.floor}-${landing.routes
    .map((r) => `${r.id}-${r.direction}`)
    .sort()
    .join('-')}`;
}
export function towerStairMoves(map: TowerDocument): readonly TowerStairMove[] {
  return map.objectEdits?.version === 2 ? map.objectEdits.stairs : [];
}
export function editableTowerStairs(map: TowerDocument): readonly EditableStairLanding[] {
  const moves = new Map(towerStairMoves(map).map((m) => [m.id, m]));
  return towerStairLandings(map).map((landing) => {
    const id = towerStairId(landing),
      move = moves.get(id);
    return { ...landing, id, ...(move ? { x: move.x, y: move.y } : {}) };
  });
}
export function resolvedTowerLayout(map: TowerDocument): Tower['layout'] {
  if (!towerStairMoves(map).length) return map.layout;
  const stairs = editableTowerStairs(map);
  return {
    ...map.layout,
    connections: map.layout.connections.map((c) => {
      if (c.kind !== 'stairs') return c;
      const departure = stairs.find(
          (s) => s.floor === c.from && s.routes.some((r) => r.id === c.id),
        ),
        arrival = stairs.find((s) => s.floor === c.to && s.routes.some((r) => r.id === c.id));
      return {
        ...c,
        departure: departure ? { x: departure.x, y: departure.y } : c.departure,
        arrival: arrival ? { x: arrival.x, y: arrival.y } : c.arrival,
      };
    }),
  };
}
/** Broad extent for scrolling and placement coordinates; precise geometry lives
 * in towerStairFootprint and is shared by picking, overlays and validation. */
export function towerStairBounds(
  map: Pick<Tower, 'layout' | 'version'>,
  stair: StairLanding,
): ReservedArea {
  return towerFootprintBounds(towerStairFootprint(stair, towerStairStyle(map)));
}
/** Manual edits collide with the actual body and caption separately. */
export function towerConnectionFootprints(map: TowerDocument): readonly FootprintShape[] {
  return [
    ...editableTowerStairs(map).flatMap((stair) =>
      towerStairFootprint(stair, towerStairStyle(map)),
    ),
    ...map.layout.connections.flatMap((connection) =>
      connection.kind === 'portal'
        ? [connection.departure, connection.arrival].flatMap(towerPortalFootprint)
        : [],
    ),
  ];
}
export function towerStairPlacementError(map: TowerDocument): string | undefined {
  const stairs = editableTowerStairs(map),
    moved = new Set(towerStairMoves(map).map((m) => m.id));
  for (const stair of stairs) {
    if (!moved.has(stair.id)) continue;
    const floor = towerFloorAt(map, stair),
      footprint = towerStairFootprint(stair, towerStairStyle(map));
    if (floor?.number !== stair.floor)
      return `Keep this staircase on floor ${stair.floor}. Its destinations stay linked.`;
    if (footprint.some((shape) => !towerShapeInsideWalls(floor, shape)))
      return 'Keep the staircase and its connection labels inside the circular walls.';
    if (
      stairs.some(
        (other) =>
          other.id !== stair.id &&
          towerStairFootprint(other, towerStairStyle(map)).some((otherShape) =>
            footprint.some((shape) => shapesOverlap(shape, otherShape)),
          ),
      )
    )
      return 'Keep staircases and their connection labels apart.';
    for (const c of map.layout.connections) {
      if (c.kind !== 'portal') continue;
      for (const point of [c.departure, c.arrival])
        if (
          towerPortalFootprint(point).some((otherShape) =>
            footprint.some((shape) => shapesOverlap(shape, otherShape)),
          )
        )
          return 'Keep the portal and its connection labels clear.';
    }
  }
  return undefined;
}
