import { expect, test } from 'vitest';
import fixture from './fixtures/forest-v4-surfaces.json';
import { generateForestClearing } from '../engine/forest-generate';
import { generateDungeon } from '../engine/generate';
import { generateCourtyard } from '../engine/courtyard-generate';
import { validateForest } from '../engine/forest-validation';
import { makeSavedMap, parseBundle, parseSavedMap, serializeBundle } from './save-format';
import { isUsableMap } from './map-schema';

function record() {
  const result = generateForestClearing({
    seed: 'mosslit-sanctum',
    density: 'Balanced',
    character: 'Verdant',
  });
  if (!result.ok) throw new Error(result.error);
  return makeSavedMap(
    result.map,
    'Surface forest',
    'data:image/png;base64,AAAA',
    'forest-surface',
    '2026-10-29T10:00:00Z',
  );
}

test('format 12 round-trips forest artwork metadata while all older vocabularies stay frozen', () => {
  const saved = record();
  expect(saved.saveFormatVersion).toBe('15.0.0');
  expect(saved.map.decoration).toHaveProperty('forestSurface', 1);
  expect(parseBundle(serializeBundle([saved]))).toEqual({ ok: true, maps: [saved], skipped: 0 });
  if (saved.map.type !== 'forest') throw new Error('Missing forest');
  const { forestSurface, ...decoration } = saved.map.decoration;
  expect(forestSurface).toBe(1);
  const historical = { ...saved, map: { ...saved.map, decoration } };
  for (let version = 1; version <= 11; version++) {
    const saveFormatVersion = `${version}.0.0`;
    expect(parseSavedMap({ ...saved, saveFormatVersion })).toBeUndefined();
    expect(parseSavedMap({ ...historical, saveFormatVersion })).toEqual(historical);
  }
});

test('loading, rewriting and backing up captured forests preserves every historical model and thumbnail', () => {
  const before = structuredClone(fixture);
  const parsed = parseBundle(JSON.stringify(fixture));
  if (!parsed.ok) throw new Error(parsed.error);
  expect(parsed.maps).toEqual(
    fixture.maps.map((entry) => ({ ...entry, saveFormatVersion: '15.0.0' })),
  );
  for (const entry of parsed.maps) expect(entry.map.decoration).not.toHaveProperty('forestSurface');
  expect(parseBundle(serializeBundle(parsed.maps))).toEqual(parsed);
  expect(fixture).toEqual(before);
});

test.each([0, 2, '1', null, true, {}, []])(
  'rejects unsupported forest surface marker %j without dropping it',
  (forestSurface) => {
    const saved = record();
    const map = { ...saved.map, decoration: { ...saved.map.decoration, forestSurface } };
    expect(isUsableMap(map)).toBe(false);
    expect(parseSavedMap({ ...saved, map })).toBeUndefined();
    if (saved.map.type !== 'forest') throw new Error('Missing forest');
    expect(
      validateForest({
        ...saved.map,
        decoration: { ...saved.map.decoration, forestSurface: forestSurface as never },
      }),
    ).toContain('surface');
    expect(parseBundle(serializeBundle([{ ...saved, map: map as never }, saved]))).toEqual({
      ok: true,
      maps: [saved],
      skipped: 1,
    });
  },
);

test('forest surface metadata is rejected on dungeons and courtyards', () => {
  const dungeon = generateDungeon({
    seed: 'surface',
    roomCount: 6,
    density: 'Balanced',
    preset: 'Mosslit',
  });
  const courtyard = generateCourtyard({ seed: 'surface', density: 'Balanced', fountain: false });
  for (const result of [dungeon, courtyard]) {
    if (!result.ok) throw new Error(result.error);
    const saved = makeSavedMap(
      result.map,
      'Map',
      'data:image/png;base64,AAAA',
      'map',
      '2026-10-29T10:00:00Z',
    );
    const map = { ...result.map, decoration: { ...result.map.decoration, forestSurface: 1 } };
    expect(isUsableMap(map)).toBe(false);
    expect(parseSavedMap({ ...saved, map })).toBeUndefined();
  }
});
