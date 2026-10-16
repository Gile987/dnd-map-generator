import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, test } from 'vitest';
import { generateForestClearing } from '../engine/forest-generate';
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
    ['woodland-glade', generatedForest({ seed: 'woodland-glade', density: 'Balanced' })],
    ['emerald-path', generatedForest({ seed: 'emerald-path', density: 'Sparse' })],
    ['ancient-grove', generatedForest({ seed: 'ancient-grove', density: 'Cluttered' })],
  ])('renders the same forest (%s) twice to identical PNG bytes', (_name, map) => {
    expect(exportPng(map, true).equals(exportPng(map, true))).toBe(true);
  });

  test('renders the same forest twice to identical bytes with the grid off', () => {
    const map = generatedForest({ seed: 'woodland-glade', density: 'Balanced' });
    expect(exportPng(map, false).equals(exportPng(map, false))).toBe(true);
  });

  test('toggling the grid changes the exported bytes', () => {
    const map = generatedForest({ seed: 'woodland-glade', density: 'Balanced' });
    expect(exportPng(map, true).equals(exportPng(map, false))).toBe(false);
  });

  test('reversing path endpoints preserves the artwork', () => {
    const map = generatedForest({ seed: 'woodland-glade', density: 'Balanced' });
    const reversed: ForestClearing = {
      ...map,
      layout: { ...map.layout, pathStart: map.layout.pathEnd, pathEnd: map.layout.pathStart },
    };
    expect(exportPng(map, true).equals(exportPng(reversed, true))).toBe(true);
  });

  test('different densities produce different renders for the same layout', () => {
    const base = generatedForest({ seed: 'woodland-glade', density: 'Balanced' });
    const sparse = generatedForest({ seed: 'woodland-glade', density: 'Sparse' });
    const cluttered = generatedForest({ seed: 'woodland-glade', density: 'Cluttered' });
    const baseBytes = exportPng(base, true);
    expect(baseBytes.equals(exportPng(sparse, true))).toBe(false);
    expect(baseBytes.equals(exportPng(cluttered, true))).toBe(false);
  });
});
