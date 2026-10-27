import { HEIGHT, WIDTH, indexOf } from '../engine/model';
import type { RuinedCourtyard } from '../engine/model';
import { Random, deriveSeed } from '../engine/random';
import type { DrawingContext } from './drawing-context';
import type { RenderOptions } from './render-options';
import { drawGrid, path } from './drawing-primitives';
import { drawProp } from './props';

function ground(ctx: DrawingContext, map: RuinedCourtyard): void {
  const b = map.layout.bounds;
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      const random = new Random(deriveSeed(map.surfaceSeed, x, y));
      const paved = x > b.x && y > b.y && x < b.x + b.width - 1 && y < b.y + b.height - 1;
      const patch = new Random(
        deriveSeed(map.surfaceSeed, 'patch', Math.floor(x / 4), Math.floor(y / 4)),
      ).int(-5, 5);
      const tone = random.int(-5, 5) + patch;
      ctx.fillStyle = `rgb(${78 + tone} ${102 + tone} ${60 + tone})`;
      ctx.fillRect(x, y, 1, 1);
      for (let i = 0; i < 9; i++) {
        const gx = x + random.next(),
          gy = y + random.next();
        ctx.strokeStyle = i % 2 ? '#b5c37c33' : '#304c3529';
        ctx.lineWidth = 0.018;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + 0.04, gy - 0.1);
        ctx.stroke();
      }
      if (!paved) continue;
      const missing = random.next() < 0.13;
      if (missing) {
        ctx.fillStyle = '#9caa6a28';
        ctx.fillRect(x + 0.1, y + 0.1, 0.8, 0.8);
        continue;
      }
      const chip = 0.03 + random.next() * 0.08;
      path(
        ctx,
        [
          [x + chip, y + 0.045],
          [x + 0.96, y + chip],
          [x + 0.96, y + 0.9],
          [x + 0.9, y + 0.96],
          [x + 0.04, y + 0.94],
        ],
        `rgb(${146 + tone} ${150 + tone} ${125 + tone})`,
        '#55654d60',
      );
      for (let fleck = 0; fleck < 12; fleck++) {
        ctx.fillStyle = fleck % 2 ? '#e1d8b126' : '#344f3424';
        ctx.fillRect(
          x + 0.1 + random.next() * 0.8,
          y + 0.1 + random.next() * 0.8,
          0.015 + random.next() * 0.035,
          0.012,
        );
      }
      ctx.strokeStyle = '#ddd7b232';
      ctx.lineWidth = 0.025;
      ctx.beginPath();
      ctx.moveTo(x + 0.09, y + 0.88);
      ctx.lineTo(x + 0.09, y + 0.1);
      ctx.lineTo(x + 0.86, y + 0.08);
      ctx.stroke();
      if (random.next() < 0.18) {
        ctx.strokeStyle = '#53614b77';
        ctx.lineWidth = 0.017;
        ctx.beginPath();
        ctx.moveTo(x + 0.05, y + 0.65);
        ctx.lineTo(x + 0.38, y + 0.5);
        ctx.lineTo(x + 0.43, y + 0.23);
        ctx.stroke();
      }
      if (random.next() < 0.25) {
        for (let leaf = 0; leaf < 7; leaf++) {
          ctx.fillStyle = leaf % 2 ? '#496b3e66' : '#78935455';
          ctx.beginPath();
          ctx.ellipse(
            x + 0.04 + random.next() * 0.1,
            y + 0.1 + random.next() * 0.8,
            0.04,
            0.07,
            random.next() * 3,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
    }
}

function walls(ctx: DrawingContext, map: RuinedCourtyard): void {
  const solid = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT && !map.layout.tiles[indexOf(x, y)];
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      if (!solid(x, y)) continue;
      ctx.fillStyle = '#28382a70';
      ctx.fillRect(x + 0.09, y + 0.12, 1.05, 1.08);
    }
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      if (!solid(x, y)) continue;
      const random = new Random(deriveSeed(map.surfaceSeed, 'wall', x, y));
      const tone = random.int(-6, 6);
      ctx.fillStyle = '#535e49';
      ctx.fillRect(x, y, 1, 1);
      const inset = 0.07;
      ctx.fillStyle = `rgb(${170 + tone} ${167 + tone} ${137 + tone})`;
      ctx.fillRect(x + inset, y + inset, 1 - inset * 2, 1 - inset * 2);
      ctx.strokeStyle = '#ded4ac';
      ctx.lineWidth = 0.04;
      ctx.beginPath();
      ctx.moveTo(x + 0.08, y + 0.9);
      ctx.lineTo(x + 0.08, y + 0.08);
      ctx.lineTo(x + 0.9, y + 0.08);
      ctx.stroke();
      ctx.strokeStyle = '#525d47';
      ctx.lineWidth = 0.035;
      const joint = 0.35 + random.next() * 0.3;
      ctx.beginPath();
      ctx.moveTo(x + joint, y + 0.07);
      ctx.lineTo(x + joint - 0.03, y + 0.48);
      ctx.lineTo(x + 0.92, y + 0.5);
      ctx.stroke();
      for (let fleck = 0; fleck < 9; fleck++) {
        ctx.fillStyle = fleck % 2 ? '#f0e0b332' : '#384e3435';
        ctx.fillRect(
          x + 0.12 + random.next() * 0.75,
          y + 0.12 + random.next() * 0.75,
          0.025,
          0.015,
        );
      }
      if (random.next() < 0.65) {
        ctx.fillStyle = '#55704580';
        ctx.beginPath();
        ctx.ellipse(x + 0.2, y + 0.8, 0.15, 0.07, -0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      // Broken ends expose darker fractured stone, while the occupied tile stays legible.
      if ((!solid(x - 1, y) && !solid(x + 1, y)) || (!solid(x, y - 1) && !solid(x, y + 1))) {
        path(
          ctx,
          [
            [x + 0.65, y + 0.8],
            [x + 0.9, y + 0.65],
            [x + 0.85, y + 0.9],
          ],
          '#717b5d',
        );
      }
    }
}

export function renderCourtyard(
  ctx: DrawingContext,
  map: RuinedCourtyard,
  options: RenderOptions,
): void {
  ctx.save();
  ctx.setTransform(options.pixelsPerTile, 0, 0, options.pixelsPerTile, 0, 0);
  ground(ctx, map);
  for (const prop of map.decoration.props.filter((p) => !p.blocking)) drawProp(ctx, prop);
  walls(ctx, map);
  for (const prop of map.decoration.props.filter((p) => p.blocking)) drawProp(ctx, prop);
  if (options.grid) drawGrid(ctx, '#233b2b30', options.gridOpacity);
  ctx.restore();
}
