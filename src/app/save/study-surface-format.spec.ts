import { expect, test } from 'vitest';
import { generateDungeon } from '../engine/generate';
import { generateForestClearing } from '../engine/forest-generate';
import { generateCourtyard } from '../engine/courtyard-generate';
import {
  makeSavedMap,
  parseBundle,
  parseSavedMap,
  serializeBundle,
  SAVE_FORMAT_VERSION,
} from './save-format';
import { isUsableMap } from './map-schema';

function record() {
  const result = generateDungeon({
    seed: 'forgotten-library',
    roomCount: 6,
    density: 'Balanced',
    preset: 'Mosslit',
    scene: 'Forgotten study',
  });
  if (!result.ok) throw new Error(result.error);
  return makeSavedMap(
    result.map,
    'Study',
    'data:image/png;base64,AAAA',
    'study',
    '2026-10-28T13:00:00Z',
  );
}

test('current format preserves new surface artwork through backup round trips', () => {
  const saved = record();
  expect(saved.saveFormatVersion).toBe(SAVE_FORMAT_VERSION);
  expect(saved.map.decoration).toHaveProperty('studySurface', 1);
  expect(parseBundle(serializeBundle([saved]))).toEqual({ ok: true, maps: [saved], skipped: 0 });
});

test.each([0, 2, '1', null, true, {}, []])(
  'rejects unsupported study artwork marker %j without dropping it',
  (studySurface) => {
    const saved = record();
    const map = { ...saved.map, decoration: { ...saved.map.decoration, studySurface } };
    expect(isUsableMap(map)).toBe(false);
    expect(parseSavedMap({ ...saved, map })).toBeUndefined();
  },
);

test('surface metadata requires a study and cannot be smuggled into another map type', () => {
  const dungeon = generateDungeon({
    seed: 'surface',
    roomCount: 6,
    density: 'Balanced',
    preset: 'Mosslit',
  });
  const forest = generateForestClearing({
    seed: 'surface',
    density: 'Balanced',
    character: 'Verdant',
  });
  const courtyard = generateCourtyard({
    character: 'Overgrown',
    seed: 'surface',
    density: 'Balanced',
    fountain: false,
  });
  for (const result of [dungeon, forest, courtyard]) {
    if (!result.ok) throw new Error(result.error);
    const saved = makeSavedMap(
      result.map,
      'Map',
      'data:image/png;base64,AAAA',
      'map',
      '2026-10-28T13:00:00Z',
    );
    const map = { ...result.map, decoration: { ...result.map.decoration, studySurface: 1 } };
    expect(isUsableMap(map)).toBe(false);
    expect(parseSavedMap({ ...saved, map })).toBeUndefined();
  }
});
