import { describe, expect, test } from 'vitest';
import { generateDungeon } from '../engine/generate';
import type { GeneratedMap } from '../engine/model';
import { exportFilename } from './export';

const generated = generateDungeon({
  seed: 'mosslit-sanctum',
  roomCount: 6,
  density: 'Balanced',
  preset: 'Mosslit',
});
if (!generated.ok) throw new Error(generated.error);
const base: GeneratedMap = generated.map;

const withSeed = (seed: string): GeneratedMap => ({ ...base, seed });

describe('export filename sanitation', () => {
  test.each([
    ['mosslit-sanctum', 'encounter-mosslit-sanctum-mosslit-balanced-r0-v3.0.0.png'],
    ['snake_case-2', 'encounter-snake_case-2-mosslit-balanced-r0-v3.0.0.png'],
    ['sänctum-vault', 'encounter-sa-nctum-vault-mosslit-balanced-r0-v3.0.0.png'],
    ['../../etc/passwd', 'encounter-etc-passwd-mosslit-balanced-r0-v3.0.0.png'],
    ['C:\\Users\\gm', 'encounter-C-Users-gm-mosslit-balanced-r0-v3.0.0.png'],
    ['!!! ???', 'encounter-dungeon-mosslit-balanced-r0-v3.0.0.png'],
    ['龍宮', 'encounter-dungeon-mosslit-balanced-r0-v3.0.0.png'],
    [`${'a'.repeat(80)}`, `encounter-${'a'.repeat(64)}-mosslit-balanced-r0-v3.0.0.png`],
  ])('sanitizes %j to %s', (seed, expected) => {
    expect(exportFilename(withSeed(seed))).toBe(expected);
  });

  test('keeps preset, density and revision in the suffix', () => {
    const map: GeneratedMap = {
      ...base,
      decoration: { ...base.decoration, density: 'Cluttered', preset: 'Crypt', revision: 3 },
    };
    if (map.type !== 'dungeon') throw new Error('Expected dungeon');
    expect(exportFilename(map)).toBe('encounter-mosslit-sanctum-crypt-cluttered-r3-v3.0.0.png');
  });
});
