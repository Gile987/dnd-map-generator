import { expect, test } from 'vitest';
import { generateTower, changeTowerAppearance } from '../engine/tower';
import {
  makeSavedMap,
  parseSavedMap,
  serializeBundle,
  parseBundle,
  SAVE_FORMAT_VERSION,
} from './save-format';
import { isUsableMap } from './map-schema';
import { generateDungeon } from '../engine/generate';
import { generateForestClearing } from '../engine/forest-generate';
import { generateCourtyard } from '../engine/courtyard-generate';

function saved() {
  const r = generateTower({
    seed: 'astral-watch',
    floorCount: 4,
    portalFloor: null,
    density: 'Balanced',
    laboratoryFloor: 2,
    observatoryFloor: 4,
  });
  if (!r.ok) throw new Error(r.error);
  return makeSavedMap(
    r.map,
    'Observatory',
    'data:image/png;base64,AAAA',
    'observatory',
    '2026-10-30T12:00:00Z',
  );
}
test('current format round-trips a canonical observatory', () => {
  const record = saved(),
    before = structuredClone(record);
  expect(record.saveFormatVersion).toBe(SAVE_FORMAT_VERSION);
  expect(parseSavedMap(record)?.map).toBe(record.map);
  expect(parseBundle(serializeBundle([record]))).toEqual({ ok: true, maps: [record], skipped: 0 });
  expect(record).toEqual(before);
});
test('corrupt, incomplete, moved or conflicting observatory data is rejected and valid data remains recoverable', () => {
  const record = saved(),
    map = record.map;
  if (map.type !== 'tower' || !!map.objectEdits) throw new Error('Expected tower');
  const telescope = map.decoration.props.find((p) => p.kind === 'telescope');
  if (!telescope) throw new Error('Missing telescope');
  const candidates: unknown[] = [];
  for (const observatoryFloor of [undefined, null, 0, 5, 2, -1, 1.5, '4', NaN, Infinity, {}])
    candidates.push({ ...map, decoration: { ...map.decoration, observatoryFloor } });
  candidates.push(
    {
      ...map,
      decoration: { ...map.decoration, props: map.decoration.props.filter((p) => p !== telescope) },
    },
    { ...map, decoration: { ...map.decoration, props: [...map.decoration.props, telescope] } },
  );
  for (const changes of [
    { blocking: false },
    { kind: 'crate' },
    { variation: 0.5 },
    { x: telescope.x + 1 },
    { rotation: 1 },
    { footprint: { width: 2, height: 2 } },
  ])
    candidates.push({
      ...map,
      decoration: {
        ...map.decoration,
        props: map.decoration.props.map((p) => (p === telescope ? { ...p, ...changes } : p)),
      },
    });
  for (const candidate of candidates) {
    expect(isUsableMap(candidate)).toBe(false);
    expect(parseSavedMap({ ...record, map: candidate })).toBeUndefined();
  }
  expect(parseSavedMap(record)?.map).toBe(map);
});

test('current laboratories remain readable and observatory metadata is rejected on other map types', () => {
  const record = saved(),
    map = record.map;
  if (map.type !== 'tower' || !!map.objectEdits) throw new Error('Expected tower');
  const laboratory = changeTowerAppearance(map, {
    seed: map.seed,
    floorCount: 4,
    portalFloor: null,
    density: 'Balanced',
    laboratoryFloor: 2,
  });
  expect(parseSavedMap({ ...record, map: laboratory })?.map).toBe(laboratory);
  for (const result of [
    generateDungeon({ seed: 'observatory', roomCount: 6, preset: 'Mosslit', density: 'Balanced' }),
    generateForestClearing({ seed: 'observatory', character: 'Verdant', density: 'Balanced' }),
    generateCourtyard({
      character: 'Overgrown',
      seed: 'observatory',
      fountain: false,
      density: 'Balanced',
    }),
  ]) {
    if (!result.ok) throw new Error(result.error);
    for (const decoration of [
      { ...result.map.decoration, observatoryFloor: 1 },
      {
        ...result.map.decoration,
        props: [
          ...result.map.decoration.props,
          { kind: 'telescope', x: 1, y: 1, blocking: true, variation: 0.25 },
        ],
      },
    ]) {
      const candidate = { ...result.map, decoration };
      expect(isUsableMap(candidate)).toBe(false);
      expect(parseSavedMap({ ...record, map: candidate })).toBeUndefined();
    }
  }
});
