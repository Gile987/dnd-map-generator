import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { generateDungeon } from '../engine/generate';
import { generateForestClearing } from '../engine/forest-generate';
import {
  ALL_DENSITIES,
  ALL_FOREST_CHARACTERS,
  ALL_PRESETS,
  ALL_PROP_KINDS,
  indexOf,
} from '../engine/model';
import type {
  DecorationPreset,
  Density,
  ForestCharacter,
  GeneratedMap,
  PropKind,
} from '../engine/model';
import {
  BACKUP_FORMAT,
  SAVE_FORMAT_VERSION,
  defaultMapName,
  duplicateName,
  isUsableMap,
  makeSavedMap,
  mapSummary,
  normalizeName,
  parseBundle,
  parseSavedMap,
  saveVocabulary,
  mapUsesVocabulary,
  serializeBundle,
  uniqueById,
} from './save-format';
import type { SavedMap, SaveVocabulary } from './save-format';

const dungeon = generateDungeon({
  seed: 'mosslit-sanctum',
  roomCount: 6,
  density: 'Balanced',
  preset: 'Mosslit',
});
const forest = generateForestClearing({
  seed: 'woodland-glade',
  density: 'Sparse',
  character: 'Verdant',
});
if (!dungeon.ok) throw new Error(dungeon.error);
if (!forest.ok) throw new Error(forest.error);

const THUMB = 'data:image/png;base64,AAAA';

function record(map: GeneratedMap, overrides: Partial<SavedMap> = {}): SavedMap {
  return {
    ...makeSavedMap(map, defaultMapName(map), THUMB, 'save-1', '2026-10-16T10:00:00.000Z'),
    ...overrides,
  };
}

type MutableMap = {
  type: string;
  seed: string;
  surfaceSeed: unknown;
  layout: Record<string, unknown>;
  decoration: Record<string, unknown>;
};

function corruptRecord(
  base: GeneratedMap,
  mutate: (map: MutableMap) => void,
): Record<string, unknown> {
  const clone: MutableMap = structuredClone({
    ...base,
    layout: { ...base.layout },
    decoration: { ...base.decoration },
  });
  mutate(clone);
  return {
    ...makeSavedMap(base, defaultMapName(base), THUMB, 'save-1', '2026-10-16T10:00:00.000Z'),
    map: clone,
  };
}

function bundle(maps: unknown[], saveFormatVersion: unknown = SAVE_FORMAT_VERSION): string {
  return JSON.stringify({ format: BACKUP_FORMAT, saveFormatVersion, maps });
}

