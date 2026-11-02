import { createCanvas } from '@napi-rs/canvas';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { generateForestClearing } from '../src/app/engine/forest-generate';
import { ALL_FOREST_CHARACTERS } from '../src/app/engine/model';
import { FOREST_PALETTES } from '../src/app/rendering/forest-palette';
import { renderMap } from '../src/app/rendering/render-map';
import { drawProp } from '../src/app/rendering/props';

test('reviews each character and bounds complete fallen-tree sprites to their footprints', () => {
  mkdirSync('artifacts/fallen-tree', { recursive: true });
  const palettePixels = new Set<string>();
  for (const character of ALL_FOREST_CHARACTERS) {
    const r = generateForestClearing({
      seed: 'woodland-glade',
      character,
      density: 'Balanced',
      fallenTree: true,
      scene: 'Abandoned camp',
      landmark: 'standing-stone-circle',
    });
    if (!r.ok) throw new Error(`${character}: ${r.error}`);
    const canvas = createCanvas(2560, 1920);
    renderMap(canvas.getContext('2d'), r.map, { grid: true, pixelsPerTile: 64 });
    writeFileSync(`artifacts/fallen-tree/${character}.png`, canvas.toBuffer('image/png'));
    const p = r.map.decoration.props.find((p) => p.kind === 'fallen_trunk');
    if (!p) throw new Error('Missing trunk');
    const detail = createCanvas(576, 576);
    detail
      .getContext('2d')
      .drawImage(canvas, (p.x - 2) * 64, (p.y - 2) * 64, 576, 576, 0, 0, 576, 576);
    writeFileSync(`artifacts/fallen-tree/${character}-detail.png`, detail.toBuffer('image/png'));
    for (const kind of ['fallen_trunk', 'fallen_roots', 'fallen_branch', 'fallen_fungi'] as const)
      for (const rotation of kind === 'fallen_trunk' ? ([0, 1, 2, 3] as const) : ([0] as const)) {
        const multi = kind === 'fallen_trunk',
          sprite = createCanvas(384, 384),
          ctx = sprite.getContext('2d');
        ctx.setTransform(64, 0, 0, 64, 0, 0);
        drawProp(
          ctx,
          {
            kind,
            x: 1,
            y: 1,
            variation: 0.4,
            blocking: multi || kind === 'fallen_roots',
            ...(multi ? { footprint: { width: 4, height: 1 }, rotation } : {}),
          },
          FOREST_PALETTES[character],
        );
        const data = ctx.getImageData(0, 0, 384, 384).data,
          width = multi ? (rotation % 2 ? 1 : 4) : 1,
          height = multi ? (rotation % 2 ? 4 : 1) : 1;
        let count = 0,
          outside = false;
        for (let y = 0; y < 384; y++)
          for (let x = 0; x < 384; x++)
            if (data[(y * 384 + x) * 4 + 3]) {
              count++;
              if (x < 64 || x >= (1 + width) * 64 || y < 64 || y >= (1 + height) * 64)
                outside = true;
            }
        expect(outside).toBe(false);
        expect(count).toBeGreaterThan(100);
        if (multi && rotation === 0)
          palettePixels.add(createHash('sha256').update(data).digest('hex'));
      }
  }
  expect(palettePixels.size).toBe(4);
});
