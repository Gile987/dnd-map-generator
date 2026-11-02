import type { Point } from '../engine/model';

export interface ViewportTransform {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly width: number;
  readonly height: number;
}
export function viewportTransform(
  width: number,
  height: number,
  columns: number,
  rows: number,
  zoom: number,
  pan: Point,
): ViewportTransform {
  const scale = Math.min(width / columns, height / rows) * 0.94 * zoom;
  const w = columns * scale,
    h = rows * scale;
  return {
    x: (width - w) / 2 + Math.max(-w / 2, Math.min(w / 2, pan.x)),
    y: (height - h) / 2 + Math.max(-h / 2, Math.min(h / 2, pan.y)),
    scale,
    width: w,
    height: h,
  };
}
export function inversePoint(transform: ViewportTransform, point: Point): Point {
  return {
    x: (point.x - transform.x) / transform.scale,
    y: (point.y - transform.y) / transform.scale,
  };
}
