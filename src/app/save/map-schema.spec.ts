import { describe, expect, test } from 'vitest';
import { generateCourtyard } from '../engine/courtyard-generate';
import { generateDungeon } from '../engine/generate';
import { generateForestClearing } from '../engine/forest-generate';
import { parseSavedMapBody } from './map-schema';
import { SAVE_FORMAT_VERSION, saveVocabulary } from './save-format';

const dungeon = generateDungeon({
  seed: 'mosslit-sanctum',
  roomCount: 6,
  density: 'Balanced',
  preset: 'Mosslit',
});
const forest = generateForestClearing({
  seed: 'woodland-glade',
  density: 'Sparse',
  character: 'Autumn',
});
if (!dungeon.ok) throw new Error(dungeon.error);
if (!forest.ok) throw new Error(forest.error);

const currentVocabulary = saveVocabulary(SAVE_FORMAT_VERSION);
if (!currentVocabulary) throw new Error('Expected current save vocabulary');

describe('saved map bodies', () => {
  test.each([dungeon.map, forest.map])('retains an accepted $type body by reference', (map) => {
    const before = structuredClone(map);
    expect(parseSavedMapBody(map, currentVocabulary)).toBe(map);
    expect(map).toEqual(before);
  });

  test.each([dungeon.map, forest.map])(
    'rejects a valid $type body when the record vocabulary excludes that map type',
    (map) => {
      expect(parseSavedMapBody(map, { ...currentVocabulary, mapTypes: [] })).toBeUndefined();
    },
  );

  describe('courtyard characters', () => {
    const courtyard = generateCourtyard({
      seed: 'ivy-court',
      density: 'Balanced',
      character: 'Desecrated',
      fountain: true,
    });
    if (!courtyard.ok) throw new Error(courtyard.error);

    test('retains an accepted generated courtyard by reference', () => {
      expect(parseSavedMapBody(courtyard.map, currentVocabulary)).toBe(courtyard.map);
    });

    test('rejects an out-of-vocabulary courtyard character without normalizing it', () => {
      const { character, ...decoration } = courtyard.map.decoration;
      const invalid = {
        ...courtyard.map,
        decoration: { ...decoration, character: 'Mossless' },
      };
      expect(parseSavedMapBody(invalid, currentVocabulary)).toBeUndefined();
    });
  });
});
