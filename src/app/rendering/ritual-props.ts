import type { DecorationPreset, Dungeon, Prop } from '../engine/model';
import { ritualCenter } from '../engine/dungeon-ritual';
import type { DrawingContext } from './drawing-context';
import { path } from './drawing-primitives';

export function drawRitualAltar(ctx: DrawingContext, prop: Prop): void {
  ctx.rotate((Math.floor(prop.variation * 4) * Math.PI) / 2);
  ctx.fillStyle = '#13222985';
  ctx.beginPath();
  ctx.ellipse(0.03, 0.12, 0.43, 0.29, 0, 0, Math.PI * 2);
  ctx.fill();
  path(
    ctx,
    [
      [-0.31, -0.23],
      [0.31, -0.23],
      [0.34, 0.32],
      [-0.34, 0.32],
    ],
    '#46555a',
    '#82918a',
  );
  ctx.fillStyle = '#687675';
  ctx.fillRect(-0.27, -0.2, 0.54, 0.46);
  path(
    ctx,
    [
      [-0.4, -0.28],
      [0.35, -0.28],
      [0.41, -0.21],
      [0.4, 0.16],
      [-0.36, 0.2],
      [-0.41, 0.12],
    ],
    '#a1aaa0',
    '#c0c2a8',
  );
  ctx.strokeStyle = '#5a6d6a';
  ctx.lineWidth = 0.018;
  ctx.strokeRect(-0.31, -0.2, 0.61, 0.31);
  ctx.beginPath();
  ctx.moveTo(0.32, -0.24);
  ctx.lineTo(0.22, -0.14);
  ctx.lineTo(0.27, -0.07);
  ctx.stroke();
  ctx.strokeStyle = '#c8b37a';
  ctx.lineWidth = 0.022;
  ctx.beginPath();
  ctx.arc(0, -0.045, 0.105, 0.15, Math.PI * 1.85);
  ctx.stroke();
  path(
    ctx,
    [
      [0, -0.12],
      [0.055, -0.045],
      [0, 0.025],
      [-0.055, -0.045],
    ],
    '#7d8c83',
    '#c8b37a',
  );
  ctx.fillStyle = '#69534c';
  ctx.fillRect(-0.17, 0.17, 0.34, 0.09);
  ctx.strokeStyle = '#9e8b6c';
  ctx.lineWidth = 0.013;
  ctx.beginPath();
  ctx.moveTo(-0.12, 0.21);
  ctx.lineTo(0.12, 0.21);
  ctx.stroke();
}

