import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, test } from 'vitest';
import { changeForestCharacter, generateForestClearing } from '../engine/forest-generate';
import { ALL_FOREST_CHARACTERS } from '../engine/model';
import type { ForestClearing, ForestSettings } from '../engine/model';
import { renderForest } from './forest-renderer';
import { EXPORT_HEIGHT, EXPORT_WIDTH, PIXELS_PER_TILE } from './resolution';

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
