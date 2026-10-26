import { expect, test } from 'vitest';
import { generateDungeon } from '../engine/generate';
import { makeSavedMap, parseSavedMap, parseBundle, serializeBundle } from './save-format';

function record() {
  const result = generateDungeon({
    seed: 'mosslit-sanctum',
    roomCount: 6,
    preset: 'Mosslit',
    density: 'Balanced',
    scene: 'Forgotten study',
    landmark: 'weathered-statue',
  });
  if (!result.ok) throw new Error(result.error);
  return makeSavedMap(
    result.map,
    'Statue and study',
    'data:image/png;base64,AAAA',
    'statue',
    '2026-10-26T10:00:00Z',
  );
}

test('statue snapshots round-trip in format 7 and historical vocabularies reject new metadata and objects', () => {
  const saved = record();
  expect(saved.saveFormatVersion).toBe('7.0.0');
  expect(parseSavedMap(saved)).toEqual(saved);
  expect(parseBundle(serializeBundle([saved]))).toEqual({ ok: true, maps: [saved], skipped: 0 });
  for (const saveFormatVersion of ['1.0.0', '2.0.0', '3.0.0', '4.0.0', '5.0.0', '6.0.0']) {
    expect(parseSavedMap({ ...saved, saveFormatVersion })).toBeUndefined();
    expect(
      parseSavedMap({
        ...saved,
        saveFormatVersion,
        map: {
          ...saved.map,
          decoration: { ...saved.map.decoration, scene: undefined, landmark: 'None', props: [] },
        },
      }),
    ).toBeUndefined();
  }
});

test.each([
  'unknown',
  'missing',
  'incomplete',
  'duplicate',
  'nonblocking',
  'overlap',
  'entrance',
  'study',
  'off grid',
])('rejects a saved statue with %s data', (corruption) => {
  const saved = record();
  const map = saved.map;
  if (map.type !== 'dungeon') throw new Error('Expected dungeon');
  const props = map.decoration.props.map((p) => ({ ...p }));
  const statue = props.find((p) => p.kind === 'weathered_statue');
  if (!statue) throw new Error('Expected statue');
  let landmark: unknown = map.decoration.landmark;
  if (corruption === 'unknown') landmark = 'standing-stone-circle';
  if (corruption === 'missing') landmark = undefined;
  if (corruption === 'incomplete') props.splice(props.indexOf(statue), 1);
  if (corruption === 'duplicate') props.push({ ...statue });
  if (corruption === 'nonblocking') statue.blocking = false;
  if (corruption === 'overlap') props.push({ ...statue, kind: 'moss', blocking: false });
  if (corruption === 'entrance') {
    statue.x = map.layout.entrance.x;
    statue.y = map.layout.entrance.y;
  }
  if (corruption === 'study') {
    const desk = props.find((p) => p.kind === 'desk');
    if (!desk) throw new Error('Expected study');
    statue.x = desk.x;
    statue.y = desk.y;
  }
  if (corruption === 'off grid') statue.x = 40;
  expect(
    parseSavedMap({
      ...saved,
      map: { ...map, decoration: { ...map.decoration, landmark, props } },
    }),
  ).toBeUndefined();
});
