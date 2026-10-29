import { expect, test } from 'vitest';
import { generateDungeon } from '../engine/generate';
import { generateForestClearing } from '../engine/forest-generate';
import { generateCourtyard } from '../engine/courtyard-generate';
import {
  makeSavedMap,
  parseBundle,
  parseSavedMap,
  serializeBundle,
  saveVocabulary,
} from './save-format';
import { isUsableMap, mapUsesVocabulary } from './map-schema';

function record() {
  const result = generateDungeon({
    seed: 'mosslit-sanctum',
    roomCount: 6,
    density: 'Balanced',
    preset: 'Mosslit',
    ritual: true,
  });
  if (!result.ok) throw new Error(result.error);
  return makeSavedMap(
    result.map,
    'Ritual site',
    'data:image/png;base64,AAAA',
    'ritual',
    '2026-10-28T15:00:00Z',
  );
}

test('format 11 round-trips exact ritual models and freezes older vocabularies', () => {
  const saved = record();
  expect(saved.saveFormatVersion).toBe('12.0.0');
  expect(parseSavedMap(saved)).toEqual(saved);
  expect(parseBundle(serializeBundle([saved]))).toEqual({ ok: true, maps: [saved], skipped: 0 });
  for (let version = 1; version <= 10; version++) {
    const saveFormatVersion = `${version}.0.0`;
    const vocabulary = saveVocabulary(saveFormatVersion);
    if (!vocabulary) throw new Error('Missing historical vocabulary');
    expect(
      mapUsesVocabulary(
        { ...saved.map, decoration: { ...saved.map.decoration, ritual: undefined } },
        vocabulary,
      ),
    ).toBe(false);
    expect(parseSavedMap({ ...saved, saveFormatVersion })).toBeUndefined();
    expect(
      parseSavedMap({
        ...saved,
        saveFormatVersion,
        map: { ...saved.map, decoration: { ...saved.map.decoration, ritual: false, props: [] } },
      }),
    ).toBeUndefined();
    expect(
      parseSavedMap({
        ...saved,
        saveFormatVersion,
        map: { ...saved.map, decoration: { ...saved.map.decoration, ritual: undefined } },
      }),
    ).toBeUndefined();
  }
});

test.each([
  'missing flag',
  'unknown flag',
  'incomplete',
  'duplicate',
  'wrong blocking',
  'misaligned',
  'wrong orientation',
  'overlap',
  'entrance',
  'off floor',
  'footprint',
] as const)('rejects a ritual snapshot with %s and recovers with valid data', (corruption) => {
  const saved = record();
  if (saved.map.type !== 'dungeon') throw new Error('Missing dungeon');
  const map = saved.map;
  const props = map.decoration.props.map((p) => ({ ...p }));
  const altar = props.find((p) => p.kind === 'ritual_altar');
  const candle = props.find((p) => p.kind === 'ritual_candles');
  if (!altar || !candle) throw new Error('Missing ritual props');
  let ritual: unknown = true;
  if (corruption === 'missing flag') ritual = undefined;
  if (corruption === 'unknown flag') ritual = 'yes';
  if (corruption === 'incomplete') props.splice(props.indexOf(candle), 1);
  if (corruption === 'duplicate') props.push({ ...candle });
  if (corruption === 'wrong blocking') candle.blocking = true;
  if (corruption === 'misaligned') candle.x++;
  if (corruption === 'wrong orientation') candle.variation = (candle.variation + 0.25) % 1;
  if (corruption === 'overlap') props.push({ ...candle, kind: 'moss' });
  if (corruption === 'entrance') {
    altar.x = map.layout.entrance.x;
    altar.y = map.layout.entrance.y;
  }
  if (corruption === 'off floor') altar.x = 0;
  if (corruption === 'footprint') {
    altar.footprint = { width: 2, height: 1 };
    altar.rotation = 0;
  }
  const invalid = { ...map, decoration: { ...map.decoration, ritual, props } };
  expect(isUsableMap(invalid)).toBe(false);
  expect(parseSavedMap({ ...saved, map: invalid })).toBeUndefined();
  expect(parseSavedMap(saved)).toEqual(saved);
});

test('ritual metadata cannot be attached to a forest or courtyard even when false', () => {
  const forest = generateForestClearing({
    seed: 'ritual',
    density: 'Balanced',
    character: 'Verdant',
  });
  const courtyard = generateCourtyard({ seed: 'ritual', density: 'Balanced', fountain: false });
  for (const result of [forest, courtyard]) {
    if (!result.ok) throw new Error(result.error);
    const saved = makeSavedMap(
      result.map,
      'Map',
      'data:image/png;base64,AAAA',
      'map',
      '2026-10-28T15:00:00Z',
    );
    for (const ritual of [true, false])
      expect(
        parseSavedMap({
          ...saved,
          map: { ...result.map, decoration: { ...result.map.decoration, ritual } },
        }),
      ).toBeUndefined();
  }
});
