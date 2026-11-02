import type { DrawingContext } from './drawing-context';

function wheel(ctx: DrawingContext, x: number, y: number, radius: number): void {
  ctx.fillStyle = '#10212855';
  ctx.beginPath();
  ctx.ellipse(x + 0.025, y + 0.035, radius, radius, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3c372d';
  ctx.lineWidth = 0.07;
  ctx.beginPath();
  ctx.arc(x, y, radius - 0.035, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#ba945b';
  ctx.lineWidth = 0.035;
  ctx.beginPath();
  ctx.arc(x, y, radius - 0.075, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#947045';
  ctx.lineWidth = 0.03;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * (radius - 0.07), y + Math.sin(a) * (radius - 0.07));
    ctx.stroke();
  }
  ctx.fillStyle = '#d0aa6c';
  ctx.beginPath();
  ctx.arc(x, y, 0.055, 0, Math.PI * 2);
  ctx.fill();
}

// All wood, wheels, shafts and shadows stay inside the occupied 3 × 2 rectangle.
export function drawCollapsedWagon(ctx: DrawingContext): void {
  ctx.fillStyle = '#0b1b2470';
  ctx.fillRect(-1.3, -0.66, 2.65, 1.42);
  wheel(ctx, -0.65, -0.68, 0.27);
  wheel(ctx, 0.54, -0.68, 0.27);
  wheel(ctx, -0.65, 0.68, 0.27);
  ctx.strokeStyle = '#4c3829';
  ctx.lineWidth = 0.09;
  ctx.beginPath();
  ctx.moveTo(-0.68, -0.8);
  ctx.lineTo(-0.68, 0.8);
  ctx.moveTo(0.55, -0.8);
  ctx.lineTo(0.66, 0.58);
  ctx.stroke();
  ctx.fillStyle = '#533d2b';
  ctx.fillRect(-1.06, -0.56, 2.1, 1.14);
  for (let i = 0; i < 7; i++) {
    const x = -1.01 + i * 0.29;
    ctx.fillStyle = i % 2 ? '#9a7348' : '#ad8353';
    if (i === 5) {
      ctx.beginPath();
      ctx.moveTo(x, -0.48);
      ctx.lineTo(x + 0.27, -0.48);
      ctx.lineTo(x + 0.2, 0.04);
      ctx.lineTo(x + 0.1, -0.03);
      ctx.lineTo(x, 0.14);
      ctx.closePath();
      ctx.fill();
    } else ctx.fillRect(x, -0.48, 0.26, 0.97);
    ctx.strokeStyle = '#715034';
    ctx.lineWidth = 0.018;
    ctx.beginPath();
    ctx.moveTo(x + 0.06, -0.4);
    ctx.lineTo(x + 0.09, i === 5 ? -0.01 : 0.43);
    ctx.stroke();
  }
  ctx.fillStyle = '#694a2e';
  ctx.fillRect(-1.12, -0.6, 2.25, 0.12);
  ctx.fillRect(-1.12, 0.49, 1.45, 0.11);
  ctx.fillRect(-1.14, -0.54, 0.12, 1.1);
  ctx.strokeStyle = '#d2ad73';
  ctx.lineWidth = 0.025;
  ctx.beginPath();
  ctx.moveTo(-1.1, -0.59);
  ctx.lineTo(1.07, -0.59);
  ctx.moveTo(-1.13, -0.5);
  ctx.lineTo(-1.13, 0.52);
  ctx.stroke();
  ctx.strokeStyle = '#80623c';
  ctx.lineWidth = 0.07;
  ctx.beginPath();
  ctx.moveTo(0.9, -0.35);
  ctx.lineTo(1.4, -0.22);
  ctx.moveTo(0.93, 0.29);
  ctx.lineTo(1.25, 0.38);
  ctx.stroke();
  ctx.strokeStyle = '#a2a49a';
  ctx.lineWidth = 0.035;
  ctx.beginPath();
  ctx.moveTo(-0.89, -0.51);
  ctx.lineTo(-0.89, 0.5);
  ctx.moveTo(0.82, -0.51);
  ctx.lineTo(0.82, 0.34);
  ctx.stroke();
  // A torn canvas bundle and a split sideboard make the damage visible from above.
  ctx.fillStyle = '#a69f79';
  ctx.beginPath();
  ctx.moveTo(-0.62, -0.28);
  ctx.lineTo(-0.06, -0.32);
  ctx.lineTo(0.12, 0.05);
  ctx.lineTo(-0.03, 0.2);
  ctx.lineTo(-0.16, 0.1);
  ctx.lineTo(-0.28, 0.24);
  ctx.lineTo(-0.65, 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#d5c69a';
  ctx.lineWidth = 0.025;
  ctx.beginPath();
  ctx.moveTo(-0.6, -0.18);
  ctx.lineTo(-0.13, -0.2);
  ctx.moveTo(-0.36, -0.28);
  ctx.lineTo(-0.31, 0.17);
  ctx.stroke();
  ctx.save();
  ctx.translate(0.3, 0.3);
  ctx.rotate(-0.18);
  ctx.fillStyle = '#bd945e';
  ctx.fillRect(-0.43, -0.045, 0.86, 0.09);
  ctx.restore();
}

export function drawWagonWheel(ctx: DrawingContext): void {
  wheel(ctx, 0, 0, 0.37);
}

export function drawSpilledCrate(ctx: DrawingContext): void {
  ctx.fillStyle = '#0a1b2355';
  ctx.fillRect(-0.37, -0.31, 0.76, 0.66);
  ctx.fillStyle = '#6d4e31';
  ctx.fillRect(-0.36, -0.35, 0.7, 0.67);
  ctx.fillStyle = '#aa8051';
  ctx.fillRect(-0.3, -0.28, 0.56, 0.5);
  ctx.fillStyle = '#3c3426';
  ctx.fillRect(-0.22, -0.21, 0.39, 0.33);
  ctx.fillStyle = '#c59b65';
  ctx.fillRect(-0.35, -0.35, 0.7, 0.07);
  ctx.fillRect(-0.35, -0.29, 0.07, 0.6);
  ctx.fillRect(-0.33, 0.24, 0.5, 0.07);
  ctx.save();
  ctx.rotate(-0.3);
  ctx.fillStyle = '#c29a64';
  ctx.fillRect(0.1, -0.26, 0.1, 0.6);
  ctx.restore();
  for (const [x, y, c] of [
    [-0.09, -0.08, '#9e6550'],
    [0.06, -0.03, '#bdac72'],
    [-0.04, 0.06, '#74866b'],
  ] as const) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawSpilledGoods(ctx: DrawingContext): void {
  ctx.fillStyle = '#13242b33';
  ctx.beginPath();
  ctx.ellipse(0.02, 0.08, 0.4, 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c4b089';
  ctx.beginPath();
  ctx.ellipse(-0.08, 0.03, 0.2, 0.25, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#88744e';
  ctx.lineWidth = 0.025;
  ctx.beginPath();
  ctx.moveTo(-0.21, -0.1);
  ctx.lineTo(-0.06, -0.2);
  ctx.moveTo(-0.17, -0.08);
  ctx.lineTo(0.03, 0.16);
  ctx.stroke();
  for (const [x, y, r, c] of [
    [0.21, -0.13, 0.07, '#a16d4c'],
    [0.31, 0.08, 0.055, '#b69252'],
    [0.15, 0.21, 0.07, '#6d8263'],
    [-0.3, 0.19, 0.045, '#b48b5a'],
  ] as const) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
