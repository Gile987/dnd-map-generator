import { HEIGHT, WIDTH } from '../engine/model';
import type { DrawingContext } from './drawing-context';

export function path(
  ctx: DrawingContext,
  points: readonly (readonly [number, number])[],
  fill: string,
  stroke?: string,
): void {
  const first = points[0];
  if (!first) return;
  ctx.beginPath();
  ctx.moveTo(first[0], first[1]);
  for (const point of points.slice(1)) ctx.lineTo(point[0], point[1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

export function drawGrid(ctx: DrawingContext, color: string, opacity?: number): void {
  if (opacity !== undefined && (!Number.isFinite(opacity) || opacity < 0 || opacity > 1))
    throw new Error('Grid opacity must be between 0 and 1.');
  ctx.beginPath();
  ctx.lineWidth = 0.012;
  // Renderer palettes supply #RRGGBBAA colors. Keep their original alpha unless overridden.
  ctx.strokeStyle =
    opacity === undefined
      ? color
      : `${color.slice(0, 7)}${Math.round(opacity * 255)
          .toString(16)
          .padStart(2, '0')}`;
  for (let x = 0; x <= WIDTH; x++) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
  }
  for (let y = 0; y <= HEIGHT; y++) {
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
  }
  ctx.stroke();
}
