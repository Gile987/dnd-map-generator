import type { Prop } from '../engine/model';
import type { DrawingContext } from './drawing-context';
import { path } from './drawing-primitives';

export function drawCauldron(ctx: DrawingContext, _prop: Prop): void {
  ctx.fillStyle = '#13222985';
  ctx.beginPath();
  ctx.ellipse(0.04, 0.14, 0.42, 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1d2a30';
  ctx.lineWidth = 0.055;
  for (const [x, y] of [
    [-0.22, 0.14],
    [0.22, 0.14],
    [0, 0.2],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x * 0.7, y - 0.16);
    ctx.lineTo(x, y + 0.08);
    ctx.stroke();
  }
  path(
    ctx,
    [
      [-0.36, -0.18],
      [-0.4, 0.02],
      [-0.3, 0.2],
      [0.3, 0.2],
      [0.4, 0.02],
      [0.36, -0.18],
    ],
    '#25333a',
    '#3f545c',
  );
  ctx.fillStyle = '#46555a';
  ctx.beginPath();
  ctx.ellipse(0, -0.18, 0.36, 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#74848a';
  ctx.lineWidth = 0.02;
  ctx.stroke();
  ctx.fillStyle = '#5f7d3e';
  ctx.beginPath();
  ctx.ellipse(0, -0.18, 0.28, 0.075, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#87a852';
  ctx.beginPath();
  ctx.ellipse(-0.03, -0.185, 0.22, 0.052, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#a9c46b';
  for (const [x, y, r] of [
    [-0.12, -0.19, 0.028],
    [0.06, -0.2, 0.034],
    [0.17, -0.185, 0.02],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#a9c46b66';
  ctx.lineWidth = 0.02;
  for (const x of [-0.1, 0.08]) {
    ctx.beginPath();
    ctx.moveTo(x, -0.26);
    ctx.quadraticCurveTo(x + 0.06, -0.34, x, -0.42);
    ctx.stroke();
  }
  ctx.strokeStyle = '#5c4632';
  ctx.lineWidth = 0.035;
  ctx.beginPath();
  ctx.arc(-0.36, -0.1, 0.07, Math.PI * 0.5, Math.PI * 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0.36, -0.1, 0.07, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.stroke();
}
