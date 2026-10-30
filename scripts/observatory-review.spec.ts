import { mkdirSync, writeFileSync } from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from 'vitest';
import { generateTower, TOWER_STAIR_STYLES } from '../src/app/engine/tower';
import { renderMap } from '../src/app/rendering/render-map';
import { drawProp } from '../src/app/rendering/props';
test('reviews both observatory styles and ensures complete instrument sprites stay inside one square', () => {
  mkdirSync('artifacts/observatory', { recursive: true });
  for (const stairStyle of TOWER_STAIR_STYLES) {
    const r = generateTower({
      seed: 'astral-watch',
      floorCount: 4,
      portalFloor: null,
      density: 'Balanced',
      stairStyle,
      laboratoryFloor: 2,
      observatoryFloor: 4,
    });
    if (!r.ok) throw new Error(r.error);
    const map = r.map,
      canvas = createCanvas(map.layout.width * 64, map.layout.height * 64);
    renderMap(canvas.getContext('2d'), map, { grid: true, pixelsPerTile: 64 });
    writeFileSync(`artifacts/observatory/${stairStyle}.png`, canvas.toBuffer('image/png'));
    const f = map.layout.floors[3];
    if (!f) throw new Error('Missing floor');
    const detail = createCanvas(896, 832);
    detail.getContext('2d').drawImage(canvas, f.x * 64, f.y * 64, 896, 832, 0, 0, 896, 832);
    writeFileSync(`artifacts/observatory/${stairStyle}-detail.png`, detail.toBuffer('image/png'));
  }
  for (const kind of [
    'telescope',
    'star_chart_table',
    'instrument_cabinet',
    'star_charts',
  ] as const) {
    const canvas = createCanvas(192, 192),
      ctx = canvas.getContext('2d');
    ctx.setTransform(64, 0, 0, 64, 0, 0);
    drawProp(ctx, { kind, x: 1, y: 1, variation: 0.25, blocking: kind !== 'star_charts' });
    const pixels = ctx.getImageData(0, 0, 192, 192).data;
    let count = 0;
    for (let y = 0; y < 192; y++)
      for (let x = 0; x < 192; x++)
        if (pixels[(y * 192 + x) * 4 + 3]) {
          count++;
          expect(x >= 64 && x < 128 && y >= 64 && y < 128).toBe(true);
        }
    expect(count).toBeGreaterThan(300);
  }
});
