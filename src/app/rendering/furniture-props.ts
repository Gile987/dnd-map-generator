import type { Prop } from '../engine/model';
import type { DrawingContext } from './drawing-context';

// The caller centers and rotates the unrotated 2 × 1 footprint.
export function drawDiningTable(ctx: DrawingContext, prop: Prop): void {
  const wood = prop.variation < 0.5 ? '#a77b4d' : '#98734f';
  ctx.fillStyle = '#0b172d70';
  ctx.fillRect(-0.87, -0.34, 1.81, 0.78);
  ctx.fillStyle = '#46382c';
  for (const x of [-0.82, 0.72]) for (const y of [-0.4, 0.28]) ctx.fillRect(x, y, 0.12, 0.12);
  ctx.fillStyle = '#674c36';
  ctx.fillRect(-0.91, -0.41, 1.82, 0.8);
  ctx.fillStyle = wood;
  ctx.fillRect(-0.87, -0.38, 1.74, 0.7);
  ctx.strokeStyle = '#4c3d30';
  ctx.lineWidth = 0.02;
  ctx.strokeRect(-0.91, -0.41, 1.82, 0.8);
  ctx.strokeStyle = '#715234';
  ctx.lineWidth = 0.014;
  for (const y of [-0.2, -0.02, 0.16]) {
    ctx.beginPath();
    ctx.moveTo(-0.86, y);
    ctx.lineTo(0.86, y);
    ctx.stroke();
  }
  ctx.strokeStyle = '#d0a675';
  ctx.lineWidth = 0.018;
  ctx.beginPath();
  ctx.moveTo(-0.85, 0.29);
  ctx.lineTo(-0.85, -0.35);
  ctx.lineTo(0.84, -0.35);
  ctx.stroke();
  ctx.strokeStyle = '#b38a5f';
  ctx.lineWidth = 0.01;
  for (const [x, y] of [
    [-0.6, -0.25],
    [-0.18, 0.08],
    [0.32, -0.1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.27, y + 0.015);
    ctx.stroke();
  }
  ctx.fillStyle = '#514032';
  for (const x of [-0.79, 0.79])
    for (const y of [-0.29, 0.25]) {
      ctx.beginPath();
      ctx.arc(x, y, 0.015, 0, Math.PI * 2);
      ctx.fill();
    }
  // A small ceramic bowl and two mugs make the intended use readable from above.
  ctx.fillStyle = '#594f3b';
  ctx.beginPath();
  ctx.ellipse(0.25, 0, 0.14, 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c0ae80';
  ctx.beginPath();
  ctx.arc(0.23, -0.02, 0.115, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7a6744';
  ctx.beginPath();
  ctx.arc(0.23, -0.02, 0.075, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b9a586';
  for (const [x, y] of [
    [-0.5, -0.15],
    [0.61, 0.15],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x, y, 0.065, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#53463a';
    ctx.beginPath();
    ctx.arc(x, y, 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b9a586';
  }
}
