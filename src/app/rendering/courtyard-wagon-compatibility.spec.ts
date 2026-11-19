import { createHash } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from 'vitest';
import { generateCourtyard, shuffleCourtyardDetails } from '../engine/courtyard-generate';
import { renderMap } from './render-map';

// Captured for courtyard generator 5.0.0, when spawned braziers became part
// of ordinary decoration. Earlier baselines protected the pre-brazier artwork;
// the frozen fixtures and this replacement row now carry that protection.
test('courtyard models, shuffles and pixels without a wagon retain their committed baseline', () => {
  const models: unknown[] = [],
    pixels = createHash('sha256');
  for (const seed of ['ivy-court', 'fallen-crown', 'sunken-abbey'])
    for (const density of ['Sparse', 'Balanced', 'Cluttered'] as const)
      for (const fountain of [false, true]) {
        const r = generateCourtyard({ character: 'Overgrown', seed, density, fountain });
        if (!r.ok) throw new Error(r.error);
        models.push(r.map, shuffleCourtyardDetails(r.map));
        const c = createCanvas(1280, 960);
        renderMap(c.getContext('2d'), r.map, { grid: true, pixelsPerTile: 32 });
        pixels.update(c.getContext('2d').getImageData(0, 0, c.width, c.height).data);
      }
  expect(createHash('sha256').update(JSON.stringify(models)).digest('hex')).toBe(
    'dd1f5a0bc45070165769fee25d104524e51882ab4743ce645ce81ceff183f9d7',
  );
  expect(pixels.digest('hex')).toBe(
    'a9816acf0e9b324f3d6810697ed4f66917cfcfbb5c7f72d63d8e6b01be9039fb',
  );
});
