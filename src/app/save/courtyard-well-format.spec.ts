import { expect, test } from 'vitest';
import { generateCourtyard, changeCourtyardAppearance } from '../engine/courtyard-generate';
import { generateTower } from '../engine/tower';
import { generateDungeon } from '../engine/generate';
import { generateForestClearing } from '../engine/forest-generate';
import {
  makeSavedMap,
  parseSavedMap,
  serializeBundle,
  parseBundle,
  saveVocabulary,
  SAVE_FORMAT_VERSION,
} from './save-format';
import { isUsableMap } from './map-schema';

function saved() {
  const r = generateCourtyard({
    character: 'Overgrown',
    seed: 'ivy-court',
    density: 'Balanced',
    fountain: true,
    well: true,
  });
  if (!r.ok) throw new Error(r.error);
  return makeSavedMap(
    r.map,
    'Well courtyard',
    'data:image/png;base64,AAAA',
    'well',
    '2026-11-09T12:00:00Z',
  );
}

test('format 30 round-trips a stone well and freezes all earlier vocabularies', () => {
  const record = saved(),
    before = structuredClone(record);
  expect(record.saveFormatVersion).toBe(SAVE_FORMAT_VERSION);
  expect(parseSavedMap(record)?.map).toBe(record.map);
  expect(parseBundle(serializeBundle([record]))).toEqual({ ok: true, maps: [record], skipped: 0 });
  for (let v = 1; v <= 29; v++) {
    const vocabulary = saveVocabulary(`${v}.0.0`);
    expect(vocabulary?.courtyardWells).toBeUndefined();
    expect(vocabulary?.propKinds).not.toContain('stone_well');
    expect(vocabulary?.propFootprints?.['stone_well']).toBeUndefined();
    expect(vocabulary?.courtyardEditVersions?.includes(2) ?? false).toBe(false);
    expect(parseSavedMap({ ...record, saveFormatVersion: `${v}.0.0` })).toBeUndefined();
  }
  expect(saveVocabulary(SAVE_FORMAT_VERSION)?.courtyardWells).toEqual([true]);
  expect(saveVocabulary(SAVE_FORMAT_VERSION)?.courtyardEditVersions).toEqual([1, 2]);
  expect(record).toEqual(before);
});

test('old courtyards keep absent well metadata and exact artwork until the explicit addition', () => {
  const r = generateCourtyard({
    character: 'Overgrown',
    seed: 'ivy-court',
    density: 'Balanced',
    fountain: true,
  });
  if (!r.ok) throw new Error(r.error);
  const record = saved();
  for (let version = 9; version <= 29; version++) {
    const parsed = parseSavedMap({ ...record, map: r.map, saveFormatVersion: `${version}.0.0` });
    expect(parsed?.map).toBe(r.map);
    expect(parsed?.map.decoration).not.toHaveProperty('well');
  }
  expect(
    changeCourtyardAppearance(r.map, {
      character: 'Overgrown',
      density: 'Balanced',
      fountain: true,
      well: true,
    }),
  ).toEqual(record.map);
});

test('missing, moved, duplicate, oversized or inconsistent well placements are rejected without losing valid records', () => {
  const record = saved(),
    map = record.map;
  if (map.type !== 'courtyard') throw new Error('Expected courtyard');
  const body = map.decoration.props.find((p) => p.kind === 'stone_well');
  if (!body) throw new Error('Missing body');
  const candidates: unknown[] = [];
  for (const well of [undefined, false, null, 1, 'yes', {}])
    candidates.push({ ...map, decoration: { ...map.decoration, well } });
  for (const changes of [
    { x: body.x + 1 },
    { y: body.y + 1 },
    { blocking: false },
    { variation: 0.6 },
    { rotation: 1 },
    { footprint: { width: 2, height: 1e99 } },
    { footprint: { width: 3, height: 2 } },
  ])
    candidates.push({
      ...map,
      decoration: {
        ...map.decoration,
        props: map.decoration.props.map((p) => (p === body ? { ...p, ...changes } : p)),
      },
    });
  candidates.push({
    ...map,
    decoration: {
      ...map.decoration,
      props: map.decoration.props.filter((p) => p.kind !== 'stone_well'),
    },
  });
  candidates.push({
    ...map,
    decoration: { ...map.decoration, props: [...map.decoration.props, body] },
  });
  for (const candidate of candidates) {
    expect(isUsableMap(candidate)).toBe(false);
    expect(parseSavedMap({ ...record, map: candidate })).toBeUndefined();
  }
  expect(parseSavedMap(record)?.map).toBe(map);
});

test('well metadata and object kinds are rejected on other map types', () => {
  const record = saved();
  for (const r of [
    generateDungeon({ seed: 'well', roomCount: 6, preset: 'Mosslit', density: 'Balanced' }),
    generateForestClearing({ seed: 'well', character: 'Verdant', density: 'Balanced' }),
    generateTower({ seed: 'well', floorCount: 4, portalFloor: null, density: 'Balanced' }),
  ]) {
    if (!r.ok) throw new Error(r.error);
    for (const decoration of [
      { ...r.map.decoration, well: true },
      {
        ...r.map.decoration,
        props: [
          ...r.map.decoration.props,
          { kind: 'stone_well', x: 1, y: 1, blocking: true, variation: 0.35 },
        ],
      },
    ]) {
      const candidate = { ...r.map, decoration };
      expect(isUsableMap(candidate)).toBe(false);
      expect(parseSavedMap({ ...record, map: candidate })).toBeUndefined();
    }
  }
});
