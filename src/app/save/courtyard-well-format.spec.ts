import { expect, test } from 'vitest';
import fixture from './fixtures/courtyard-current.json';
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

test('current format round-trips a stone well and its editing capabilities', () => {
  const record = saved(),
    before = structuredClone(record);
  expect(record.saveFormatVersion).toBe(SAVE_FORMAT_VERSION);
  expect(parseSavedMap(record)?.map).toBe(record.map);
  expect(parseBundle(serializeBundle([record]))).toEqual({ ok: true, maps: [record], skipped: 0 });
  expect(saveVocabulary(SAVE_FORMAT_VERSION)?.courtyardWells).toEqual([true]);
  expect(saveVocabulary(SAVE_FORMAT_VERSION)?.courtyardEditVersions).toEqual([1, 2]);
  expect(record).toEqual(before);
});

test('current courtyard snapshots acquire a well only through an explicit appearance action', () => {
  const restored = parseSavedMap(fixture.maps[1]);
  if (!restored || restored.map.type !== 'courtyard' || restored.map.objectEdits !== undefined)
    throw new Error('Missing current courtyard');
  const base = restored.map;
  const applied = changeCourtyardAppearance(base, { ...base.decoration, well: true });
  expect(applied.layout).toBe(base.layout);
  expect(applied.version).toBe(base.version);
  expect(applied.decoration.well).toBe(true);
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
