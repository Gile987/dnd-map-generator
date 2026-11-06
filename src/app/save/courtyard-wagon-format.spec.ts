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
} from './save-format';
import { isUsableMap } from './map-schema';
function saved() {
  const r = generateCourtyard({
    seed: 'ivy-court',
    density: 'Balanced',
    fountain: true,
    wagon: true,
  });
  if (!r.ok) throw new Error(r.error);
  return makeSavedMap(
    r.map,
    'Wagon courtyard',
    'data:image/png;base64,AAAA',
    'wagon',
    '2026-11-02T12:00:00Z',
  );
}

test('format 17 round-trips a complete wagon and freezes all earlier vocabularies', () => {
  const record = saved(),
    before = structuredClone(record);
  expect(record.saveFormatVersion).toBe('28.0.0');
  expect(parseSavedMap(record)?.map).toBe(record.map);
  expect(parseBundle(serializeBundle([record]))).toEqual({ ok: true, maps: [record], skipped: 0 });
  for (let v = 1; v <= 16; v++) {
    const vocabulary = saveVocabulary(`${v}.0.0`);
    expect(vocabulary?.courtyardWagons).toBeUndefined();
    expect(vocabulary?.propKinds).not.toContain('collapsed_wagon');
    expect(vocabulary?.propFootprints?.['collapsed_wagon']).toBeUndefined();
    expect(parseSavedMap({ ...record, saveFormatVersion: `${v}.0.0` })).toBeUndefined();
  }
  expect(record).toEqual(before);
});
test('old courtyards keep absent wagon metadata and exact artwork until the explicit addition', () => {
  const r = generateCourtyard({ seed: 'ivy-court', density: 'Balanced', fountain: true });
  if (!r.ok) throw new Error(r.error);
  const record = saved();
  for (let version = 9; version <= 16; version++) {
    const parsed = parseSavedMap({ ...record, map: r.map, saveFormatVersion: `${version}.0.0` });
    expect(parsed?.map).toBe(r.map);
    expect(parsed?.map.decoration).not.toHaveProperty('wagon');
  }
  expect(
    changeCourtyardAppearance(r.map, { density: 'Balanced', fountain: true, wagon: true }),
  ).toEqual(record.map);
});
test('missing, moved, duplicate, oversized or inconsistent wagon components are rejected without losing valid records', () => {
  const record = saved(),
    map = record.map;
  if (map.type !== 'courtyard') throw new Error('Expected courtyard');
  const body = map.decoration.props.find((p) => p.kind === 'collapsed_wagon');
  if (!body) throw new Error('Missing body');
  const candidates: unknown[] = [];
  for (const wagon of [undefined, false, null, 1, 'yes', {}])
    candidates.push({ ...map, decoration: { ...map.decoration, wagon } });
  for (const changes of [
    { x: body.x + 1 },
    { blocking: false },
    { variation: 0.6 },
    { rotation: 3 },
    { footprint: { width: 3, height: 1e99 } },
  ])
    candidates.push({
      ...map,
      decoration: {
        ...map.decoration,
        props: map.decoration.props.map((p) => (p === body ? { ...p, ...changes } : p)),
      },
    });
  for (const kind of ['collapsed_wagon', 'wagon_wheel', 'spilled_crate', 'spilled_goods'])
    candidates.push({
      ...map,
      decoration: { ...map.decoration, props: map.decoration.props.filter((p) => p.kind !== kind) },
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
test('wagon metadata and object kinds are rejected on other map types', () => {
  const record = saved();
  for (const r of [
    generateDungeon({ seed: 'wagon', roomCount: 6, preset: 'Mosslit', density: 'Balanced' }),
    generateForestClearing({ seed: 'wagon', character: 'Verdant', density: 'Balanced' }),
    generateTower({ seed: 'wagon', floorCount: 4, portalFloor: null, density: 'Balanced' }),
  ]) {
    if (!r.ok) throw new Error(r.error);
    for (const decoration of [
      { ...r.map.decoration, wagon: true },
      {
        ...r.map.decoration,
        props: [
          ...r.map.decoration.props,
          { kind: 'wagon_wheel', x: 1, y: 1, blocking: false, variation: 0.35 },
        ],
      },
    ]) {
      const candidate = { ...r.map, decoration };
      expect(isUsableMap(candidate)).toBe(false);
      expect(parseSavedMap({ ...record, map: candidate })).toBeUndefined();
    }
  }
});
