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
