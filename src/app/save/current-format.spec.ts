import { expect, test } from 'vitest';
import forest from './fixtures/forest-current.json';
import courtyard from './fixtures/courtyard-current.json';
import tower from './fixtures/tower-current.json';
import study from './fixtures/study-current.json';
import { parseBundle, parseSavedMap, SAVE_FORMAT_VERSION, serializeBundle } from './save-format';

const snapshots = [...forest.maps, ...courtyard.maps, ...tower.maps, ...study.maps];

test.each(snapshots)(
  'current $map.type snapshots round-trip without changing their model',
  (record) => {
    const before = structuredClone(record);
    const parsed = parseSavedMap(record);
    expect(parsed).toEqual(record);
    expect(parsed?.map).toBe(record.map);
    expect(record).toEqual(before);
    if (!parsed) throw Error('Expected current record');
    expect(parseBundle(serializeBundle([parsed]))).toEqual({
      ok: true,
      maps: [parsed],
      skipped: 0,
    });
  },
);

test.each([
  ['dungeon', study.maps[0], ['1.0.0', '2.0.0', '3.0.0']],
  ['forest', forest.maps[0], ['1.0.0', '2.0.0', '3.0.0']],
  ['courtyard', courtyard.maps[0], ['1.0.0', '2.0.0', '3.0.0', '4.0.0']],
  ['tower', tower.maps[0], ['1.0.0', '2.0.0']],
] as const)(
  'rejects retired %s generators even under a current wrapper',
  (_type, record, versions) => {
    if (!record) throw Error('Missing fixture');
    for (const version of [...versions, '99.0.0']) {
      const candidate = { ...record, map: { ...record.map, version } };
      const before = structuredClone(candidate);
      expect(candidate.saveFormatVersion).toBe(SAVE_FORMAT_VERSION);
      expect(parseSavedMap(candidate)).toBeUndefined();
      expect(candidate).toEqual(before);
    }
  },
);

test('rejects missing current metadata and obsolete aliases instead of supplying defaults', () => {
  const woodland = forest.maps[0];
  const court = courtyard.maps[0];
  const library = study.maps[0];
  if (!woodland || !court || !library) throw Error('Missing fixtures');
  for (const [record, fields] of [
    [woodland, ['character', 'forestSurface']],
    [court, ['character']],
    [library, ['studySurface']],
  ] as const) {
    for (const field of fields) {
      const decoration: Record<string, unknown> = { ...record.map.decoration };
      delete decoration[field];
      expect(parseSavedMap({ ...record, map: { ...record.map, decoration } })).toBeUndefined();
    }
  }
  expect(
    parseSavedMap({
      ...woodland,
      map: {
        ...woodland.map,
        decoration: { ...woodland.map.decoration, landmark: 'Suggested landmark' },
      },
    }),
  ).toBeUndefined();
});

test.each([1, 2, 3])(
  'rejects retired dungeon edit version %s without stripping edits',
  (version) => {
    const record = study.maps[0];
    if (!record) throw Error('Missing fixture');
    const candidate = {
      ...record,
      map: {
        ...record.map,
        objectEdits: {
          version,
          nextId: 1,
          removed: ['base-0'],
          moves: [],
          added: [],
          ...(version > 1 ? { groups: [] } : {}),
        },
      },
    };
    const before = structuredClone(candidate);
    expect(parseSavedMap(candidate)).toBeUndefined();
    expect(candidate).toEqual(before);
  },
);