export function drawRitualCandles(ctx: DrawingContext, prop: Prop): void {
  const angle = (Math.floor(prop.variation * 4) * Math.PI) / 2;
  ctx.rotate(angle);
  for (const [x, y, radius] of [
    [-0.17, 0.05, 0.075],
    [0.06, 0.15, 0.06],
    [0.17, -0.12, 0.08],
  ] as const) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-angle);
    ctx.fillStyle = '#c0a77545';
    ctx.beginPath();
    ctx.ellipse(0, 0.025, radius + 0.055, radius + 0.025, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#182b2c60';
    ctx.beginPath();
    ctx.ellipse(0.035, 0.04, radius + 0.015, radius, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a38b60';
    ctx.beginPath();
    ctx.ellipse(0, 0.015, radius, radius * 0.88, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e3d5a8';
    ctx.beginPath();
    ctx.ellipse(0, -0.025, radius, radius * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#baa875';
    ctx.beginPath();
    ctx.ellipse(0, -0.025, radius * 0.58, radius * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f0dfb0';
    ctx.fillRect(radius * 0.6, -0.02, 0.02, 0.055);
    ctx.strokeStyle = '#5c4933';
    ctx.lineWidth = 0.012;
    ctx.beginPath();
    ctx.moveTo(0, -0.025);
    ctx.lineTo(0, -0.055);
    ctx.stroke();
    ctx.fillStyle = '#ecad58';
    ctx.beginPath();
    ctx.ellipse(0, -0.09, 0.035, 0.065, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff0bd';
    ctx.beginPath();
    ctx.ellipse(0, -0.075, 0.016, 0.038, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawRitualOffering(ctx: DrawingContext, prop: Prop): void {
  ctx.rotate((Math.floor(prop.variation * 4) * Math.PI) / 2 + ((prop.variation % 0.25) - 0.1));
  path(
    ctx,
    [
      [-0.29, 0.02],
      [-0.02, -0.05],
      [0.2, 0.2],
      [-0.08, 0.3],
    ],
    '#725456',
    '#a37f6b',
  );
  ctx.fillStyle = '#25332e90';
  ctx.beginPath();
  ctx.ellipse(0.07, -0.04, 0.24, 0.19, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#aa8d53';
  ctx.beginPath();
  ctx.ellipse(0.04, -0.08, 0.225, 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5b5841';
  ctx.beginPath();
  ctx.ellipse(0.04, -0.1, 0.18, 0.135, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const [x, y] of [
    [-0.05, -0.12],
    [0.07, -0.03],
    [0.13, -0.15],
  ] as const) {
    ctx.fillStyle = '#b6b391';
    ctx.beginPath();
    ctx.ellipse(x, y, 0.05, 0.035, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#8e9c75';
  ctx.lineWidth = 0.018;
  ctx.beginPath();
  ctx.moveTo(-0.16, 0.16);
  ctx.lineTo(0.1, 0.1);
  ctx.moveTo(-0.06, 0.14);
  ctx.lineTo(-0.1, 0.07);
  ctx.moveTo(0.01, 0.12);
  ctx.lineTo(0.04, 0.19);
  ctx.stroke();
}

const chalk: Readonly<Record<DecorationPreset, string>> = {
  Mosslit: '#bad1b55c',
  Crypt: '#b2c6c75c',
  Storehouse: '#d3c79d5c',
  Sanctuary: '#c5d9b65c',
};

export function drawRitualFloor(
  ctx: DrawingContext,
  props: readonly Prop[],
  preset: DecorationPreset,
): void {
  const altar = props.find((p) => p.kind === 'ritual_altar');
  if (!altar) return;
  const center = ritualCenter(altar);
  ctx.save();
  ctx.translate(center.x + 0.5, center.y + 0.5);
  ctx.rotate((Math.floor(altar.variation * 4) * Math.PI) / 2);
  ctx.strokeStyle = chalk[preset];
  ctx.lineWidth = 0.025;
  for (const radius of [1.08, 1.27]) {
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.arc(0, 0, radius, angle + 0.055, angle + Math.PI / 4 - 0.075);
      ctx.stroke();
    }
  }
  ctx.lineWidth = 0.018;
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 4);
    ctx.beginPath();
    ctx.moveTo(-0.06, 1.36);
    ctx.lineTo(0, 1.47);
    ctx.lineTo(0.06, 1.36);
    ctx.moveTo(0, 1.4);
    ctx.lineTo(0, 1.29);
    ctx.stroke();
    ctx.restore();
  }
  ctx.lineWidth = 0.012;
  ctx.beginPath();
  ctx.moveTo(-0.26, 0);
  ctx.lineTo(0, -0.32);
  ctx.lineTo(0.26, 0);
  ctx.lineTo(0, 0.32);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
  for (const candle of props.filter((p) => p.kind === 'ritual_candles')) {
    const x = candle.x + 0.5,
      y = candle.y + 0.5;
    const halo = ctx.createRadialGradient(x, y, 0.04, x, y, 0.85);
    halo.addColorStop(0, '#f4ce7935');
    halo.addColorStop(0.45, '#f4be6416');
    halo.addColorStop(1, '#f4be6400');
    ctx.fillStyle = halo;
    ctx.fillRect(x - 0.85, y - 0.85, 1.7, 1.7);
  }
}

export function drawDungeonRitualFloor(ctx: DrawingContext, map: Dungeon): void {
  if (map.decoration.ritual) drawRitualFloor(ctx, map.decoration.props, map.decoration.preset);
}
