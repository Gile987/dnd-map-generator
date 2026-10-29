import { expect, test } from 'vitest';
import { generateForestClearing } from '../engine/forest-generate';
import { makeSavedMap, parseBundle, parseSavedMap, serializeBundle } from './save-format';

function campRecord() {
  const result = generateForestClearing({
    seed: 'mosslit-sanctum',
    density: 'Balanced',
    character: 'Verdant',
    scene: 'Abandoned camp',
  });
  if (!result.ok) throw new Error(result.error);
  // Historical vocabulary cases retain an unmarked snapshot.
  const { forestSurface, ...decoration } = result.map.decoration;
  expect(forestSurface).toBe(1);
  return makeSavedMap(
    { ...result.map, decoration },
    'Camp',
    'data:image/png;base64,AAAA',
    'camp',
    '2026-10-23T10:00:00Z',
  );
}

test('a camp round-trips through current format without changing its saved model', () => {
  const record = campRecord();
  expect(record.saveFormatVersion).toBe('12.0.0');
  expect(parseSavedMap(record)).toEqual(record);
  expect(parseSavedMap({ ...record, saveFormatVersion: '3.0.0' })).toEqual(record);
  expect(parseSavedMap({ ...record, saveFormatVersion: '4.0.0' })).toEqual(record);
  expect(parseBundle(serializeBundle([record]))).toEqual({ ok: true, maps: [record], skipped: 0 });
  for (const saveFormatVersion of ['1.0.0', '2.0.0']) {
    expect(parseSavedMap({ ...record, saveFormatVersion })).toBeUndefined();
    // Even removing the new prop kinds cannot sneak scene metadata into an old vocabulary.
    expect(
      parseSavedMap({
        ...record,
        saveFormatVersion,
        map: { ...record.map, decoration: { ...record.map.decoration, scene: 'None', props: [] } },
      }),
    ).toBeUndefined();
  }
});

test.each([
  'unknown scene',
  'missing scene',
  'incomplete camp',
  'overlap',
  'on route',
  'wrong blocking',
] as const)('rejects a saved camp with %s', (kind) => {
  const record = campRecord();
  const map = structuredClone(record.map);
  if (map.type !== 'forest') throw new Error('Expected forest');
  const props = map.decoration.props.map((prop) => ({ ...prop }));
  const tent = props.find((p) => p.kind === 'tent');
  const bedroll = props.find((p) => p.kind === 'bedroll');
  if (!tent || !bedroll) throw new Error('Expected camp props');
  let scene: unknown = map.decoration.scene;
  if (kind === 'unknown scene') scene = 'Village';
  if (kind === 'missing scene') scene = undefined;
  if (kind === 'incomplete camp') props.splice(props.indexOf(tent), 1);
  if (kind === 'overlap') {
    bedroll.x = tent.x;
    bedroll.y = tent.y;
  }
  if (kind === 'on route') {
    bedroll.x = map.layout.pathStart.x;
    bedroll.y = map.layout.pathStart.y;
  }
  if (kind === 'wrong blocking') tent.blocking = false;
  expect(
    parseSavedMap({ ...record, map: { ...map, decoration: { ...map.decoration, scene, props } } }),
  ).toBeUndefined();
});
