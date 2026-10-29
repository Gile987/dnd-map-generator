import { expect, test } from 'vitest';
import { generateTower, changeTowerAppearance, towerStairStyle } from '../engine/tower';
import { generateDungeon } from '../engine/generate';
import { generateForestClearing } from '../engine/forest-generate';
import { generateCourtyard } from '../engine/courtyard-generate';
import {
  makeSavedMap,
  parseSavedMap,
  parseBundle,
  serializeBundle,
  saveVocabulary,
} from './save-format';
import { isUsableMap } from './map-schema';
import oldTower from './fixtures/tower-v1.json';
import sharedTower from './fixtures/tower-v2.json';
function laboratory() {
  const r = generateTower({
    seed: 'laboratory-format',
    floorCount: 6,
    portalFloor: 2,
    density: 'Balanced',
    stairStyle: 'separate',
    laboratoryFloor: 1,
  });
  if (!r.ok) throw new Error(r.error);
  return r.map;
}
function saved() {
  return makeSavedMap(
    laboratory(),
    'Laboratory',
    'data:image/png;base64,AAAA',
    'laboratory',
    '2026-10-29T12:00:00Z',
  );
}
test('format 15 preserves the full laboratory while older vocabularies stay frozen', () => {
  const record = saved(),
    before = structuredClone(record);
  expect(record.saveFormatVersion).toBe('15.0.0');
  expect(parseSavedMap(record)?.map).toBe(record.map);
  expect(parseBundle(serializeBundle([record]))).toEqual({ ok: true, maps: [record], skipped: 0 });
  for (let v = 1; v <= 14; v++) {
    expect(saveVocabulary(`${v}.0.0`)?.propKinds).not.toContain('cauldron');
    expect(saveVocabulary(`${v}.0.0`)?.towerLaboratoryFloors).toBeUndefined();
    expect(parseSavedMap({ ...record, saveFormatVersion: `${v}.0.0` })).toBeUndefined();
  }
  expect(record).toEqual(before);
});
test('corrupt laboratory placements and metadata are rejected without discarding the valid record', () => {
  const record = saved(),
    map = laboratory();
  const cauldron = map.decoration.props.find((p) => p.kind === 'cauldron');
  if (!cauldron) throw new Error('Missing cauldron');
  const candidates: unknown[] = [];
  for (const laboratoryFloor of [null, 0, 7, -1, 1.5, '1', NaN, Infinity, {}])
    candidates.push({ ...map, decoration: { ...map.decoration, laboratoryFloor } });
  candidates.push(
    { ...map, decoration: { ...map.decoration, laboratoryFloor: undefined } },
    {
      ...map,
      decoration: { ...map.decoration, props: map.decoration.props.filter((p) => p !== cauldron) },
    },
    { ...map, decoration: { ...map.decoration, props: [...map.decoration.props, cauldron] } },
  );
  for (const changes of [
    { blocking: false },
    { kind: 'crate' },
    { variation: 0.5 },
    { x: cauldron.x + 1 },
    { rotation: 1 },
    { footprint: { width: 2, height: 2 } },
  ])
    candidates.push({
      ...map,
      decoration: {
        ...map.decoration,
        props: map.decoration.props.map((p) => (p === cauldron ? { ...p, ...changes } : p)),
      },
    });
  for (const candidate of candidates) {
    expect(isUsableMap(candidate)).toBe(false);
    expect(parseSavedMap({ ...record, map: candidate })).toBeUndefined();
  }
  expect(parseSavedMap(record)?.map).toBe(record.map);
});
test('old tower snapshots acquire a laboratory only after an explicit appearance change', () => {
  for (const fixture of [oldTower, sharedTower]) {
    const before = structuredClone(fixture),
      parsed = parseBundle(JSON.stringify(fixture));
    if (!parsed.ok) throw new Error(parsed.error);
    for (const record of parsed.maps) {
      const map = record.map;
      if (map.type !== 'tower') throw new Error('Expected tower');
      expect(map.decoration).not.toHaveProperty('laboratoryFloor');
      const changed = changeTowerAppearance(map, {
        seed: map.seed,
        floorCount: map.layout.floors.length,
        portalFloor: map.layout.portalFloor,
        density: map.decoration.density,
        stairStyle: towerStairStyle(map),
        laboratoryFloor: 1,
      });
      expect(changed.decoration.laboratoryFloor).toBe(1);
      expect(changed.layout).toBe(map.layout);
      expect(changed.version).toBe(map.version);
      expect(isUsableMap(changed)).toBe(true);
    }
    expect(fixture).toEqual(before);
  }
});
test('laboratory metadata and cauldrons cannot be imported as other map types', () => {
  const results = [
    generateDungeon({
      seed: 'laboratory-type',
      roomCount: 6,
      preset: 'Mosslit',
      density: 'Balanced',
    }),
    generateForestClearing({ seed: 'laboratory-type', character: 'Verdant', density: 'Balanced' }),
    generateCourtyard({ seed: 'laboratory-type', fountain: false, density: 'Balanced' }),
  ];
  for (const result of results) {
    if (!result.ok) throw new Error(result.error);
    const record = makeSavedMap(
      result.map,
      'Other',
      'data:image/png;base64,AAAA',
      'other',
      '2026-10-29T12:00:00Z',
    );
    const candidate = {
      ...result.map,
      decoration: { ...result.map.decoration, laboratoryFloor: 1 },
    };
    expect(isUsableMap(candidate)).toBe(false);
    expect(parseSavedMap({ ...record, map: candidate })).toBeUndefined();
  }
});
