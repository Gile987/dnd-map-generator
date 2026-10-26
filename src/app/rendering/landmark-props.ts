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

// Top-down stone figure and square plinth, including its shadow, fit one tile.
export function drawWeatheredStatue(ctx: DrawingContext, prop: Prop): void {
  ctx.fillStyle = '#101b2860';
  ctx.fillRect(-0.36, -0.32, 0.79, 0.76);
  ctx.fillStyle = '#505b64';
  ctx.fillRect(-0.4, -0.4, 0.8, 0.8);
  ctx.strokeStyle = '#26343e';
  ctx.lineWidth = 0.025;
  ctx.strokeRect(-0.4, -0.4, 0.8, 0.8);
  ctx.fillStyle = '#a6aaa2';
  ctx.fillRect(-0.35, -0.35, 0.7, 0.65);
  ctx.fillStyle = '#777f80';
  ctx.fillRect(-0.35, 0.24, 0.7, 0.11);
  ctx.strokeStyle = '#c4c5b4';
  ctx.lineWidth = 0.018;
  ctx.beginPath();
  ctx.moveTo(-0.33, 0.22);
  ctx.lineTo(-0.33, -0.33);
  ctx.lineTo(0.32, -0.33);
  ctx.stroke();
  ctx.fillStyle = '#4d5c60';
  ctx.beginPath();
  ctx.ellipse(0.02, 0.06, 0.26, 0.23, 0, 0, Math.PI * 2);
  ctx.fill();
  // A robed guardian, one shoulder chipped, with a worn round head.
  ctx.fillStyle = '#747f80';
  ctx.beginPath();
  ctx.moveTo(-0.1, -0.09);
  ctx.lineTo(-0.27, 0.02);
  ctx.lineTo(-0.21, 0.12);
  ctx.lineTo(-0.14, 0.1);
  ctx.lineTo(-0.16, 0.26);
  ctx.lineTo(0.17, 0.26);
  ctx.lineTo(0.12, 0.06);
  ctx.lineTo(0.22, 0.01);
  ctx.lineTo(0.15, -0.08);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#3d5059';
  ctx.lineWidth = 0.018;
  ctx.stroke();
  ctx.fillStyle = '#b3b9ac';
  ctx.beginPath();
  ctx.ellipse(-0.01, -0.12, 0.12, 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#d1d1bb';
  ctx.beginPath();
  ctx.moveTo(-0.06, -0.2);
  ctx.lineTo(0.02, -0.22);
  ctx.moveTo(-0.09, 0.02);
  ctx.lineTo(-0.1, 0.19);
  ctx.moveTo(0.04, 0.05);
  ctx.lineTo(0.09, 0.22);
  ctx.stroke();
  ctx.strokeStyle = '#55646a';
  ctx.beginPath();
  ctx.moveTo(0.34, -0.25);
  ctx.lineTo(0.25, -0.16);
  ctx.lineTo(0.3, -0.1);
  ctx.moveTo(-0.32, 0.25);
  ctx.lineTo(-0.23, 0.19);
  ctx.stroke();
  ctx.fillStyle = prop.variation < 0.5 ? '#73836a' : '#858c79';
  ctx.fillRect(0.22, 0.24, 0.09, 0.04);
  ctx.fillRect(-0.32, -0.3, 0.06, 0.035);
}
