import type { Prop } from '../engine/model';
import type { DrawingContext } from './drawing-context';

const books = ['#867453', '#656f74', '#7e4d46', '#89906b', '#b29e77', '#5f7770'] as const;

export function drawDesk(ctx: DrawingContext, prop: Prop): void {
  ctx.rotate((Math.floor(prop.variation * 4) * Math.PI) / 2);
  ctx.fillStyle = '#10232a85';
  ctx.fillRect(-0.4, -0.33, 0.84, 0.58);
  ctx.fillStyle = '#59432e';
  ctx.fillRect(-0.42, -0.38, 0.84, 0.58);
  ctx.fillStyle = '#aa8453';
  ctx.fillRect(-0.37, -0.33, 0.74, 0.48);
  ctx.strokeStyle = '#c3a373';
  ctx.lineWidth = 0.012;
  for (const y of [-0.22, -0.1, 0.04]) {
    ctx.beginPath();
    ctx.moveTo(-0.35, y);
    ctx.lineTo(0.35, y);
    ctx.stroke();
  }
  // A tucked-in stool shares the desk's single occupied tile.
  ctx.fillStyle = '#4b3929';
  ctx.fillRect(-0.16, 0.22, 0.32, 0.25);
  ctx.fillStyle = '#8f6747';
  ctx.fillRect(-0.12, 0.23, 0.24, 0.16);
  ctx.strokeStyle = '#bf9b69';
  ctx.strokeRect(-0.12, 0.23, 0.24, 0.16);
  ctx.save();
  ctx.rotate(-0.12);
  ctx.fillStyle = '#ddd0a4';
  ctx.fillRect(-0.23, -0.25, 0.26, 0.3);
  ctx.fillStyle = '#c4b17d';
  ctx.fillRect(-0.23, -0.25, 0.26, 0.025);
  ctx.strokeStyle = '#8e8060';
  ctx.lineWidth = 0.009;
  for (let y = -0.17; y < 0; y += 0.045) {
    ctx.beginPath();
    ctx.moveTo(-0.19, y);
    ctx.lineTo(-0.01, y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#554b38';
  ctx.fillRect(0.14, -0.2, 0.17, 0.22);
  ctx.fillStyle = '#876453';
  ctx.fillRect(0.16, -0.18, 0.13, 0.18);
  ctx.strokeStyle = '#d5be82';
  ctx.lineWidth = 0.012;
  ctx.beginPath();
  ctx.moveTo(0.185, -0.18);
  ctx.lineTo(0.185, 0);
  ctx.stroke();
  ctx.fillStyle = '#242e30';
  ctx.beginPath();
  ctx.arc(0.23, 0.09, 0.035, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d1c5a4';
  ctx.lineWidth = 0.013;
  ctx.beginPath();
  ctx.moveTo(0.23, 0.09);
  ctx.quadraticCurveTo(0.33, -0.01, 0.3, -0.1);
  ctx.stroke();
}

export function drawBookshelf(ctx: DrawingContext, prop: Prop): void {
  ctx.rotate((Math.floor(prop.variation * 4) * Math.PI) / 2);
  ctx.fillStyle = '#13222890';
  ctx.fillRect(-0.43, -0.31, 0.89, 0.67);
  ctx.fillStyle = '#493b2e';
  ctx.fillRect(-0.46, -0.4, 0.92, 0.76);
  ctx.fillStyle = '#302f29';
  ctx.fillRect(-0.38, -0.34, 0.76, 0.62);
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 7; i++) {
      const x = -0.34 + i * 0.098,
        y = -0.31 + row * 0.2;
      ctx.fillStyle =
        books[(i + row * 3 + Math.floor(prop.variation * 9)) % books.length] ?? books[0];
      ctx.fillRect(x, y + ((i + row) % 3) * 0.013, 0.075, 0.14);
      ctx.fillStyle = '#d9c39480';
      ctx.fillRect(x + 0.015, y + 0.03, 0.045, 0.009);
    }
    ctx.fillStyle = '#9d7a4f';
    ctx.fillRect(-0.41, -0.15 + row * 0.2, 0.82, 0.035);
  }
  ctx.strokeStyle = '#bd9866';
  ctx.lineWidth = 0.02;
  ctx.strokeRect(-0.45, -0.39, 0.9, 0.74);
  ctx.fillStyle = '#b08b5c';
  ctx.fillRect(-0.45, -0.4, 0.9, 0.04);
}

export function drawScrollCase(ctx: DrawingContext, prop: Prop): void {
  ctx.rotate((Math.floor(prop.variation * 4) * Math.PI) / 2 + 0.2);
  ctx.fillStyle = '#16262b70';
  ctx.fillRect(-0.28, -0.32, 0.57, 0.68);
  ctx.fillStyle = '#806244';
  ctx.fillRect(-0.26, -0.34, 0.27, 0.62);
  ctx.fillStyle = '#b28b58';
  ctx.fillRect(-0.23, -0.31, 0.21, 0.56);
  ctx.fillStyle = '#c4ad79';
  ctx.fillRect(-0.26, -0.24, 0.27, 0.035);
  ctx.fillRect(-0.26, 0.15, 0.27, 0.035);
  ctx.strokeStyle = '#4c4133';
  ctx.lineWidth = 0.02;
  ctx.strokeRect(-0.26, -0.34, 0.27, 0.62);
  for (const [x, y] of [
    [0.12, -0.1],
    [0.27, 0.02],
  ] as const) {
    ctx.fillStyle = '#e1d3a4';
    ctx.fillRect(x - 0.055, y - 0.21, 0.11, 0.42);
    ctx.fillStyle = '#af9c70';
    ctx.beginPath();
    ctx.ellipse(x, y - 0.21, 0.055, 0.027, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8c5344';
    ctx.fillRect(x - 0.06, y - 0.02, 0.12, 0.035);
  }
}
