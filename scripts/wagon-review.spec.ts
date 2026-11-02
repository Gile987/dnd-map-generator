import { mkdirSync, writeFileSync } from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from 'vitest';
import { generateCourtyard } from '../src/app/engine/courtyard-generate';
import { renderMap } from '../src/app/rendering/render-map';
import { drawProp } from '../src/app/rendering/props';

test('reviews wagon scenes with and without fountains and bounds every sprite to its occupied footprint', () => {
  mkdirSync('artifacts/wagon', { recursive: true });
  for (const seed of ['ivy-court', 'fallen-crown', 'wagon-0'])
    for (const fountain of [false, true]) {
      const r = generateCourtyard({ seed, density: 'Balanced', fountain, wagon: true });
      if (!r.ok) throw new Error(`${seed}: ${r.error}`);
      const full = createCanvas(2560, 1920);
      renderMap(full.getContext('2d'), r.map, { grid: true, pixelsPerTile: 64 });
      writeFileSync(`artifacts/wagon/${seed}-${fountain}.png`, full.toBuffer('image/png'));
      const body = r.map.decoration.props.find((p) => p.kind === 'collapsed_wagon');
      if (!body) throw new Error('Missing wagon');
      const detail = createCanvas(576, 512);
      detail
        .getContext('2d')
        .drawImage(full, (body.x - 2) * 64, (body.y - 2) * 64, 576, 512, 0, 0, 576, 512);
      writeFileSync(`artifacts/wagon/${seed}-${fountain}-detail.png`, detail.toBuffer('image/png'));
    }
  for (const kind of ['collapsed_wagon', 'wagon_wheel', 'spilled_crate', 'spilled_goods'] as const)
    for (const rotation of kind === 'collapsed_wagon' ? ([0, 1, 2, 3] as const) : ([0] as const)) {
      const multi = kind === 'collapsed_wagon';
      const p = {
        x: 1,
        y: 1,
        kind,
        variation: 0.35,
        blocking: multi || kind === 'spilled_crate',
        ...(multi ? { footprint: { width: 3, height: 2 }, rotation } : {}),
      };
      const canvas = createCanvas(320, 320),
        ctx = canvas.getContext('2d');
      ctx.setTransform(64, 0, 0, 64, 0, 0);
      drawProp(ctx, p);
      const width = multi ? (rotation % 2 ? 2 : 3) : 1,
        height = multi ? (rotation % 2 ? 3 : 2) : 1;
      const pixels = ctx.getImageData(0, 0, 320, 320).data;
      let count = 0;
      for (let y = 0; y < 320; y++)
        for (let x = 0; x < 320; x++)
          if (pixels[(y * 320 + x) * 4 + 3]) {
            count++;
            expect(x >= 64 && x < (1 + width) * 64 && y >= 64 && y < (1 + height) * 64).toBe(true);
          }
      expect(count).toBeGreaterThan(200);
    }
});
