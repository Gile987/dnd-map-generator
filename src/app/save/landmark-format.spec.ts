import { expect, test } from 'vitest';
import { generateForestClearing } from '../engine/forest-generate';
import { makeSavedMap, parseBundle, parseSavedMap, serializeBundle } from './save-format';

function record() {
  const result = generateForestClearing({
    seed: 'mosslit-sanctum',
    character: 'Verdant',
    density: 'Balanced',
    scene: 'Abandoned camp',
    landmark: 'standing-stone-circle',
  });
  if (!result.ok) throw new Error(result.error);
  // Historical vocabulary cases retain an unmarked snapshot.
  const { forestSurface, ...decoration } = result.map.decoration;
  expect(forestSurface).toBe(1);
  return makeSavedMap(
    { ...result.map, decoration },
    'Stone circle',
    'data:image/png;base64,AAAA',
    'circle',
    '2026-10-23T10:00:00Z',
  );
}

test('the current format preserves a landmark and camp together; older vocabularies reject both metadata and stones', () => {
  const saved = record();
  expect(saved.saveFormatVersion).toBe('12.0.0');
  expect(parseSavedMap(saved)).toEqual(saved);
  expect(parseSavedMap({ ...saved, saveFormatVersion: '6.0.0' })).toEqual(saved);
  expect(parseBundle(serializeBundle([saved]))).toEqual({ ok: true, maps: [saved], skipped: 0 });
  for (const saveFormatVersion of ['1.0.0', '2.0.0', '3.0.0', '4.0.0', '5.0.0']) {
    expect(parseSavedMap({ ...saved, saveFormatVersion })).toBeUndefined();
    // None was already part of format 5; only formats 1–4 must reject it.
    if (saveFormatVersion === '5.0.0') continue;
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
  'nonblocking',
  'overlap',
  'center occupied',
  'off floor',
])('rejects a landmark with %s data', (corruption) => {
  const saved = record();
  const map = saved.map;
  if (map.type !== 'forest') throw new Error('Expected forest');
  const props = map.decoration.props.map((p) => ({ ...p }));
  const stones = props.filter((p) => p.kind === 'standing_stone');
  const first = stones[0],
    second = stones[1];
  if (!first || !second) throw new Error('Expected stones');
  let landmark: unknown = map.decoration.landmark;
  const tiles = [...map.layout.tiles];
  if (corruption === 'unknown') landmark = 'Ancient tree';
  if (corruption === 'missing') landmark = undefined;
  if (corruption === 'incomplete') props.splice(props.indexOf(first), 1);
  if (corruption === 'nonblocking') first.blocking = false;
  if (corruption === 'overlap') {
    second.x = first.x;
    second.y = first.y;
  }
  if (corruption === 'center occupied')
    props.push({
      x: stones.reduce((n, p) => n + p.x, 0) / 6,
      y: stones.reduce((n, p) => n + p.y, 0) / 6,
      kind: 'fern',
      blocking: false,
      variation: 0.5,
    });
  if (corruption === 'off floor') tiles[first.y * 40 + first.x] = false;
  expect(
    parseSavedMap({
      ...saved,
      map: {
        ...map,
        layout: { ...map.layout, tiles },
        decoration: { ...map.decoration, landmark, props },
      },
    }),
  ).toBeUndefined();
});

test('format-5 landmark aliases migrate immutably while preserving all saved artwork data', () => {
  const current = record();
  const legacy = {
    ...current,
    saveFormatVersion: '5.0.0',
    map: {
      ...current.map,
      decoration: { ...current.map.decoration, landmark: 'Suggested landmark' },
    },
  };
  const before = structuredClone(legacy);
  const parsed = parseSavedMap(legacy);
  expect(parsed).toEqual(current);
  expect(legacy).toEqual(before);
  expect(
    parseBundle(
      JSON.stringify({
        format: 'encounter-map-forge-saves',
        saveFormatVersion: '5.0.0',
        maps: [legacy],
      }),
    ),
  ).toEqual({ ok: true, maps: [current], skipped: 0 });
  expect(JSON.parse(serializeBundle(parsed ? [parsed] : []))).toMatchObject({
    saveFormatVersion: '12.0.0',
    maps: [{ map: { decoration: { landmark: 'standing-stone-circle' } } }],
  });
  // Each format is checked before normalization; aliases cannot bypass its vocabulary.
  expect(parseSavedMap({ ...legacy, saveFormatVersion: '8.0.0' })).toBeUndefined();
  expect(parseSavedMap({ ...current, saveFormatVersion: '5.0.0' })).toBeUndefined();
  for (const saveFormatVersion of ['1.0.0', '2.0.0', '3.0.0', '4.0.0'])
    expect(parseSavedMap({ ...legacy, saveFormatVersion })).toBeUndefined();
  const invalid = {
    ...legacy,
    map: { ...legacy.map, decoration: { ...legacy.map.decoration, props: [] } },
  };
  expect(parseSavedMap(invalid)).toBeUndefined();
});
