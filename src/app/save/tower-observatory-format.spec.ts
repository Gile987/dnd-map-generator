import { expect, test } from 'vitest';
import { generateTower, changeTowerAppearance, towerStairStyle } from '../engine/tower';
import {
  makeSavedMap,
  parseSavedMap,
  serializeBundle,
  parseBundle,
  saveVocabulary,
} from './save-format';
import { isUsableMap } from './map-schema';
import oldTower from './fixtures/tower-v1.json';
import sharedTower from './fixtures/tower-v2.json';
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
test('format 16 freezes observatory vocabulary while earlier readers and other map types reject it', () => {
  const record = saved(),
    before = structuredClone(record);
  expect(record.saveFormatVersion).toBe('16.0.0');
  expect(parseSavedMap(record)?.map).toBe(record.map);
  expect(parseBundle(serializeBundle([record]))).toEqual({ ok: true, maps: [record], skipped: 0 });
  for (let v = 1; v <= 15; v++) {
    expect(saveVocabulary(`${v}.0.0`)?.towerObservatoryFloors).toBeUndefined();
    expect(saveVocabulary(`${v}.0.0`)?.propKinds).not.toContain('telescope');
    expect(parseSavedMap({ ...record, saveFormatVersion: `${v}.0.0` })).toBeUndefined();
  }
  expect(record).toEqual(before);
});
test('corrupt, incomplete, moved or conflicting observatory data is rejected and valid data remains recoverable', () => {
  const record = saved(),
    map = record.map;
  if (map.type !== 'tower') throw new Error('Expected tower');
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
test('historical Tower models acquire an observatory only after an explicit appearance action', () => {
  for (const fixture of [oldTower, sharedTower]) {
    const before = structuredClone(fixture),
      parsed = parseBundle(JSON.stringify(fixture));
    if (!parsed.ok) throw new Error(parsed.error);
    for (const record of parsed.maps) {
      const map = record.map;
      if (map.type !== 'tower') throw new Error('Expected tower');
      expect(map.decoration).not.toHaveProperty('observatoryFloor');
      const changed = changeTowerAppearance(map, {
        seed: map.seed,
        floorCount: map.layout.floors.length,
        portalFloor: map.layout.portalFloor,
        stairStyle: towerStairStyle(map),
        density: map.decoration.density,
        observatoryFloor: 1,
      });
      expect(changed.decoration.observatoryFloor).toBe(1);
      expect(changed.layout).toBe(map.layout);
      expect(changed.version).toBe(map.version);
      expect(isUsableMap(changed)).toBe(true);
    }
    expect(fixture).toEqual(before);
  }
});

test('format-15 laboratories remain readable and observatory metadata is rejected on other map types', () => {
  const record = saved(),
    map = record.map;
  if (map.type !== 'tower') throw new Error('Expected tower');
  const laboratory = changeTowerAppearance(map, {
    seed: map.seed,
    floorCount: 4,
    portalFloor: null,
    density: 'Balanced',
    laboratoryFloor: 2,
  });
  expect(parseSavedMap({ ...record, map: laboratory, saveFormatVersion: '15.0.0' })?.map).toBe(
    laboratory,
  );
  for (const result of [
    generateDungeon({ seed: 'observatory', roomCount: 6, preset: 'Mosslit', density: 'Balanced' }),
    generateForestClearing({ seed: 'observatory', character: 'Verdant', density: 'Balanced' }),
    generateCourtyard({ seed: 'observatory', fountain: false, density: 'Balanced' }),
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