describe('save format', () => {
  test('builds human-friendly names and summaries', () => {
    expect(defaultMapName(dungeon.map)).toBe('mosslit-sanctum dungeon');
    expect(defaultMapName(forest.map)).toBe('woodland-glade clearing');
    expect(mapSummary(dungeon.map)).toBe('6 rooms · Mosslit · Balanced r0');
    expect(mapSummary(forest.map)).toBe('Verdant · Sparse r0');
  });

  test('round-trips saved maps through a backup bundle without loss', () => {
    const maps = [record(dungeon.map), record(forest.map, { id: 'save-2' })];
    const parsed = parseBundle(serializeBundle(maps));
    expect(parsed).toEqual({ ok: true, maps, skipped: 0 });
  });

  test('parses a single saved record and rejects malformed entries', () => {
    const original = record(dungeon.map);
    expect(parseSavedMap(original)).toEqual(original);

    expect(parseSavedMap({ ...original, name: '   ' })).toBeUndefined();
    expect(parseSavedMap({ ...original, name: 'x'.repeat(65) })).toBeUndefined();
    expect(parseSavedMap({ ...original, id: 'not valid id!' })).toBeUndefined();
    expect(parseSavedMap({ ...original, favorite: 'yes' })).toBeUndefined();
    expect(parseSavedMap({ ...original, thumbnail: 'not-a-data-url' })).toBeUndefined();
    expect(parseSavedMap({ ...original, saveFormatVersion: '99.0.0' })).toBeUndefined();
    expect(parseSavedMap({ ...original, saveFormatVersion: 'banana' })).toBeUndefined();
    expect(parseSavedMap({ ...original, map: { type: 'dungeon' } })).toBeUndefined();
    expect(parseSavedMap(null)).toBeUndefined();
    expect(parseSavedMap('nope')).toBeUndefined();
  });

  test('rejects structurally invalid maps that the renderer could not draw', () => {
    expect(
      parseSavedMap(corruptRecord(dungeon.map, (m) => (m.decoration.preset = 'Unknown'))),
    ).toBeUndefined();
    expect(
      parseSavedMap(corruptRecord(dungeon.map, (m) => (m.decoration.density = 'Dense'))),
    ).toBeUndefined();
    expect(parseSavedMap(corruptRecord(dungeon.map, (m) => (m.seed = '   ')))).toBeUndefined();
    expect(
      parseSavedMap(corruptRecord(dungeon.map, (m) => (m.decoration.revision = -1))),
    ).toBeUndefined();
    expect(
      parseSavedMap(
        corruptRecord(dungeon.map, (m) => {
          m.decoration.props = [{ x: 0, y: 0, kind: 'nope', blocking: false, variation: 0.5 }];
        }),
      ),
    ).toBeUndefined();
    expect(
      parseSavedMap(corruptRecord(forest.map, (m) => (m.layout.route = undefined))),
    ).toBeUndefined();
    expect(
      parseSavedMap(corruptRecord(forest.map, (m) => (m.decoration.density = 'SparseX'))),
    ).toBeUndefined();
  });

  test('save vocabulary is pinned per format version and rejects extra components', () => {
    expect(saveVocabulary('1.0.0')).toBeDefined();
    expect(saveVocabulary('2.0.0')).toBeDefined();
    expect(saveVocabulary('0.9.0')).toBeUndefined();
    expect(saveVocabulary('99.0.0')).toBeUndefined();
    expect(saveVocabulary('1.0.0.99')).toBeUndefined();
    expect(saveVocabulary('2.0.0.1')).toBeUndefined();
    expect(saveVocabulary('banana')).toBeUndefined();
  });

  test('format vocabularies use fixed values independent of live engine lists', () => {
    const format1 = saveVocabulary('1.0.0');
    const format2 = saveVocabulary('2.0.0');
    if (!format1 || !format2) throw new Error('Expected vocabularies');

    expect(format2.densities).toEqual(['Sparse', 'Balanced', 'Cluttered']);
    expect(format2.presets).toEqual(['Mosslit', 'Crypt', 'Storehouse', 'Sanctuary']);
    expect(format2.forestCharacters).toEqual(['Verdant', 'Autumn', 'Pines', 'Fey']);
    expect(format2.propKinds).toEqual(format1.propKinds);
    expect(format2.propKinds).not.toBe(format1.propKinds);
  });

  test('fixed historical schemas reject options from an extended engine vocabulary', () => {
    const format1 = saveVocabulary('1.0.0');
    const format2 = saveVocabulary('2.0.0');
    if (!format1 || !format2) throw new Error('Expected vocabularies');

    const extendedVocabulary: SaveVocabulary = {
      densities: ['Sparse', 'Balanced', 'Cluttered', 'Dense'],
      presets: ['Mosslit', 'Crypt', 'Storehouse', 'Sanctuary', 'FuturePreset'],
      forestCharacters: ['Verdant', 'Autumn', 'Pines', 'Fey', 'Meadow'],
      propKinds: [
        'crate',
        'barrel',
        'rubble',
        'rug',
        'sconce',
        'moss',
        'sarcophagus',
        'vine',
        'broken_column',
        'tree',
        'boulder',
        'fern',
        'mushroom',
        'bush',
        'log',
        'stump',
        'flower',
        'dragon',
      ],
    };

    const futurePresetMap = corruptRecord(
      dungeon.map,
      (m) => (m.decoration.preset = 'FuturePreset'),
    )['map'];
    expect(mapUsesVocabulary(futurePresetMap, extendedVocabulary)).toBe(true);
    expect(mapUsesVocabulary(futurePresetMap, format1)).toBe(false);
    expect(mapUsesVocabulary(futurePresetMap, format2)).toBe(false);

    const futureCharacterMap = corruptRecord(
      forest.map,
      (m) => (m.decoration.character = 'Meadow'),
    )['map'];
    expect(mapUsesVocabulary(futureCharacterMap, extendedVocabulary)).toBe(true);
    expect(mapUsesVocabulary(futureCharacterMap, format1)).toBe(false);
    expect(mapUsesVocabulary(futureCharacterMap, format2)).toBe(false);

    const futureDensityMap = corruptRecord(dungeon.map, (m) => (m.decoration.density = 'Dense'))[
      'map'
    ];
    expect(mapUsesVocabulary(futureDensityMap, extendedVocabulary)).toBe(true);
    expect(mapUsesVocabulary(futureDensityMap, format1)).toBe(false);
    expect(mapUsesVocabulary(futureDensityMap, format2)).toBe(false);

    const futurePropMap = corruptRecord(dungeon.map, (m) => {
      m.decoration.props = [{ x: 1, y: 1, kind: 'dragon', blocking: false, variation: 0.5 }];
    })['map'];
    expect(mapUsesVocabulary(futurePropMap, extendedVocabulary)).toBe(true);
    expect(mapUsesVocabulary(futurePropMap, format1)).toBe(false);
    expect(mapUsesVocabulary(futurePropMap, format2)).toBe(false);
  });

  test('parseSavedMap rejects records with unsupported version components', () => {
    const valid = record(dungeon.map);
    expect(parseSavedMap({ ...valid, saveFormatVersion: '1.0.0.99' })).toBeUndefined();
    expect(parseSavedMap({ ...valid, saveFormatVersion: '2.0.0.1' })).toBeUndefined();
  });

  test('parseSavedMap rejects future engine options even when isUsableMap accepts them', () => {
    const originalPresets = [...ALL_PRESETS];
    const originalDensities = [...ALL_DENSITIES];
    const originalCharacters = [...ALL_FOREST_CHARACTERS];
    const originalPropKinds = [...ALL_PROP_KINDS];

    try {
      (ALL_PRESETS as DecorationPreset[]).push('FuturePreset' as DecorationPreset);
      (ALL_DENSITIES as Density[]).push('Dense' as Density);
      (ALL_FOREST_CHARACTERS as ForestCharacter[]).push('Meadow' as ForestCharacter);
      (ALL_PROP_KINDS as PropKind[]).push('dragon' as PropKind);

      const futureDungeon = corruptRecord(
        dungeon.map,
        (m) => (m.decoration.preset = 'FuturePreset'),
      )['map'] as GeneratedMap;
      expect(isUsableMap(futureDungeon)).toBe(true);
      expect(parseSavedMap(record(futureDungeon, { saveFormatVersion: '1.0.0' }))).toBeUndefined();
      expect(parseSavedMap(record(futureDungeon, { saveFormatVersion: '2.0.0' }))).toBeUndefined();

      const futureForest = corruptRecord(forest.map, (m) => (m.decoration.character = 'Meadow'))[
        'map'
      ] as GeneratedMap;
      expect(isUsableMap(futureForest)).toBe(true);
      expect(parseSavedMap(record(futureForest, { saveFormatVersion: '1.0.0' }))).toBeUndefined();
      expect(parseSavedMap(record(futureForest, { saveFormatVersion: '2.0.0' }))).toBeUndefined();
    } finally {
      (ALL_PRESETS as DecorationPreset[]).length = 0;
      (ALL_PRESETS as DecorationPreset[]).push(...originalPresets);
      (ALL_DENSITIES as Density[]).length = 0;
      (ALL_DENSITIES as Density[]).push(...originalDensities);
      (ALL_FOREST_CHARACTERS as ForestCharacter[]).length = 0;
      (ALL_FOREST_CHARACTERS as ForestCharacter[]).push(...originalCharacters);
      (ALL_PROP_KINDS as PropKind[]).length = 0;
      (ALL_PROP_KINDS as PropKind[]).push(...originalPropKinds);
    }
  });

  test('bounds prop variation to [0, 1)', () => {
    const withVariation = (value: number) =>
      corruptRecord(dungeon.map, (m) => {
        const props = m.decoration.props as Array<Record<string, unknown>>;
        const first = props[0];
        if (first) first['variation'] = value;
      });
    expect(parseSavedMap(withVariation(-0.1))).toBeUndefined();
    expect(parseSavedMap(withVariation(1))).toBeUndefined();
    expect(parseSavedMap(withVariation(1.5))).toBeUndefined();
    expect(parseSavedMap(withVariation(1e308))).toBeUndefined();
    expect(parseSavedMap(withVariation(0))).toBeDefined();
    expect(parseSavedMap(withVariation(0.999))).toBeDefined();
  });

  test('rejects forest routes that are empty, off-path, or disconnected', () => {
    const start = indexOf(forest.map.layout.pathStart.x, forest.map.layout.pathStart.y);
    const end = indexOf(forest.map.layout.pathEnd.x, forest.map.layout.pathEnd.y);
    const withRoute = (route: unknown) =>
      corruptRecord(forest.map, (m) => {
        m.layout.route = route;
      });
    expect(parseSavedMap(withRoute([]))).toBeUndefined();
    expect(parseSavedMap(withRoute([0]))).toBeUndefined();
    expect(parseSavedMap(withRoute([start]))).toBeUndefined();
    expect(parseSavedMap(withRoute([start, end]))).toBeUndefined();
  });

  test('migrates actual v3 forest saves without changing their saved models', () => {
    const text = readFileSync(new URL('./fixtures/forest-v3.json', import.meta.url), 'utf8');
    const original: unknown = JSON.parse(text);
    if (typeof original !== 'object' || original === null || !('maps' in original))
      throw new Error('Legacy fixture has no maps');
    const maps = original.maps;
    if (!Array.isArray(maps)) throw new Error('Legacy fixture has no map records');
    const snapshot = structuredClone(maps);
    const parsed = parseBundle(text);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.skipped).toBe(0);
    expect(parsed.maps).toHaveLength(3);
    parsed.maps.forEach((entry, i) => {
      const legacy: unknown = maps[i];
      if (typeof legacy !== 'object' || legacy === null || !('map' in legacy))
        throw new Error('Legacy fixture has no map');
      expect(parseSavedMap(legacy)).toEqual(entry);
      expect(entry.saveFormatVersion).toBe('2.0.0');
      expect(entry.map.type).toBe('forest');
      if (entry.map.type !== 'forest') throw new Error('Expected forest');
      const { character, ...decoration } = entry.map.decoration;
      expect(character).toBe('Verdant');
      expect({ ...entry.map, decoration }).toEqual(legacy.map);
      expect(entry.map.version).toBe('3.0.0');
    });
    expect(maps).toEqual(snapshot);
    expect(parseBundle(serializeBundle(parsed.maps))).toEqual(parsed);
  });

  test.each(ALL_FOREST_CHARACTERS)(
    'writes %s records and backups as format 2.0.0 so v1 readers reject them',
    (character) => {
      const result = generateForestClearing({
        seed: 'character-save',
        density: 'Balanced',
        character,
      });
      if (!result.ok) throw new Error(result.error);
      const saved = record(result.map);
      expect(saved.saveFormatVersion).toBe('2.0.0');
      const text = serializeBundle([saved]);
      expect(JSON.parse(text)).toMatchObject({
        saveFormatVersion: '2.0.0',
        maps: [{ saveFormatVersion: '2.0.0' }],
      });
      expect(parseBundle(text)).toEqual({ ok: true, maps: [saved], skipped: 0 });
    },
  );

  test('upgrades the initial I19 format-1 character records without changing their artwork', () => {
    const result = generateForestClearing({
      seed: 'early-fey',
      density: 'Balanced',
      character: 'Fey',
    });
    if (!result.ok) throw new Error(result.error);
    const initial = record(result.map, { saveFormatVersion: '1.0.0' });
    const parsed = parseSavedMap(initial);
    expect(parsed).toEqual({ ...initial, saveFormatVersion: '2.0.0' });
    expect(initial.saveFormatVersion).toBe('1.0.0');
  });

  test('requires a character on current forest models before they are considered usable', () => {
    const invalid = corruptRecord(forest.map, (m) => {
      delete m.decoration['character'];
    });
    expect(parseSavedMap(invalid)).toBeUndefined();
    expect(
      isUsableMap({
        ...forest.map,
        decoration: { ...forest.map.decoration, character: undefined },
      }),
    ).toBe(false);
  });

  test('keeps format-1 dungeon saves readable while upgrading their record version', () => {
    const legacy = record(dungeon.map, { saveFormatVersion: '1.0.0' });
    expect(parseBundle(bundle([legacy], '1.0.0'))).toEqual({
      ok: true,
      maps: [{ ...legacy, saveFormatVersion: '2.0.0' }],
      skipped: 0,
    });
  });

  test('rejects forest maps with an unknown character', () => {
    expect(
      parseSavedMap(corruptRecord(forest.map, (m) => (m.decoration['character'] = 'Meadow'))),
    ).toBeUndefined();
  });

  test('rejects a corrupt map body even when the wrapper looks right', () => {
    const corrupt = { ...record(dungeon.map) };
    if (corrupt.map.type !== 'dungeon') throw new Error('Expected dungeon');
    corrupt.map = {
      ...corrupt.map,
      layout: { ...corrupt.map.layout, tiles: corrupt.map.layout.tiles.slice(0, 100) },
    };
    expect(parseSavedMap(corrupt)).toBeUndefined();
  });

  test('bundle parser enforces an explicit save-format version policy', () => {
    const good = record(dungeon.map);

    expect(parseBundle('not json')).toEqual({ ok: false, error: 'That backup is not valid JSON.' });
    expect(parseBundle('{"format":"other","saveFormatVersion":"1.0.0","maps":[]}')).toEqual({
      ok: false,
      error: 'That file is not an Encounter Map Forge backup.',
    });
    expect(parseBundle('[]')).toEqual({
      ok: false,
      error: 'That file is not an Encounter Map Forge backup.',
    });
    expect(parseBundle(bundle([], '99.0.0'))).toEqual({
      ok: false,
      error: 'That backup uses a save format this version of Encounter Map Forge cannot read.',
    });
    expect(parseBundle(bundle([], 'banana'))).toEqual({
      ok: false,
      error: 'That backup uses a save format this version of Encounter Map Forge cannot read.',
    });
    expect(
      parseBundle(JSON.stringify({ format: BACKUP_FORMAT, saveFormatVersion: '1.0.0' })),
    ).toEqual({
      ok: false,
      error: 'That backup is not a valid map library.',
    });

    const bad = { ...good, id: 'bad id' };
    const mixed = parseBundle(bundle([good, bad]));
    expect(mixed).toEqual({ ok: true, maps: [good], skipped: 1 });

    expect(parseBundle(bundle([bad]))).toEqual({
      ok: false,
      error: 'None of the maps in that backup could be read. They may use a newer save format.',
    });
  });

  test('applies one name policy across default, normalize, and duplicate', () => {
    const long = 'x'.repeat(64);
    expect(defaultMapName({ ...dungeon.map, seed: long }).length).toBeLessThanOrEqual(64);
    expect(duplicateName(long)).toBe('x'.repeat(57) + ' (copy)');
    expect(duplicateName(long).length).toBe(64);
    expect(normalizeName('  padded  ')).toBe('padded');
    expect(normalizeName('y'.repeat(100)).length).toBe(64);
    expect(parseSavedMap(record(dungeon.map, { name: 'x'.repeat(64) }))).toBeDefined();
  });

  test('deduplicates by id within an imported batch and against existing records', () => {
    const a = record(dungeon.map, { id: 'a' });
    const a2 = record(dungeon.map, { id: 'a' });
    const b = record(dungeon.map, { id: 'b' });

    const first = uniqueById([a, a2, b], new Set<string>());
    expect(first).toEqual({ fresh: [a, b], skipped: 1 });

    const second = uniqueById([a, b], new Set(['a']));
    expect(second).toEqual({ fresh: [b], skipped: 1 });
  });

  test('records the save-format version for future compatibility checks', () => {
    expect(record(dungeon.map).saveFormatVersion).toBe(SAVE_FORMAT_VERSION);
    expect(record(forest.map).map.version).toBe('4.0.0');
  });
});
