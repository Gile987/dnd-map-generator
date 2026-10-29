import { expect, test } from 'vitest';
import { generateDungeon } from '../engine/generate';
import { generateForestClearing } from '../engine/forest-generate';
import { generateCourtyard } from '../engine/courtyard-generate';
import type { GeneratedMap, MapType } from '../engine/model';
import type { SavedMap } from './save-format';
import { DEFAULT_LIBRARY_VIEW, viewSavedMaps } from './library-view';

const dungeon = generateDungeon({
  seed: 'stone-seed',
  roomCount: 6,
  density: 'Balanced',
  preset: 'Mosslit',
});
const forest = generateForestClearing({
  seed: 'woodland-seed',
  density: 'Balanced',
  character: 'Verdant',
});
const courtyard = generateCourtyard({ seed: 'ivy-seed', density: 'Balanced', fountain: false });
if (!dungeon.ok || !forest.ok || !courtyard.ok) throw new Error('Missing library fixtures');
const maps: Readonly<Record<Exclude<MapType, 'tower'>, GeneratedMap>> = {
  dungeon: dungeon.map,
  forest: forest.map,
  courtyard: courtyard.map,
};

function record(
  id: string,
  name: string,
  type: Exclude<MapType, 'tower'>,
  savedAt: string,
  favorite = false,
): SavedMap {
  return {
    id,
    name,
    map: maps[type],
    savedAt,
    favorite,
    saveFormatVersion: '9.0.0',
    thumbnail: 'data:image/png;base64,AAAA',
  };
}

const records = Object.freeze([
  record('dungeon', 'Old vault', 'dungeon', '2026-10-25T12:00:00Z', true),
  record('forest', 'Autumn watch', 'forest', '2026-10-26T12:00:00Z'),
  record('courtyard', 'Ivy court', 'courtyard', '2026-10-27T12:00:00Z', true),
]);
const ids = (records: readonly SavedMap[]) => records.map((record) => record.id);

test('the default keeps favorites first, with the newest in each group', () => {
  expect(ids(viewSavedMaps(records, DEFAULT_LIBRARY_VIEW))).toEqual([
    'courtyard',
    'dungeon',
    'forest',
  ]);
  expect(ids(viewSavedMaps(records, { ...DEFAULT_LIBRARY_VIEW, sort: 'newest' }))).toEqual([
    'courtyard',
    'forest',
    'dungeon',
  ]);
});

test.each([
  ['  VAULT  ', ['dungeon']],
  ['WOODLAND-SEED', ['forest']],
  ['ivy', ['courtyard']],
  ['', ['courtyard', 'dungeon', 'forest']],
  ['   ', ['courtyard', 'dungeon', 'forest']],
  ['missing', []],
])('search %s matches a name or seed without case sensitivity', (query, expected) => {
  expect(ids(viewSavedMaps(records, { ...DEFAULT_LIBRARY_VIEW, query }))).toEqual(expected);
});

test.each(['dungeon', 'forest', 'courtyard'] as const)('filters the %s map type', (mapType) => {
  expect(ids(viewSavedMaps(records, { ...DEFAULT_LIBRARY_VIEW, mapType }))).toEqual([mapType]);
});

test('combines every filter and reflects updated records without retaining a stale result', () => {
  const view = {
    ...DEFAULT_LIBRARY_VIEW,
    query: 'ivy',
    mapType: 'courtyard',
    favoritesOnly: true,
  } as const;
  expect(ids(viewSavedMaps(records, view))).toEqual(['courtyard']);
  expect(viewSavedMaps(records, { ...view, mapType: 'forest' })).toEqual([]);
  const renamed = records.map((record) =>
    record.id === 'courtyard' ? { ...record, name: 'Hidden ruin' } : record,
  );
  // The seed still matches until the query is narrowed to the old name.
  expect(viewSavedMaps(renamed, { ...view, query: 'Ivy court' })).toEqual([]);
  expect(
    viewSavedMaps(
      records.map((record) => ({ ...record, favorite: false })),
      view,
    ),
  ).toEqual([]);
  expect(viewSavedMaps(records.slice(0, 2), view)).toEqual([]);
});

test('name sorting is case insensitive and puts numbered names in a useful order', () => {
  const source = [
    record('10', 'Map 10', 'dungeon', ''),
    record('2', 'map 2', 'forest', ''),
    record('a', 'Amber', 'courtyard', ''),
  ];
  expect(ids(viewSavedMaps(source, { ...DEFAULT_LIBRARY_VIEW, sort: 'name' }))).toEqual([
    'a',
    '2',
    '10',
  ]);
});

test('newest sorting compares instants, keeps undated legacy maps, and resolves ties consistently', () => {
  const source = [
    record('z', 'Same', 'forest', '2026-10-27T10:00:00Z'),
    record('a', 'same', 'courtyard', '2026-10-27T12:00:00+02:00'),
    record('newest', 'Older clock time', 'dungeon', '2026-10-27T10:30:00Z'),
    record('legacy-b', 'Map B', 'forest', 'unknown'),
    record('legacy-a', 'Map A', 'dungeon', ''),
  ];
  const expected = ['newest', 'a', 'z', 'legacy-a', 'legacy-b'];
  expect(ids(viewSavedMaps(source, { ...DEFAULT_LIBRARY_VIEW, sort: 'newest' }))).toEqual(expected);
  expect(
    ids(viewSavedMaps([...source].reverse(), { ...DEFAULT_LIBRARY_VIEW, sort: 'newest' })),
  ).toEqual(expected);
});

test('view operations never mutate stored order, records, models, or the filter input', () => {
  const snapshot = structuredClone(records);
  const view = Object.freeze({ ...DEFAULT_LIBRARY_VIEW, query: ' IVY ' });
  const result = viewSavedMaps(records, view);
  expect(result[0]).toBe(records[2]);
  expect(records).toEqual(snapshot);
  expect(view.query).toBe(' IVY ');
  expect(viewSavedMaps([], view)).toEqual([]);
});
