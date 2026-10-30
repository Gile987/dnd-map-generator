import type { DrawingContext } from './drawing-context';

function circle(
  ctx: DrawingContext,
  x: number,
  y: number,
  radius: number,
  fill: string,
  stroke?: string,
): void {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 0.018;
    ctx.stroke();
  }
}

export function drawTelescope(ctx: DrawingContext): void {
  ctx.fillStyle = '#07182066';
  ctx.beginPath();
  ctx.ellipse(0.035, 0.12, 0.4, 0.27, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#453929';
  ctx.lineWidth = 0.065;
  ctx.lineCap = 'round';
  for (const [x, y] of [
    [-0.29, 0.32],
    [0.28, 0.3],
    [0.02, -0.25],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(0, 0.03);
    ctx.lineTo(x, y);
    ctx.stroke();
    circle(ctx, x, y, 0.045, '#a98b4a', '#e4c781');
  }
  circle(ctx, 0, 0.03, 0.15, '#99783e', '#e0c27a');
  ctx.save();
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = '#503e27';
  ctx.fillRect(-0.28, -0.095, 0.6, 0.2);
  ctx.fillStyle = '#b99a51';
  ctx.fillRect(-0.24, -0.12, 0.53, 0.23);
  ctx.fillStyle = '#e2c985';
  ctx.fillRect(-0.23, -0.115, 0.51, 0.055);
  ctx.fillStyle = '#80632f';
  ctx.fillRect(-0.03, -0.13, 0.045, 0.25);
  ctx.fillStyle = '#493a27';
  ctx.fillRect(-0.37, -0.055, 0.13, 0.11);
  ctx.fillStyle = '#bd9d53';
  ctx.fillRect(-0.39, -0.075, 0.045, 0.15);
  ctx.fillStyle = '#dfc376';
  ctx.fillRect(0.27, -0.15, 0.085, 0.29);
  ctx.fillStyle = '#284c60';
  ctx.fillRect(0.3, -0.105, 0.055, 0.2);
  ctx.fillStyle = '#a5d4dc';
  ctx.fillRect(0.32, -0.09, 0.025, 0.07);
  ctx.restore();
  circle(ctx, 0.15, 0.12, 0.045, '#d8bd71', '#5f492a');
}

export function drawStarChartTable(ctx: DrawingContext): void {
  ctx.fillStyle = '#0b181c55';
  ctx.fillRect(-0.38, -0.3, 0.8, 0.7);
  ctx.fillStyle = '#694c30';
  ctx.fillRect(-0.4, -0.36, 0.8, 0.72);
  ctx.strokeStyle = '#be9b61';
  ctx.lineWidth = 0.035;
  ctx.strokeRect(-0.37, -0.33, 0.74, 0.66);
  ctx.fillStyle = '#1f3549';
  ctx.fillRect(-0.3, -0.27, 0.59, 0.5);
  circle(ctx, -0.01, -0.01, 0.19, '#293e52', '#a89869');
  ctx.strokeStyle = '#a8986977';
  ctx.lineWidth = 0.012;
  ctx.beginPath();
  ctx.moveTo(-0.24, -0.12);
  ctx.lineTo(0.13, 0.15);
  ctx.moveTo(-0.16, 0.16);
  ctx.lineTo(0.19, -0.18);
  ctx.stroke();
  for (const [x, y] of [
    [-0.18, -0.07],
    [-0.06, 0.02],
    [0.08, 0.12],
    [0.18, -0.18],
    [-0.11, 0.13],
  ] as const)
    circle(ctx, x, y, 0.018, '#eddda1');
  circle(ctx, 0.23, 0.22, 0.09, '#b19049', '#f0d18a');
  circle(ctx, 0.23, 0.22, 0.05, '#344957');
}

export function drawInstrumentCabinet(ctx: DrawingContext): void {
  ctx.fillStyle = '#0b181c55';
  ctx.fillRect(-0.36, -0.37, 0.76, 0.78);
  ctx.fillStyle = '#674b31';
  ctx.fillRect(-0.39, -0.4, 0.78, 0.8);
  ctx.strokeStyle = '#bd9a66';
  ctx.lineWidth = 0.035;
  ctx.strokeRect(-0.36, -0.37, 0.72, 0.74);
  ctx.fillStyle = '#253b43';
  ctx.fillRect(-0.29, -0.3, 0.58, 0.48);
  circle(ctx, -0.12, -0.08, 0.12, '#90783f', '#d7bb75');
  ctx.strokeStyle = '#dcc584';
  ctx.lineWidth = 0.025;
  ctx.beginPath();
  ctx.moveTo(-0.12, -0.2);
  ctx.lineTo(-0.12, 0.04);
  ctx.moveTo(-0.24, -0.08);
  ctx.lineTo(0, -0.08);
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i % 2 ? '#819990' : '#c1ac77';
    ctx.fillRect(0.07 + i * 0.065, -0.22, 0.045, 0.28);
  }
  ctx.fillStyle = '#90683f';
  ctx.fillRect(-0.29, 0.2, 0.58, 0.12);
  circle(ctx, 0, 0.26, 0.025, '#dfc57f');
}

export function drawStarCharts(ctx: DrawingContext): void {
  ctx.save();
  ctx.rotate(-0.18);
  ctx.fillStyle = '#08171e44';
  ctx.fillRect(-0.25, -0.22, 0.57, 0.51);
  ctx.fillStyle = '#b9ab88';
  ctx.fillRect(-0.3, -0.25, 0.51, 0.46);
  ctx.rotate(0.35);
  ctx.fillStyle = '#d4c9a5';
  ctx.fillRect(-0.23, -0.22, 0.52, 0.44);
  circle(ctx, 0.02, 0, 0.14, '#c7bd9c', '#6c7e81');
  ctx.strokeStyle = '#667982';
  ctx.lineWidth = 0.014;
  ctx.beginPath();
  ctx.moveTo(-0.15, 0.1);
  ctx.lineTo(-0.06, -0.08);
  ctx.lineTo(0.08, 0.03);
  ctx.lineTo(0.18, -0.1);
  ctx.stroke();
  for (const [x, y] of [
    [-0.15, 0.1],
    [-0.06, -0.08],
    [0.08, 0.03],
    [0.18, -0.1],
  ] as const)
    circle(ctx, x, y, 0.018, '#4f6473');
  ctx.restore();
}
