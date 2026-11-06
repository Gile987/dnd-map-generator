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

/** Frame a chosen area while keeping the same zoom/pan contract as whole-map Fit. */
export function areaViewport(
  width: number,
  height: number,
  columns: number,
  rows: number,
  area: Point & { readonly width: number; readonly height: number },
) {
  const fitScale = Math.min(width / columns, height / rows) * 0.94;
  const areaScale = Math.min(width / (area.width + 2), height / (area.height + 2)) * 0.94;
  const zoom = Math.max(0.5, Math.min(4, areaScale / fitScale));
  return {
    zoom,
    pan: {
      x: (columns / 2 - area.x - area.width / 2) * fitScale * zoom,
      y: (rows / 2 - area.y - area.height / 2) * fitScale * zoom,
    },
  };
}
