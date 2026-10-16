import { describe, expect, test } from 'vitest';
import { generateDungeon } from '../engine/generate';
import type { Dungeon } from '../engine/model';
import { exportFilename } from './export';

const generated = generateDungeon({ seed: 'mosslit-sanctum', roomCount: 6, density: 'Balanced' });
if (!generated.ok) throw new Error(generated.error);
const base: Dungeon = generated.map;

const withSeed = (seed: string): Dungeon => ({ ...base, seed });

describe('export filename sanitation', () => {
  test.each([
    ['mosslit-sanctum', 'encounter-mosslit-sanctum-balanced-r0-v1.0.0.png'],
    ['snake_case-2', 'encounter-snake_case-2-balanced-r0-v1.0.0.png'],
    ['sänctum-vault', 'encounter-sa-nctum-vault-balanced-r0-v1.0.0.png'],
    ['../../etc/passwd', 'encounter-etc-passwd-balanced-r0-v1.0.0.png'],
    ['C:\\Users\\gm', 'encounter-C-Users-gm-balanced-r0-v1.0.0.png'],
    ['!!! ???', 'encounter-dungeon-balanced-r0-v1.0.0.png'],
    ['龍宮', 'encounter-dungeon-balanced-r0-v1.0.0.png'],
    [`${'a'.repeat(80)}`, `encounter-${'a'.repeat(64)}-balanced-r0-v1.0.0.png`],
  ])('sanitizes %j to %s', (seed, expected) => {
    expect(exportFilename(withSeed(seed))).toBe(expected);
  });

  test('keeps density and revision in the suffix', () => {
    const map: Dungeon = {
      ...base,
      decoration: { ...base.decoration, density: 'Cluttered', revision: 3 },
    };
    expect(exportFilename(map)).toBe('encounter-mosslit-sanctum-cluttered-r3-v1.0.0.png');
  });
});
