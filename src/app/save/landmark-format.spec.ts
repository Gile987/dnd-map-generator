import { expect, test } from 'vitest';
import { generateForestClearing } from '../engine/forest-generate';
import { makeSavedMap, parseBundle, parseSavedMap, serializeBundle } from './save-format';

function record() {
  const result = generateForestClearing({
    seed: 'mosslit-sanctum',
    character: 'Verdant',
    density: 'Balanced',
    scene: 'Abandoned camp',
    landmark: 'Suggested landmark',
  });
  if (!result.ok) throw new Error(result.error);
  return makeSavedMap(
    result.map,
    'Stone circle',
    'data:image/png;base64,AAAA',
    'circle',
    '2026-10-23T10:00:00Z',
  );
}

test('format 5 preserves a landmark and camp together; older vocabularies reject both metadata and stones', () => {
  const saved = record();
  expect(saved.saveFormatVersion).toBe('5.0.0');
  expect(parseSavedMap(saved)).toEqual(saved);
  expect(parseBundle(serializeBundle([saved]))).toEqual({ ok: true, maps: [saved], skipped: 0 });
  for (const saveFormatVersion of ['1.0.0', '2.0.0', '3.0.0', '4.0.0']) {
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
