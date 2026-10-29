import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
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

const vocabulary = saveVocabulary('2.0.0');
if (!vocabulary) throw new Error('Expected format-2 vocabulary');
const currentVocabulary = saveVocabulary(SAVE_FORMAT_VERSION);
if (!currentVocabulary) throw new Error('Expected current save vocabulary');

function legacyMap(): Record<string, unknown> {
  const fixture: unknown = JSON.parse(
    readFileSync(new URL('./fixtures/forest-v3.json', import.meta.url), 'utf8'),
  );
  if (
    typeof fixture !== 'object' ||
    fixture === null ||
    !('maps' in fixture) ||
    !Array.isArray(fixture.maps)
  )
    throw new Error('Expected legacy records');
  const record: unknown = fixture.maps[0];
  if (typeof record !== 'object' || record === null || !('map' in record))
    throw new Error('Expected a legacy map');
  const map = record.map;
  if (typeof map !== 'object' || map === null) throw new Error('Expected a legacy map object');
  return { ...map };
}

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

  test('normalizes a frozen legacy forest without rebuilding or mutating its saved content', () => {
    const map = legacyMap();
    const decoration = map['decoration'];
    if (typeof decoration !== 'object' || decoration === null || !('props' in decoration))
      throw new Error('Expected legacy decoration');
    const before = structuredClone(map);
    const parsed = parseSavedMapBody(map, vocabulary);
    if (parsed?.type !== 'forest') throw new Error('Expected a migrated forest');
    expect(parsed).not.toBe(map);
    expect(parsed.decoration).not.toBe(decoration);
    expect(parsed.layout).toBe(map['layout']);
    expect(parsed.decoration.props).toBe(decoration.props);
    expect(parsed).toEqual({ ...map, decoration: { ...decoration, character: 'Verdant' } });
    expect(map).toEqual(before);
    expect(parseSavedMapBody(parsed, vocabulary)).toBe(parsed);
  });

  test.each([undefined, 'Meadow'])(
    'does not overwrite an explicitly invalid legacy character (%s) with Verdant',
    (character) => {
      const map = legacyMap();
      const decoration = map['decoration'];
      if (typeof decoration !== 'object' || decoration === null)
        throw new Error('Expected legacy decoration');
      const invalid = { ...map, decoration: { ...decoration, character } };
      expect(parseSavedMapBody(invalid, vocabulary)).toBeUndefined();
      expect(invalid.decoration.character).toBe(character);
    },
  );
});
