import type { Prop } from '../engine/model';
import type { DrawingContext } from './drawing-context';
import { path } from './drawing-primitives';

export function drawLowRubble(ctx: DrawingContext, prop: Prop): void {
  // Flat chips stay below token height and never block movement.
  for (let i = 0; i < 5; i++) {
    const x = Math.sin(i * 5 + prop.variation * 3) * 0.28;
    const y = Math.cos(i * 4 + prop.variation) * 0.25;
    path(
      ctx,
      [
        [x - 0.09, y - 0.04],
        [x + 0.04, y - 0.08],
        [x + 0.11, y + 0.04],
        [x - 0.05, y + 0.07],
      ],
      i % 2 ? '#9b9d87' : '#b8b59b',
      '#666e5740',
    );
  }
}

/** A free-standing 2 × 2 stone well: circular coping, dark mouth with a faint
 * water glint, and a wooden bucket on a rope. All shadows stay inside the
 * footprint rect plus a small bleed, so the sprite never overlaps movers.
 */
export function drawStoneWell(ctx: DrawingContext, prop: Prop): void {
  ctx.fillStyle = '#232d2066';
  ctx.fillRect(-0.98, -0.9, 1.96, 1.88);
  const plinth = ctx.createRadialGradient(-0.25, -0.35, 0.08, 0, 0, 0.9);
  plinth.addColorStop(0, '#c9c2a2');
  plinth.addColorStop(0.72, '#a6a287');
  plinth.addColorStop(1, '#6d7060');
  ctx.beginPath();
  ctx.arc(0, 0, 0.82, 0, Math.PI * 2);
  ctx.fillStyle = plinth;
  ctx.fill();
  ctx.strokeStyle = '#4b5243';
  ctx.lineWidth = 0.05;
  ctx.stroke();
  ctx.strokeStyle = '#525c4720';
  ctx.lineWidth = 0.03;
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6 + 0.26;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 0.62, Math.sin(angle) * 0.62);
    ctx.lineTo(Math.cos(angle) * 0.78, Math.sin(angle) * 0.78);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 0.5, 0, Math.PI * 2);
  ctx.fillStyle = '#221a10';
  ctx.fill();
  ctx.strokeStyle = '#d8d2ae';
  ctx.lineWidth = 0.045;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-0.07, 0.03, 0.3, 0.24, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = '#39525940';
  ctx.fill();
  // A rope descends from the rim to a wooden bucket, resting at its side.
  ctx.strokeStyle = '#6d5b3b';
  ctx.lineWidth = 0.025;
  ctx.beginPath();
  ctx.moveTo(0.16, -0.46);
  ctx.lineTo(0.1, -0.1);
  ctx.stroke();
  ctx.strokeStyle = '#663e3c';
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  ctx.moveTo(-0.02, -0.38);
  ctx.lineTo(0.16, -0.46);
  ctx.stroke();
  path(
    ctx,
    [
      [0.02, -0.14],
      [0.2, -0.14],
      [0.16, 0.08],
      [0.06, 0.08],
    ],
    '#8a6a3f',
    '#4f3a20',
  );
  ctx.strokeStyle = '#5d4527';
  ctx.lineWidth = 0.03;
  ctx.beginPath();
  ctx.moveTo(0.02, -0.06);
  ctx.lineTo(0.2, -0.06);
  ctx.stroke();
  // Coping chips, a moss tuft and scattered pebbles around the rim.
  for (let i = 0; i < 8; i++) {
    const a = i * 2.9 + prop.variation * 4;
    ctx.fillStyle = i % 2 ? '#b5ad8b62' : '#707a5f4c';
    ctx.fillRect(Math.cos(a) * 0.92, Math.sin(a) * 0.92, 0.07, 0.032);
  }
  path(
    ctx,
    [
      [-0.78, -0.42],
      [-0.66, -0.5],
      [-0.6, -0.38],
      [-0.72, -0.3],
    ],
    '#7d875f',
    '#55603f',
  );
  path(
    ctx,
    [
      [0.72, 0.55],
      [0.85, 0.5],
      [0.93, 0.62],
      [0.8, 0.68],
    ],
    '#8f9179',
    '#5c624c',
  );
}

export function drawDryFountain(ctx: DrawingContext, prop: Prop): void {
  ctx.fillStyle = '#25372665';
  ctx.fillRect(-1.36, -1.25, 2.84, 2.77);
  const base = [
    [-1.45, -1.15],
    [-1.15, -1.45],
    [1.15, -1.45],
    [1.45, -1.15],
    [1.45, 1.15],
    [1.15, 1.45],
    [-1.15, 1.45],
    [-1.45, 1.15],
  ] as const;
  path(ctx, base, '#9a9d83', '#4c5a48');
  ctx.strokeStyle = '#d6d0ad';
  ctx.lineWidth = 0.04;
  ctx.stroke();
  const stone = ctx.createRadialGradient(-0.4, -0.5, 0.1, 0, 0, 1.4);
  stone.addColorStop(0, '#d9d2af');
  stone.addColorStop(0.75, '#b4b291');
  stone.addColorStop(1, '#777f64');
  ctx.beginPath();
  ctx.arc(0, 0, 1.3, 0, Math.PI * 2);
  ctx.fillStyle = stone;
  ctx.fill();
  ctx.strokeStyle = '#4c5c48';
  ctx.lineWidth = 0.06;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 1.02, 0, Math.PI * 2);
  ctx.fillStyle = '#6b7659';
  ctx.fill();
  ctx.strokeStyle = '#dfd5ac';
  ctx.lineWidth = 0.04;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0.06, 0.9, 0, Math.PI * 2);
  ctx.fillStyle = '#96967a';
  ctx.fill();
  ctx.strokeStyle = '#525f4650';
  ctx.lineWidth = 0.025;
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 1.05, Math.sin(angle) * 1.05);
    ctx.lineTo(Math.cos(angle) * 1.27, Math.sin(angle) * 1.27);
    ctx.stroke();
  }
  path(
    ctx,
    [
      [-0.24, -0.2],
      [0.18, -0.27],
      [0.29, 0.17],
      [-0.16, 0.28],
    ],
    '#c3bea0',
    '#59674e',
  );
  ctx.fillStyle = '#686f54';
  ctx.beginPath();
  ctx.arc(0, 0, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#505c47';
  ctx.lineWidth = 0.025;
  ctx.beginPath();
  ctx.moveTo(-0.9, 0.5);
  ctx.lineTo(-0.55, 0.2);
  ctx.lineTo(-0.65, -0.1);
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = i * 2.4 + prop.variation;
    ctx.fillStyle = i % 2 ? '#5f795047' : '#c5b47a65';
    ctx.fillRect(Math.cos(a) * 0.7, Math.sin(a) * 0.7, 0.08, 0.035);
  }
}
