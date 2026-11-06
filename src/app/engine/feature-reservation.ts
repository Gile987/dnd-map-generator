import type { Point, Prop } from './model';

// Tile bounds are half-open, like room bounds. Reserved floor can be passable.
export interface ReservedArea extends Point {
  readonly width: number;
  readonly height: number;
}

export interface FeatureReservation {
  readonly area: ReservedArea;
  readonly props: readonly Prop[];
}

export function areaAround(center: Point, radiusX: number, radiusY: number): ReservedArea {
  return {
    x: center.x - radiusX,
    y: center.y - radiusY,
    width: radiusX * 2 + 1,
    height: radiusY * 2 + 1,
  };
}

export function areaContains(area: ReservedArea, point: Point): boolean {
  return (
    point.x >= area.x &&
    point.x < area.x + area.width &&
    point.y >= area.y &&
    point.y < area.y + area.height
  );
}

export function areasOverlap(a: ReservedArea, b: ReservedArea): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Continuous footprints for artwork whose empty bounding-box corners are usable. */
export type FootprintShape =
  | ({ readonly kind: 'rectangle' } & ReservedArea)
  | ({ readonly kind: 'circle'; readonly radius: number } & Point);

export function shapeBounds(shape: FootprintShape): ReservedArea {
  return shape.kind === 'rectangle'
    ? { x: shape.x, y: shape.y, width: shape.width, height: shape.height }
    : {
        x: shape.x - shape.radius,
        y: shape.y - shape.radius,
        width: 2 * shape.radius,
        height: 2 * shape.radius,
      };
}
export function shapeContains(shape: FootprintShape, point: Point): boolean {
  return shape.kind === 'rectangle'
    ? areaContains(shape, point)
    : (point.x - shape.x) ** 2 + (point.y - shape.y) ** 2 <= shape.radius ** 2;
}
export function shapesOverlap(a: FootprintShape, b: FootprintShape): boolean {
  if (a.kind === 'rectangle')
    return b.kind === 'rectangle' ? areasOverlap(a, b) : shapesOverlap(b, a);
  if (b.kind === 'circle') return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < (a.radius + b.radius) ** 2;
  const x = Math.max(b.x, Math.min(a.x, b.x + b.width)),
    y = Math.max(b.y, Math.min(a.y, b.y + b.height));
  return (a.x - x) ** 2 + (a.y - y) ** 2 < a.radius ** 2;
}
