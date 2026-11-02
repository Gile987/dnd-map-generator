import type { Prop } from '../engine/model';
import type { DrawingContext } from './drawing-context';
import type { ForestPalette } from './forest-palette';

function ellipse(ctx: DrawingContext, x: number, y: number, rx: number, ry: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawFallenTrunk(ctx: DrawingContext, prop: Prop, forest: ForestPalette): void {
  const wood = forest.log,
    theme = forest.trees(prop.variation);
  ellipse(ctx, 0.02, 0.09, 1.94, 0.34, '#10201b66');
  ctx.fillStyle = wood.base;
  ctx.beginPath();
  ctx.moveTo(-1.88, -0.27);
  ctx.quadraticCurveTo(-0.45, -0.4, 1.45, -0.27);
  ctx.lineTo(1.85, -0.12);
  ctx.lineTo(1.64, -0.02);
  ctx.lineTo(1.91, 0.12);
  ctx.lineTo(1.55, 0.27);
  ctx.quadraticCurveTo(-0.5, 0.34, -1.88, 0.26);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = wood.grain;
  ctx.lineWidth = 0.035;
  for (const y of [-0.2, -0.08, 0.06, 0.18]) {
    ctx.beginPath();
    ctx.moveTo(-1.78, y);
    ctx.quadraticCurveTo(-0.4, y - 0.07, 1.52, y + 0.02);
    ctx.stroke();
  }
  ctx.strokeStyle = wood.edge;
  ctx.lineWidth = 0.045;
  ctx.beginPath();
  ctx.moveTo(-1.75, 0.25);
  ctx.quadraticCurveTo(-0.4, 0.33, 1.48, 0.26);
  ctx.stroke();
  ellipse(ctx, -1.8, 0, 0.12, 0.27, wood.end);
  ctx.strokeStyle = wood.endRing;
  ctx.lineWidth = 0.018;
  ctx.beginPath();
  ctx.ellipse(-1.8, 0, 0.075, 0.2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = wood.rings;
  ctx.beginPath();
  ctx.moveTo(1.45, -0.25);
  ctx.lineTo(1.84, -0.12);
  ctx.lineTo(1.63, -0.02);
  ctx.lineTo(1.88, 0.12);
  ctx.lineTo(1.5, 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = wood.base;
  ctx.lineWidth = 0.025;
  ctx.beginPath();
  ctx.moveTo(1.48, -0.13);
  ctx.lineTo(1.73, -0.09);
  ctx.moveTo(1.5, 0.1);
  ctx.lineTo(1.72, 0.12);
  ctx.stroke();
  for (const [x, y] of [
    [-0.95, -0.25],
    [0.55, 0.24],
  ] as const) {
    ctx.strokeStyle = wood.base;
    ctx.lineWidth = 0.11;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 0.15, y * 1.6);
    ctx.stroke();
    ellipse(ctx, x + 0.15, y * 1.6, 0.055, 0.025, wood.end);
  }
  // Moss, autumn foliage, pine growth and pale Fey accents come from the existing character palette.
  for (const [x, y] of [
    [-1.25, -0.18],
    [-0.48, 0.13],
    [0.25, -0.16],
  ] as const) {
    ellipse(ctx, x, y, 0.21, 0.07, theme.canopyDark);
    ellipse(ctx, x - 0.04, y - 0.015, 0.13, 0.04, theme.canopyMid);
    if (forest.mushroomGlow) ellipse(ctx, x + 0.11, y - 0.02, 0.035, 0.035, forest.flowerPetals[0]);
  }
}

export function drawFallenRoots(ctx: DrawingContext, prop: Prop, forest: ForestPalette): void {
  ellipse(ctx, 0.02, 0.08, 0.43, 0.33, '#10201b55');
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const a = (i * Math.PI * 2) / 7;
    ctx.strokeStyle = forest.stump.bark;
    ctx.lineWidth = 0.065;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(
      Math.cos(a + 0.3) * 0.28,
      Math.sin(a + 0.3) * 0.28,
      Math.cos(a) * 0.42,
      Math.sin(a) * 0.42,
    );
    ctx.stroke();
    ctx.strokeStyle = forest.log.grain;
    ctx.lineWidth = 0.018;
    ctx.stroke();
  }
  ellipse(ctx, 0, 0, 0.22, 0.2, forest.stump.bark);
  ellipse(ctx, -0.025, -0.03, 0.16, 0.14, forest.stump.top);
  ctx.strokeStyle = forest.stump.ring;
  ctx.lineWidth = 0.018;
  ctx.beginPath();
  ctx.ellipse(-0.025, -0.03, 0.1, 0.08, 0, 0, Math.PI * 2);
  ctx.stroke();
  ellipse(ctx, 0.13, 0.14, 0.1, 0.06, forest.trees(prop.variation).canopyMid);
}

export function drawFallenBranch(ctx: DrawingContext, prop: Prop, forest: ForestPalette): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = forest.log.base;
  ctx.lineWidth = 0.07;
  ctx.beginPath();
  ctx.moveTo(-0.36, 0.29);
  ctx.lineTo(0.24, -0.3);
  ctx.moveTo(-0.01, -0.01);
  ctx.lineTo(-0.22, -0.29);
  ctx.moveTo(0.08, -0.1);
  ctx.lineTo(0.35, -0.09);
  ctx.stroke();
  ctx.strokeStyle = forest.log.end;
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  ctx.moveTo(-0.32, 0.27);
  ctx.lineTo(0.17, -0.22);
  ctx.stroke();
  const theme = forest.trees(prop.variation);
  for (const [x, y] of [
    [0.24, -0.28],
    [-0.21, -0.27],
    [0.34, -0.08],
  ] as const)
    ellipse(ctx, x, y, theme.variant === 'pine' ? 0.09 : 0.07, 0.035, theme.canopyMid);
}

export function drawFallenFungi(ctx: DrawingContext, _prop: Prop, forest: ForestPalette): void {
  for (const [i, x, y] of [
    [0, -0.23, 0.11],
    [1, 0.02, -0.14],
    [2, 0.25, 0.13],
  ] as const) {
    if (forest.mushroomGlow) ellipse(ctx, x, y, 0.17, 0.17, forest.mushroomGlow);
    ctx.strokeStyle = forest.mushroomStem;
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.moveTo(x, y + 0.14);
    ctx.lineTo(x, y);
    ctx.stroke();
    ellipse(ctx, x, y, 0.115, 0.085, forest.mushroomCaps[i]);
    ellipse(ctx, x - 0.025, y - 0.02, 0.025, 0.017, forest.mushroomStem);
  }
}
