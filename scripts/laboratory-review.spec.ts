import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { generateTower, TOWER_STAIR_STYLES } from '../src/app/engine/tower';
import { renderMap } from '../src/app/rendering/render-map';
import { drawProp } from '../src/app/rendering/props';

test('reviews both laboratory styles and checks the cauldron artwork stays inside its tile', () => {
  mkdirSync('artifacts/laboratory', { recursive: true });
  for (const stairStyle of TOWER_STAIR_STYLES) {
    const r = generateTower({
      seed: 'astral-watch',
      floorCount: 4,
      portalFloor: null,
      density: 'Balanced',
      stairStyle,
      laboratoryFloor: 2,
    });
    if (!r.ok) throw new Error(r.error);
    const map = r.map,
      canvas = createCanvas(map.layout.width * 32, map.layout.height * 32);
    renderMap(canvas.getContext('2d'), map, { grid: true, pixelsPerTile: 32 });
    writeFileSync(`artifacts/laboratory/${stairStyle}.png`, canvas.toBuffer('image/png'));
    const floor = map.layout.floors.find((f) => f.number === 2);
    if (!floor) throw new Error('Missing floor');
    const detail = createCanvas(672, 624),
      full = createCanvas(map.layout.width * 64, map.layout.height * 64);
    renderMap(full.getContext('2d'), map, { grid: true, pixelsPerTile: 64 });
    detail
      .getContext('2d')
      .drawImage(full, floor.x * 64, floor.y * 64, 14 * 64, 13 * 64, 0, 0, 672, 624);
    writeFileSync(`artifacts/laboratory/${stairStyle}-detail.png`, detail.toBuffer('image/png'));
  }
  const canvas = createCanvas(192, 192),
    ctx = canvas.getContext('2d');
  ctx.setTransform(64, 0, 0, 64, 0, 0);
  drawProp(ctx, { kind: 'cauldron', x: 1, y: 1, variation: 0.25, blocking: true });
  const pixels = ctx.getImageData(0, 0, 192, 192).data;
  let count = 0;
  for (let y = 0; y < 192; y++)
    for (let x = 0; x < 192; x++)
      if (pixels[(y * 192 + x) * 4 + 3]) {
        count++;
        expect(x >= 64 && x < 128 && y >= 64 && y < 128).toBe(true);
      }
  expect(count).toBeGreaterThan(200);
});
