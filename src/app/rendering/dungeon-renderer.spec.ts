import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, test } from 'vitest';
import { generateDungeon } from '../engine/generate';
import { showcaseDungeon } from '../engine/showcase';
import type { Dungeon, Settings } from '../engine/model';
import { renderDungeon } from './dungeon-renderer';
import { EXPORT_HEIGHT, EXPORT_WIDTH, PIXELS_PER_TILE } from './resolution';

function exportPng(map: Dungeon, grid: boolean): Buffer {
  const canvas = createCanvas(EXPORT_WIDTH, EXPORT_HEIGHT);
  renderDungeon(canvas.getContext('2d'), map, { grid, pixelsPerTile: PIXELS_PER_TILE });
  return canvas.toBuffer('image/png');
}

function generatedMap(settings: Settings): Dungeon {
  const result = generateDungeon(settings);
  if (!result.ok) throw new Error(`${settings.seed}: ${result.error}`);
  return result.map;
}

describe('renderer determinism', () => {
  test.each([
    ['showcase', showcaseDungeon()],
    ['amber-vault', generatedMap({ seed: 'amber-vault', roomCount: 4, density: 'Sparse' })],
    [
      'mosslit-sanctum',
      generatedMap({ seed: 'mosslit-sanctum', roomCount: 6, density: 'Balanced' }),
    ],
    [
      'forgotten-library',
      generatedMap({ seed: 'forgotten-library', roomCount: 8, density: 'Cluttered' }),
    ],
  ])('renders the same map (%s) twice to identical PNG bytes', (_name, map) => {
    expect(exportPng(map, true).equals(exportPng(map, true))).toBe(true);
  });

  test('renders the same map twice to identical bytes with the grid off', () => {
    const map = showcaseDungeon();
    expect(exportPng(map, false).equals(exportPng(map, false))).toBe(true);
  });

  test('toggling the grid changes the exported bytes', () => {
    const map = showcaseDungeon();
    expect(exportPng(map, true).equals(exportPng(map, false))).toBe(false);
  });
});
