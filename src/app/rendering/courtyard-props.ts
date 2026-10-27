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
