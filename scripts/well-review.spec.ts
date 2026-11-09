import { mkdirSync, writeFileSync } from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from 'vitest';
import { generateCourtyard } from '../src/app/engine/courtyard-generate';
import { renderMap } from '../src/app/rendering/render-map';
import { drawProp } from '../src/app/rendering/props';

test('reviews stone wells beside fountains/wagons and bounds the well sprite to its footprint', () => {
  mkdirSync('artifacts/well', { recursive: true });
  for (const seed of ['ivy-court', 'fallen-crown', 'sunny-court'])
    for (const [fountain, wagon] of [
      [false, false],
      [true, false],
      [true, true],
    ] as const) {
      const r = generateCourtyard({
        character: 'Overgrown',
        seed,
        density: 'Balanced',
        fountain,
        wagon,
        well: true,
      });
      if (!r.ok) throw new Error(`${seed}: ${r.error}`);
      const full = createCanvas(2560, 1920);
      renderMap(full.getContext('2d'), r.map, { grid: true, pixelsPerTile: 64 });
      writeFileSync(`artifacts/well/${seed}-${fountain}-${wagon}.png`, full.toBuffer('image/png'));
      const body = r.map.decoration.props.find((p) => p.kind === 'stone_well');
      if (!body) throw new Error('Missing well');
      const detail = createCanvas(512, 512);
      detail
        .getContext('2d')
        .drawImage(full, (body.x - 2) * 64, (body.y - 2) * 64, 512, 512, 0, 0, 512, 512);
      writeFileSync(
        `artifacts/well/${seed}-${fountain}-${wagon}-detail.png`,
        detail.toBuffer('image/png'),
      );
    }
  const p = {
    x: 1,
    y: 1,
    kind: 'stone_well' as const,
    variation: 0.35,
    blocking: true,
    footprint: { width: 2, height: 2 },
    rotation: 0 as const,
  };
  const canvas = createCanvas(320, 320),
    ctx = canvas.getContext('2d');
  ctx.setTransform(64, 0, 0, 64, 0, 0);
  drawProp(ctx, p);
  const pixels = ctx.getImageData(0, 0, 320, 320).data;
  let count = 0;
  for (let y = 0; y < 320; y++)
    for (let x = 0; x < 320; x++)
      if (pixels[(y * 320 + x) * 4 + 3]) {
        count++;
        expect(x >= 64 && x < 3 * 64 && y >= 64 && y < 3 * 64).toBe(true);
      }
  expect(count).toBeGreaterThan(200);
});
