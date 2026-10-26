import type { Prop } from '../engine/model';
import type { DrawingContext } from './drawing-context';

export function drawStandingStone(ctx: DrawingContext, prop: Prop): void {
  ctx.rotate((prop.variation - 0.5) * 0.2);
  ctx.fillStyle = '#10201970';
  ctx.beginPath();
  ctx.ellipse(0.06, 0.17, 0.36, 0.27, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#555f59';
  ctx.strokeStyle = '#263a34';
  ctx.lineWidth = 0.025;
  ctx.beginPath();
  ctx.moveTo(-0.3, 0.24);
  ctx.lineTo(-0.26, -0.27);
  ctx.lineTo(-0.1, -0.43);
  ctx.lineTo(0.19, -0.38);
  ctx.lineTo(0.29, -0.2);
  ctx.lineTo(0.32, 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#a4ada0';
  ctx.beginPath();
  ctx.moveTo(-0.26, -0.27);
  ctx.lineTo(-0.1, -0.43);
  ctx.lineTo(0.19, -0.38);
  ctx.lineTo(0.29, -0.2);
  ctx.lineTo(0.04, -0.09);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7b897e';
  ctx.beginPath();
  ctx.moveTo(-0.26, -0.27);
  ctx.lineTo(0.04, -0.09);
  ctx.lineTo(0.02, 0.24);
  ctx.lineTo(-0.3, 0.24);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#c3ceb0';
  ctx.lineWidth = 0.024;
  ctx.beginPath();
  ctx.moveTo(-0.13, -0.19);
  ctx.lineTo(-0.13, 0.12);
  ctx.moveTo(-0.21, -0.04);
  ctx.lineTo(-0.13, -0.13);
  ctx.lineTo(-0.05, -0.04);
  ctx.stroke();
  ctx.strokeStyle = '#35483e';
  ctx.lineWidth = 0.017;
  ctx.beginPath();
  ctx.moveTo(0.2, -0.17);
  ctx.lineTo(0.12, -0.05);
  ctx.lineTo(0.2, 0.04);
  ctx.stroke();
  ctx.fillStyle = '#64814d';
  for (const [x, y] of [
    [-0.22, 0.2],
    [0.18, 0.23],
    [-0.2, -0.27],
  ]) {
    if (x === undefined || y === undefined) continue;
    ctx.beginPath();
    ctx.ellipse(x, y, 0.07, 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
