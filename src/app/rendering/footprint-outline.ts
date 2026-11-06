import type { FootprintShape } from '../engine/feature-reservation';
import type { DrawingContext } from './drawing-context';

/** Editor-only outlines use the same compound geometry as placement and picking. */
export function drawFootprintOutline(
  ctx: DrawingContext,
  shapes: readonly FootprintShape[],
  fill = false,
): void {
  for (const shape of shapes) {
    if (shape.kind === 'circle') {
      ctx.beginPath();
      ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
      if (fill) ctx.fill();
      ctx.stroke();
    } else {
      if (fill) ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
      ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
    }
  }
}
