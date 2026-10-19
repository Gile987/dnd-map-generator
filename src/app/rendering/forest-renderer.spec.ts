import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, test } from 'vitest';
import { changeForestCharacter, generateForestClearing } from '../engine/forest-generate';
import { ALL_FOREST_CHARACTERS } from '../engine/model';
import type { ForestClearing, ForestSettings } from '../engine/model';
import { renderForest } from './forest-renderer';
import { EXPORT_HEIGHT, EXPORT_WIDTH, PIXELS_PER_TILE } from './resolution';
import { parseBundle } from '../save/save-format';

function exportPng(map: ForestClearing, grid: boolean): Buffer {
  const canvas = createCanvas(EXPORT_WIDTH, EXPORT_HEIGHT);
  renderForest(canvas.getContext('2d'), map, { grid, pixelsPerTile: PIXELS_PER_TILE });
  return canvas.toBuffer('image/png');
}

function generatedForest(settings: ForestSettings): ForestClearing {
  const result = generateForestClearing(settings);
  if (!result.ok) throw new Error(`${settings.seed}: ${result.error}`);
  return result.map;
}

describe('forest renderer determinism', () => {
  test.each([
    ['emerald-path', true, '7d596bccb348c2700a419d9932a325261c7cf60eda8b62003877c6d572557b2d'],
    ['emerald-path', false, '64dd5ab9723e0103611194ead457745edf1b8a867c73db9ac7ee15f65c3d3fa0'],
    ['woodland-glade', true, 'e9a46a586082ef11f2e99c33745fcd231ab78111ca79a04dfd170068dfeedb5e'],
    ['woodland-glade', false, '4da5779841658939c8032b308337c7e205df61132c7270bdf78dd53a9cf4b8ca'],
    ['ancient-grove', true, '548fac580ed464d83c02df04734071e0a178ef554b1721577b2f6f410dcfecad'],
    ['ancient-grove', false, '72bd4347f70f34475a513c9702222943ee689e987506631663729098fe71f742'],
  ] as const)('preserves v3 artwork for %s with grid=%s', (seed, grid, expected) => {
    const parsed = parseBundle(
      readFileSync(new URL('../save/fixtures/forest-v3.json', import.meta.url), 'utf8'),
    );
    if (!parsed.ok) throw new Error(parsed.error);
    const map = parsed.maps.find((entry) => entry.map.seed === seed)?.map;
    if (!map || map.type !== 'forest') throw new Error(`Legacy forest ${seed} is missing`);
    const canvas = createCanvas(EXPORT_WIDTH, EXPORT_HEIGHT);
    const ctx = canvas.getContext('2d');
    renderForest(ctx, map, { grid, pixelsPerTile: PIXELS_PER_TILE });
    const pixels = ctx.getImageData(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT).data;
    expect(createHash('sha256').update(pixels).digest('hex')).toBe(expected);
  });

  test.each([
    [
      'woodland-glade',
      generatedForest({ seed: 'woodland-glade', density: 'Balanced', character: 'Verdant' }),
    ],
    [
      'emerald-path',
      generatedForest({ seed: 'emerald-path', density: 'Sparse', character: 'Verdant' }),
    ],
    [
      'ancient-grove',
      generatedForest({ seed: 'ancient-grove', density: 'Cluttered', character: 'Verdant' }),
    ],
  ])('renders the same forest (%s) twice to identical PNG bytes', (_name, map) => {
    expect(exportPng(map, true).equals(exportPng(map, true))).toBe(true);
  });

  test.each(ALL_FOREST_CHARACTERS)(
    'renders the same %s forest twice to identical bytes',
    (character) => {
      const map = generatedForest({
        seed: 'character-showcase',
        density: 'Balanced',
        character,
      });
      expect(exportPng(map, true).equals(exportPng(map, true))).toBe(true);
    },
  );

  test('renders the same forest twice to identical bytes with the grid off', () => {
    const map = generatedForest({
      seed: 'woodland-glade',
      density: 'Balanced',
      character: 'Verdant',
    });
    expect(exportPng(map, false).equals(exportPng(map, false))).toBe(true);
  });

  test('toggling the grid changes the exported bytes', () => {
    const map = generatedForest({
      seed: 'woodland-glade',
      density: 'Balanced',
      character: 'Verdant',
    });
    expect(exportPng(map, true).equals(exportPng(map, false))).toBe(false);
  });

  test('reversing path endpoints preserves the artwork', () => {
    const map = generatedForest({
      seed: 'woodland-glade',
      density: 'Balanced',
      character: 'Verdant',
    });
    const reversed: ForestClearing = {
      ...map,
      layout: { ...map.layout, pathStart: map.layout.pathEnd, pathEnd: map.layout.pathStart },
    };
    expect(exportPng(map, true).equals(exportPng(reversed, true))).toBe(true);
  });

  test('different densities produce different renders for the same layout', () => {
    const base = generatedForest({
      seed: 'woodland-glade',
      density: 'Balanced',
      character: 'Verdant',
    });
    const sparse = generatedForest({
      seed: 'woodland-glade',
      density: 'Sparse',
      character: 'Verdant',
    });
    const cluttered = generatedForest({
      seed: 'woodland-glade',
      density: 'Cluttered',
      character: 'Verdant',
    });
    const baseBytes = exportPng(base, true);
    expect(baseBytes.equals(exportPng(sparse, true))).toBe(false);
    expect(baseBytes.equals(exportPng(cluttered, true))).toBe(false);
  });

  test('every character produces a different render for the same layout', () => {
    const base = generatedForest({
      seed: 'character-showcase',
      density: 'Balanced',
      character: 'Verdant',
    });
    const baseBytes = exportPng(base, true);
    for (const character of ALL_FOREST_CHARACTERS) {
      if (character === 'Verdant') continue;
      const variant = changeForestCharacter(base, character);
      expect(baseBytes.equals(exportPng(variant, true)), `Verdant vs ${character}`).toBe(false);
    }
  });
});
