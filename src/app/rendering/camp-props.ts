import type { Prop } from '../engine/model';
import type { DrawingContext } from './drawing-context';

export function drawTent(ctx: DrawingContext, prop: Prop): void {
  ctx.rotate(prop.variation < 0.5 ? -Math.PI / 2 : Math.PI / 2);
  ctx.fillStyle = '#17201665';
  ctx.fillRect(-0.36, -0.32, 0.77, 0.76);
  ctx.strokeStyle = '#c9b98c';
  ctx.lineWidth = 0.012;
  for (const x of [-0.44, 0.44]) {
    for (const y of [-0.43, 0.43]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x * 0.68, y * 0.76);
      ctx.stroke();
      ctx.fillStyle = '#554535';
      ctx.fillRect(x - 0.015, y - 0.025, 0.03, 0.05);
    }
  }
  ctx.fillStyle = '#a48a55';
  ctx.fillRect(-0.33, -0.36, 0.66, 0.72);
  ctx.fillStyle = '#d6bd7d';
  ctx.beginPath();
  ctx.moveTo(0, -0.38);
  ctx.lineTo(-0.33, -0.28);
  ctx.lineTo(-0.33, 0.35);
  ctx.lineTo(0, 0.27);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#b39a61';
  ctx.beginPath();
  ctx.moveTo(0, -0.38);
  ctx.lineTo(0.33, -0.28);
  ctx.lineTo(0.33, 0.35);
  ctx.lineTo(0, 0.27);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#eee0b8';
  ctx.lineWidth = 0.018;
  ctx.beginPath();
  ctx.moveTo(0, -0.38);
  ctx.lineTo(0, 0.27);
  ctx.stroke();
  ctx.fillStyle = '#302c24';
  ctx.beginPath();
  ctx.moveTo(0, 0.02);
  ctx.lineTo(-0.16, 0.35);
  ctx.lineTo(0.16, 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#796440';
  ctx.lineWidth = 0.015;
  ctx.strokeRect(-0.33, -0.36, 0.66, 0.72);
  ctx.strokeStyle = '#806c45';
  for (const y of [-0.2, -0.02]) {
    ctx.beginPath();
    ctx.moveTo(-0.31, y + 0.06);
    ctx.lineTo(-0.02, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0.02, y);
    ctx.lineTo(0.31, y + 0.06);
    ctx.stroke();
  }
  ctx.fillStyle = '#61523c';
  ctx.fillRect(-0.025, -0.42, 0.05, 0.07);
}

export function drawBedroll(ctx: DrawingContext, prop: Prop): void {
  ctx.rotate((prop.variation - 0.5) * 0.25);
  ctx.fillStyle = '#10201555';
  ctx.fillRect(-0.23, -0.37, 0.5, 0.8);
  ctx.fillStyle = '#4a5147';
  ctx.fillRect(-0.23, -0.4, 0.46, 0.8);
  ctx.fillStyle = prop.variation > 0.5 ? '#777862' : '#687b78';
  ctx.fillRect(-0.2, -0.21, 0.4, 0.56);
  ctx.fillStyle = '#b5ab8e';
  ctx.fillRect(-0.18, -0.35, 0.36, 0.13);
  ctx.fillStyle = '#4c5d59';
  ctx.fillRect(-0.2, 0.21, 0.4, 0.07);
  ctx.strokeStyle = '#b3b69b';
  ctx.lineWidth = 0.015;
  ctx.beginPath();
  ctx.moveTo(-0.16, -0.15);
  ctx.lineTo(-0.16, 0.32);
  ctx.stroke();
  ctx.strokeStyle = '#353e37';
  ctx.strokeRect(-0.23, -0.4, 0.46, 0.8);
}

export function drawFireRing(ctx: DrawingContext, prop: Prop): void {
  ctx.fillStyle = '#25302550';
  ctx.beginPath();
  ctx.ellipse(0.02, 0.04, 0.45, 0.43, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#726b58';
  ctx.beginPath();
  ctx.arc(0, 0, 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3c3a30';
  ctx.beginPath();
  ctx.arc(0, 0, 0.24, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 + prop.variation;
    const x = Math.cos(angle) * 0.33,
      y = Math.sin(angle) * 0.33;
    ctx.fillStyle = i % 2 ? '#989685' : '#787e70';
    ctx.beginPath();
    ctx.ellipse(x, y, 0.09, 0.065, angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4b5146';
    ctx.lineWidth = 0.012;
    ctx.stroke();
  }
  ctx.rotate(0.5);
  ctx.fillStyle = '#262923';
  ctx.fillRect(-0.2, -0.045, 0.4, 0.09);
  ctx.rotate(1.4);
  ctx.fillRect(-0.17, -0.04, 0.34, 0.08);
  ctx.fillStyle = '#a59b80';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(((i % 3) - 1) * 0.09, (Math.floor(i / 3) - 0.5) * 0.13, 0.018, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawSupplyBundle(ctx: DrawingContext, prop: Prop): void {
  ctx.rotate((prop.variation - 0.5) * 0.4);
  ctx.fillStyle = '#14221660';
  ctx.fillRect(-0.31, -0.24, 0.65, 0.58);
  ctx.fillStyle = '#83623e';
  ctx.fillRect(-0.32, -0.28, 0.64, 0.54);
  ctx.fillStyle = '#b49b6c';
  ctx.fillRect(-0.28, -0.24, 0.56, 0.46);
  ctx.fillStyle = '#977c50';
  ctx.fillRect(-0.28, 0.11, 0.56, 0.11);
  ctx.strokeStyle = '#dfcba0';
  ctx.lineWidth = 0.025;
  ctx.beginPath();
  ctx.moveTo(-0.1, -0.26);
  ctx.lineTo(-0.1, 0.24);
  ctx.moveTo(0.12, -0.26);
  ctx.lineTo(0.12, 0.24);
  ctx.moveTo(-0.3, -0.02);
  ctx.lineTo(0.3, -0.02);
  ctx.stroke();
  ctx.strokeStyle = '#58492f';
  ctx.lineWidth = 0.015;
  ctx.strokeRect(-0.32, -0.28, 0.64, 0.54);
}
