import { describe, expect, test } from 'vitest';
import { generateDungeon } from '../engine/generate';
import { generateForestClearing } from '../engine/forest-generate';
import type { GeneratedMap } from '../engine/model';
import { configuredExportFilename, createPng, exportFilename } from './export';
import { EXPORT_PRESETS, exportDimensions } from './export-presets';

const generated = generateDungeon({
  seed: 'mosslit-sanctum',
  roomCount: 6,
  density: 'Balanced',
  preset: 'Mosslit',
});
if (!generated.ok) throw new Error(generated.error);
const base: GeneratedMap = generated.map;

const generatedForest = generateForestClearing({
  seed: 'woodland-glade',
  density: 'Sparse',
  character: 'Verdant',
});
if (!generatedForest.ok) throw new Error(generatedForest.error);
const forestBase: GeneratedMap = generatedForest.map;

const withSeed = (seed: string): GeneratedMap => ({ ...base, seed });

describe('export filename sanitation', () => {
  test.each(EXPORT_PRESETS)(
    '$label uses its native resolution and an unambiguous configured filename',
    (preset) => {
      const size = exportDimensions(preset.pixelsPerTile);
      expect(size).toEqual({ width: 40 * preset.pixelsPerTile, height: 30 * preset.pixelsPerTile });
      const name = configuredExportFilename(base, false, 15, preset);
      expect(name).toBe(
        preset.id === 'standard'
          ? 'encounter-mosslit-sanctum-mosslit-balanced-r0-v4.0.0-grid-off.png'
          : `encounter-mosslit-sanctum-mosslit-balanced-r0-v4.0.0-${preset.id}-40x30-${preset.pixelsPerTile}px-grid-off.png`,
      );
      expect(configuredExportFilename(base, true, 35, preset)).toMatch(/-grid-35pct\.png$/);
    },
  );

  test.each([0, -1, 64.5, NaN, Infinity, 200])(
    'rejects unsupported resolution %s before creating a canvas',
    async (resolution) => {
      expect(() => exportDimensions(resolution)).toThrow('supported PNG export resolution');
      await expect(createPng(base, false, undefined, resolution)).rejects.toThrow(
        'supported PNG export resolution',
      );
    },
  );
  test.each([
    [true, 15, 'grid-15pct'],
    [true, 0, 'grid-0pct'],
    [false, 80, 'grid-off'],
  ] as const)(
    'distinguishes configured PNGs with grid=%s and opacity=%s',
    (grid, opacity, suffix) => {
      expect(configuredExportFilename(base, grid, opacity)).toBe(
        `encounter-mosslit-sanctum-mosslit-balanced-r0-v4.0.0-${suffix}.png`,
      );
    },
  );

  test.each([
    ['mosslit-sanctum', 'encounter-mosslit-sanctum-mosslit-balanced-r0-v4.0.0.png'],
    ['snake_case-2', 'encounter-snake_case-2-mosslit-balanced-r0-v4.0.0.png'],
    ['sänctum-vault', 'encounter-sa-nctum-vault-mosslit-balanced-r0-v4.0.0.png'],
    ['../../etc/passwd', 'encounter-etc-passwd-mosslit-balanced-r0-v4.0.0.png'],
    ['C:\\Users\\gm', 'encounter-C-Users-gm-mosslit-balanced-r0-v4.0.0.png'],
    ['!!! ???', 'encounter-dungeon-mosslit-balanced-r0-v4.0.0.png'],
    ['龍宮', 'encounter-dungeon-mosslit-balanced-r0-v4.0.0.png'],
    [`${'a'.repeat(80)}`, `encounter-${'a'.repeat(64)}-mosslit-balanced-r0-v4.0.0.png`],
  ])('sanitizes %j to %s', (seed, expected) => {
    expect(exportFilename(withSeed(seed))).toBe(expected);
  });

  test('keeps preset, density and revision in the suffix', () => {
    const map: GeneratedMap = {
      ...base,
      decoration: { ...base.decoration, density: 'Cluttered', preset: 'Crypt', revision: 3 },
    };
    if (map.type !== 'dungeon') throw new Error('Expected dungeon');
    expect(exportFilename(map)).toBe('encounter-mosslit-sanctum-crypt-cluttered-r3-v4.0.0.png');
  });

  test('keeps the forest character, density and revision in the suffix', () => {
    const map: GeneratedMap = {
      ...forestBase,
      decoration: {
        ...forestBase.decoration,
        density: 'Cluttered',
        character: 'Autumn',
        revision: 2,
      },
    };
    if (map.type !== 'forest') throw new Error('Expected forest');
    expect(exportFilename(map)).toBe(
      'encounter-woodland-glade-forest-autumn-cluttered-r2-v4.0.0.png',
    );
  });
});
