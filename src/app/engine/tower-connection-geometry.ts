import type { FootprintShape, ReservedArea } from './feature-reservation';
import { shapeBounds } from './feature-reservation';
import type { Point } from './model';
import type { StairLanding } from './tower-landings';
import type { TowerFloor, TowerStairStyle } from './tower';
import {
  towerAreaInsideWalls,
  towerFloorCenter,
  TOWER_INNER_WALL_RADIUS,
  TOWER_WALL_STROKE_WIDTH,
} from './tower-geometry';

export const SPIRAL_STAIR_RADIUS = 0.95;
export const SPIRAL_STAIR_STROKE = 0.07;
export const PORTAL_RADIUS = 0.8;
export const CONNECTION_STROKE = 0.08;

/** Captions have their own footprint; their width must not reserve empty space
 * beside the narrower stair body above them. Coordinates match historical art. */
export function towerConnectionCaption(
  point: Point,
  style: TowerStairStyle | 'portal',
  routes = 1,
): ReservedArea {
  const x = point.x + 0.5,
    y = point.y + 0.5;
  return style === 'spiral'
    ? { x: x - 1.65, y: y + 1.03, width: 3.3, height: routes * 0.75 }
    : { x: x - 1.25, y: y + 1, width: 2.5, height: 0.72 };
}
export function towerSeparateStairBody(point: Point): ReservedArea {
  const x = point.x + 0.5,
    y = point.y + 0.5;
  return { x: x - 0.7, y: y - 0.9, width: 1.4, height: 1.8 };
}
/** Soft shadows are decorative; only the physical body and caption reserve space. */
export function towerStairFootprint(
  stair: StairLanding,
  style: TowerStairStyle,
): readonly FootprintShape[] {
  return [
    style === 'spiral'
      ? {
          kind: 'circle',
          x: stair.x + 0.5,
          y: stair.y + 0.5,
          radius: SPIRAL_STAIR_RADIUS + SPIRAL_STAIR_STROKE / 2,
        }
      : { kind: 'rectangle', ...towerSeparateStairBody(stair) },
    { kind: 'rectangle', ...towerConnectionCaption(stair, style, stair.routes.length) },
  ];
}
export function towerPortalFootprint(point: Point): readonly FootprintShape[] {
  return [
    {
      kind: 'circle',
      x: point.x + 0.5,
      y: point.y + 0.5,
      radius: PORTAL_RADIUS + CONNECTION_STROKE / 2,
    },
    { kind: 'rectangle', ...towerConnectionCaption(point, 'portal') },
  ];
}
/** A broad bound for scrolling and coordinate controls, never for collision or picking. */
export function towerFootprintBounds(shapes: readonly FootprintShape[]): ReservedArea {
  const bounds = shapes.map(shapeBounds),
    x = Math.min(...bounds.map((b) => b.x)),
    y = Math.min(...bounds.map((b) => b.y));
  return {
    x,
    y,
    width: Math.max(...bounds.map((b) => b.x + b.width)) - x,
    height: Math.max(...bounds.map((b) => b.y + b.height)) - y,
  };
}
export function towerShapeInsideWalls(
  floor: Pick<TowerFloor, 'x' | 'y'>,
  shape: FootprintShape,
): boolean {
  if (shape.kind === 'rectangle') return towerAreaInsideWalls(floor, shape);
  const center = towerFloorCenter(floor),
    radius = TOWER_INNER_WALL_RADIUS - TOWER_WALL_STROKE_WIDTH / 2;
  return Math.hypot(shape.x - center.x, shape.y - center.y) + shape.radius <= radius;
}
