import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, test } from 'vitest';
import { generateDungeon } from '../engine/generate';
import { changePreset } from '../engine/decoration';
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
    [
      'amber-vault',
      generatedMap({ seed: 'amber-vault', roomCount: 4, density: 'Sparse', preset: 'Mosslit' }),
    ],
    [
      'mosslit-sanctum',
      generatedMap({
        seed: 'mosslit-sanctum',
        roomCount: 6,
        density: 'Balanced',
        preset: 'Mosslit',
      }),
    ],
    [
      'forgotten-library',
      generatedMap({
        seed: 'forgotten-library',
        roomCount: 8,
        density: 'Cluttered',
        preset: 'Mosslit',
      }),
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

  test('different presets produce different renders for the same layout', () => {
    const base = generatedMap({
      seed: 'mosslit-sanctum',
      roomCount: 6,
      density: 'Balanced',
      preset: 'Mosslit',
    });
    const presets: readonly {
      name: string;
      preset: 'Mosslit' | 'Crypt' | 'Storehouse' | 'Sanctuary';
    }[] = [
      { name: 'Crypt', preset: 'Crypt' },
      { name: 'Storehouse', preset: 'Storehouse' },
      { name: 'Sanctuary', preset: 'Sanctuary' },
    ];
    const baseBytes = exportPng(base, true);
    for (const { preset } of presets) {
      const variant = changePreset(base, preset);
      const variantBytes = exportPng(variant, true);
      expect(baseBytes.equals(variantBytes), `Mosslit vs ${preset}`).toBe(false);
    }
  });

  test.each(['Mosslit', 'Crypt', 'Storehouse', 'Sanctuary'] as const)(
    'renders the same %s map twice to identical bytes',
    (preset) => {
      const map = generatedMap({
        seed: 'mosslit-sanctum',
        roomCount: 6,
        density: 'Balanced',
        preset,
      });
      expect(exportPng(map, true).equals(exportPng(map, true))).toBe(true);
    },
  );
});
