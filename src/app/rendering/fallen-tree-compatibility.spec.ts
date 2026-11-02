import { createHash } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from 'vitest';
import { generateForestClearing, shuffleForestDetails } from '../engine/forest-generate';
import { renderMap } from './render-map';
import { forestSurfacePatches } from './forest-surface';

// Literal independent hashes captured from the committed pre-addition generator and renderer.
test('Forest models, shuffles and pixels retain their pre-fallen-tree baseline across all characters', () => {
  const models: unknown[] = [],
    pixels = createHash('sha256');
  for (const character of ['Verdant', 'Autumn', 'Pines', 'Fey'] as const)
    for (const seed of ['woodland-glade', 'emerald-path'])
      for (const additions of [false, true]) {
        const r = generateForestClearing({
          seed,
          character,
          density: 'Balanced',
          ...(additions
            ? ({ scene: 'Abandoned camp', landmark: 'standing-stone-circle' } as const)
            : {}),
        });
        if (!r.ok) throw new Error(r.error);
        models.push(r.map, shuffleForestDetails(r.map));
        const canvas = createCanvas(1280, 960),
          ctx = canvas.getContext('2d');
        renderMap(ctx, r.map, { grid: true, pixelsPerTile: 32 });
        pixels.update(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
      }
  expect(createHash('sha256').update(JSON.stringify(models)).digest('hex')).toBe(
    'b72e7cc9fbfa8d0712c08d3b1db8f8996ed646c8a555d559c54d86fd61696ee6',
  );
  expect(pixels.digest('hex')).toBe(
    '546c4752935097a268b6e6032eed1dbfb3dc0e9008a554722a256b7d4a2b0c6a',
  );
});
test('surface patches avoid every square of a rotated fallen trunk', () => {
  const covered = new Set<number>();
  for (let n = 0; n < 10; n++) {
    const r = generateForestClearing({
      seed: `fallen-${n}`,
      character: 'Verdant',
      density: 'Balanced',
      fallenTree: true,
    });
    if (!r.ok) throw new Error(r.error);
    const p = r.map.decoration.props.find((p) => p.kind === 'fallen_trunk');
    if (!p) throw new Error('Missing trunk');
    covered.add(p.rotation ?? 0);
    const width = (p.rotation ?? 0) % 2 ? 1 : 4,
      height = (p.rotation ?? 0) % 2 ? 4 : 1;
    for (const patch of forestSurfacePatches(r.map))
      expect(
        Math.floor(patch.x) >= p.x &&
          Math.floor(patch.x) < p.x + width &&
          Math.floor(patch.y) >= p.y &&
          Math.floor(patch.y) < p.y + height,
      ).toBe(false);
  }
  expect(covered).toEqual(new Set([0, 1]));
});
