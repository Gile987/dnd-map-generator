import { expect, test } from 'vitest';
import { generateDungeon } from '../engine/generate';
import { QUARTER_TURNS, propCells } from '../engine/prop-footprint';
import { contains } from '../engine/model';
import {
  makeSavedMap,
  parseSavedMap,
  parseBundle,
  serializeBundle,
  saveVocabulary,
} from './save-format';
import { mapUsesVocabulary } from './map-schema';

function record(seed = 'mosslit-sanctum') {
  const result = generateDungeon({
    seed,
    roomCount: 6,
    preset: 'Mosslit',
    density: 'Balanced',
    furniture: 'dining-table',
  });
  if (!result.ok) throw new Error(result.error);
  return makeSavedMap(
    result.map,
    'Dining room',
    'data:image/png;base64,AAAA',
    'table',
    '2026-10-26T10:00:00Z',
  );
}

test.each(QUARTER_TURNS)(
  'current and format-8 records preserve rotation %s and its exact saved footprint',
  (rotation) => {
    let saved = record();
    for (
      let seed = 0;
      seed < 64 &&
      !saved.map.decoration.props.some((p) => p.kind === 'dining_table' && p.rotation === rotation);
      seed++
    )
      saved = record(`furniture-save-${seed}`);
    expect(saved.map.decoration.props.find((p) => p.kind === 'dining_table')?.rotation).toBe(
      rotation,
    );
    expect(saved.saveFormatVersion).toBe('14.0.0');
    expect(parseSavedMap(saved)).toEqual(saved);
    expect(parseSavedMap({ ...saved, saveFormatVersion: '8.0.0' })).toEqual(saved);
    expect(parseBundle(serializeBundle([saved]))).toEqual({ ok: true, maps: [saved], skipped: 0 });
  },
);

test('historical vocabularies reject furniture metadata, kinds, and footprint fields', () => {
  const saved = record();
  for (const saveFormatVersion of ['1.0.0', '2.0.0', '3.0.0', '4.0.0', '5.0.0', '6.0.0', '7.0.0']) {
    expect(parseSavedMap({ ...saved, saveFormatVersion })).toBeUndefined();
    expect(
      parseSavedMap({
        ...saved,
        saveFormatVersion,
        map: {
          ...saved.map,
          decoration: { ...saved.map.decoration, props: [], furniture: 'None' },
        },
      }),
    ).toBeUndefined();
  }
  const vocabulary = saveVocabulary('8.0.0');
  if (!vocabulary) throw new Error('Missing vocabulary');
  const forged = {
    ...saved.map,
    decoration: {
      ...saved.map.decoration,
      props: [
        {
          x: 4,
          y: 4,
          kind: 'dining_table',
          blocking: true,
          variation: 0.3,
          footprint: { width: 3, height: 1 },
          rotation: 0,
        },
      ],
    },
  };
  expect(mapUsesVocabulary(forged, vocabulary)).toBe(false);
  expect(
    mapUsesVocabulary(forged, {
      ...vocabulary,
      propFootprints: { dining_table: { width: 3, height: 1, rotations: [0] } },
    }),
  ).toBe(true);
});

test.each([
  'unknown option',
  'missing option',
  'missing table',
  'duplicate',
  'missing footprint',
  'missing rotation',
  'wrong width',
  'huge footprint',
  'invalid rotation',
  'nonblocking',
  'second tile overlap',
  'off grid',
  'legacy footprint',
  'legacy rotation',
])('rejects furniture with %s', (corruption) => {
  const saved = record();
  const map = saved.map;
  if (map.type !== 'dungeon') throw new Error('Expected dungeon');
  const props = map.decoration.props.map((p) => ({ ...p }));
  const table = props.find((p) => p.kind === 'dining_table');
  if (!table) throw new Error('Expected table');
  let furniture: unknown = map.decoration.furniture;
  if (corruption === 'unknown option') furniture = 'Banquet hall';
  if (corruption === 'missing option') furniture = undefined;
  if (corruption === 'missing table') props.splice(props.indexOf(table), 1);
  if (corruption === 'duplicate') props.push({ ...table });
  if (corruption === 'missing footprint') table.footprint = undefined;
  if (corruption === 'missing rotation') table.rotation = undefined;
  if (corruption === 'wrong width') table.footprint = { width: 1, height: 1 };
  if (corruption === 'huge footprint') table.footprint = { width: 1e9, height: 1e9 };
  if (corruption === 'invalid rotation') table.rotation = 4 as never;
  if (corruption === 'nonblocking') table.blocking = false;
  if (corruption === 'off grid') table.x = 39;
  if (corruption === 'second tile overlap') {
    const second = propCells(table)[1];
    if (!second) throw new Error('Missing second tile');
    props.push({ ...second, kind: 'crate', blocking: true, variation: 0.3 });
  }
  if (corruption === 'legacy footprint')
    props.push({
      x: 4,
      y: 4,
      kind: 'crate',
      blocking: true,
      variation: 0.3,
      footprint: { width: 2, height: 1 },
    });
  if (corruption === 'legacy rotation')
    props.push({ x: 4, y: 4, kind: 'crate', blocking: true, variation: 0.3, rotation: 1 });
  expect(
    parseSavedMap({
      ...saved,
      map: { ...map, decoration: { ...map.decoration, furniture, props } },
    }),
  ).toBeUndefined();
});

test('an imported table is charged for two tiles even when its anchor fits a sparse budget', () => {
  for (let seed = 0; seed < 64; seed++) {
    const saved = record(`budget-${seed}`),
      map = saved.map;
    if (map.type !== 'dungeon') throw new Error('Expected dungeon');
    const table = map.decoration.props.find((p) => p.kind === 'dining_table');
    const room = table && map.layout.rooms.find((room) => contains(room, table));
    if (!table || !room || room.width * room.height >= 40) continue;
    expect(
      parseSavedMap({
        ...saved,
        map: { ...map, decoration: { ...map.decoration, props: [table], density: 'Balanced' } },
      }),
    ).toBeDefined();
    expect(
      parseSavedMap({
        ...saved,
        map: { ...map, decoration: { ...map.decoration, props: [table], density: 'Sparse' } },
      }),
    ).toBeUndefined();
    return;
  }
  throw new Error('Expected a table room with a one-tile sparse budget');
});
