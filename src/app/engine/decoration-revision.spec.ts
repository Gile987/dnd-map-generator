import { generateCourtyard, shuffleCourtyardDetails } from './courtyard-generate';
import { describe, expect, test } from 'vitest';
import { shuffleDetails } from './decoration';
import { generateDungeon } from './generate';
import { generateForestClearing, shuffleForestDetails } from './forest-generate';
import type { GeneratedMap } from './model';

const dungeon = generateDungeon({
  seed: 'revision-limit',
  roomCount: 6,
  density: 'Balanced',
  preset: 'Mosslit',
});
const forest = generateForestClearing({
  seed: 'revision-limit',
  density: 'Balanced',
  character: 'Verdant',
});
if (!dungeon.ok) throw new Error(dungeon.error);
if (!forest.ok) throw new Error(forest.error);

const courtyard = generateCourtyard({
  seed: 'revision-limit',
  density: 'Balanced',
  fountain: true,
});
if (!courtyard.ok) throw new Error(courtyard.error);

function withRevision(map: GeneratedMap, revision: number): GeneratedMap {
  if (map.type === 'courtyard') return { ...map, decoration: { ...map.decoration, revision } };
  return map.type === 'dungeon'
    ? { ...map, decoration: { ...map.decoration, revision } }
    : { ...map, decoration: { ...map.decoration, revision } };
}

function shuffle(map: GeneratedMap): GeneratedMap {
  if (map.type === 'courtyard') return shuffleCourtyardDetails(map);
  return map.type === 'dungeon' ? shuffleDetails(map) : shuffleForestDetails(map);
}

describe.each([dungeon.map, forest.map, courtyard.map])(
  '$type detail revision limits',
  (original) => {
    test('advances to the last safe revision, then rejects without changing the accepted map', () => {
      const beforeLimit = withRevision(original, Number.MAX_SAFE_INTEGER - 1);
      const before = JSON.stringify(beforeLimit);
      const last = shuffle(beforeLimit);
      expect(last.decoration.revision).toBe(Number.MAX_SAFE_INTEGER);
      expect(last.layout).toBe(beforeLimit.layout);
      expect(last.surfaceSeed).toBe(beforeLimit.surfaceSeed);
      expect(JSON.stringify(beforeLimit) === before).toBe(true);
      const snapshot = JSON.stringify(last);
      expect(() => shuffle(last)).toThrow('detail revision limit');
      expect(JSON.stringify(last) === snapshot).toBe(true);
    });

    test('rejects invalid revisions before decorating', () => {
      for (const revision of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, 1e100, NaN, Infinity]) {
        const map = withRevision(original, revision);
        expect(() => shuffle(map)).toThrow('invalid detail revision');
        expect(map.decoration.props).toBe(original.decoration.props);
        expect(map.layout).toBe(original.layout);
      }
    });
  },
);
