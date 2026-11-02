import { createHash } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from 'vitest';
import { generateCourtyard, shuffleCourtyardDetails } from '../engine/courtyard-generate';
import { renderMap } from './render-map';

// Captured before the wagon implementation, independently of the new decoration path.
test('courtyard models, shuffles and pixels without a wagon retain their committed baseline', () => {
  const models: unknown[] = [],
    pixels = createHash('sha256');
  for (const seed of ['ivy-court', 'fallen-crown', 'sunken-abbey'])
    for (const density of ['Sparse', 'Balanced', 'Cluttered'] as const)
      for (const fountain of [false, true]) {
        const r = generateCourtyard({ seed, density, fountain });
        if (!r.ok) throw new Error(r.error);
        models.push(r.map, shuffleCourtyardDetails(r.map));
        const c = createCanvas(1280, 960);
        renderMap(c.getContext('2d'), r.map, { grid: true, pixelsPerTile: 32 });
        pixels.update(c.getContext('2d').getImageData(0, 0, c.width, c.height).data);
      }
  expect(createHash('sha256').update(JSON.stringify(models)).digest('hex')).toBe(
    '913401fdf9faa3d53205dfde897f4d2bb0b013c68689d834edc4cdb2ee2af917',
  );
  expect(pixels.digest('hex')).toBe(
    'd08ab4235d93635956abfe1f220bbbff09af8876cb14bb0e317b27dcc283b0e6',
  );
});
