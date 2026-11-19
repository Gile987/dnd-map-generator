import { expect, test } from 'vitest';
import { generateTower } from '../engine/tower';
import { generateDungeon } from '../engine/generate';
import { generateForestClearing } from '../engine/forest-generate';
import { generateCourtyard } from '../engine/courtyard-generate';
import {
  makeSavedMap,
  parseSavedMap,
  parseBundle,
  serializeBundle,
  SAVE_FORMAT_VERSION,
} from './save-format';
import { isUsableMap } from './map-schema';
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
test('the current format preserves laboratories while pre-laboratory vocabularies stay frozen', () => {
  const record = saved(),
    before = structuredClone(record);
  expect(record.saveFormatVersion).toBe(SAVE_FORMAT_VERSION);
  expect(parseSavedMap(record)?.map).toBe(record.map);
  expect(parseBundle(serializeBundle([record]))).toEqual({ ok: true, maps: [record], skipped: 0 });
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
test('laboratory metadata and cauldrons cannot be imported as other map types', () => {
  const results = [
    generateDungeon({
      seed: 'laboratory-type',
      roomCount: 6,
      preset: 'Mosslit',
      density: 'Balanced',
    }),
    generateForestClearing({ seed: 'laboratory-type', character: 'Verdant', density: 'Balanced' }),
    generateCourtyard({
      character: 'Overgrown',
      seed: 'laboratory-type',
      fountain: false,
      density: 'Balanced',
    }),
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
