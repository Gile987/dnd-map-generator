import { expect, test } from 'vitest';
import { generateCourtyard, shuffleCourtyardDetails } from '../engine/courtyard-generate';
import {
  makeSavedMap,
  parseBundle,
  parseSavedMap,
  saveVocabulary,
  serializeBundle,
} from './save-format';

const result = generateCourtyard({ seed: 'ivy-court', density: 'Balanced', fountain: true });
if (!result.ok) throw new Error(result.error);
const map = shuffleCourtyardDetails(result.map);
const record = makeSavedMap(
  map,
  'Courtyard',
  'data:image/png;base64,AAAA',
  'courtyard',
  '2026-10-26T12:00:00.000Z',
);

test('format 9 preserves courtyard models and artwork inputs exactly through records and backups', () => {
  expect(record.saveFormatVersion).toBe('12.0.0');
  expect(parseSavedMap(record)?.map).toBe(map);
  expect(parseBundle(serializeBundle([record]))).toEqual({ ok: true, maps: [record], skipped: 0 });
  for (const version of ['1.0.0', '2.0.0', '3.0.0', '4.0.0', '5.0.0', '6.0.0', '7.0.0', '8.0.0']) {
    expect(parseSavedMap({ ...record, saveFormatVersion: version })).toBeUndefined();
    const vocabulary = saveVocabulary(version);
    if (!vocabulary) throw new Error('Missing historical vocabulary');
    expect(vocabulary.mapTypes).not.toContain('courtyard');
    expect(vocabulary.propKinds).not.toContain('dry_fountain');
    expect(vocabulary.propKinds).not.toContain('low_rubble');
    expect(vocabulary.propFootprints?.['dry_fountain']).toBeUndefined();
  }
});

test('bounds unknown courtyard fields before geometry and rejects inconsistent movement or additions', () => {
  const invalid: unknown[] = [
    { ...map, layout: { ...map.layout, bounds: { ...map.layout.bounds, width: 1e100 } } },
    { ...map, layout: { ...map.layout, encounter: { ...map.layout.encounter, height: 0 } } },
    { ...map, layout: { ...map.layout, approaches: Array(2401).fill({ x: 0, y: 0 }) } },
    { ...map, layout: { ...map.layout, tiles: [true, false] } },
    { ...map, decoration: { ...map.decoration, fountain: undefined } },
    {
      ...map,
      decoration: {
        ...map.decoration,
        props: map.decoration.props.filter((p) => p.kind !== 'dry_fountain'),
      },
    },
    { ...map, decoration: { ...map.decoration, revision: 1e100 } },
  ];
  const fountain = map.decoration.props.find((p) => p.kind === 'dry_fountain');
  if (!fountain) throw new Error('Missing fountain');
  for (const changes of [
    { blocking: false },
    { rotation: 1 },
    { footprint: { width: 1e100, height: 3 } },
    { x: 0, y: 0 },
    { variation: NaN },
  ])
    invalid.push({
      ...map,
      decoration: {
        ...map.decoration,
        props: map.decoration.props.map((p) => (p === fountain ? { ...p, ...changes } : p)),
      },
    });
  const gate = map.layout.approaches[0];
  if (!gate) throw new Error('Missing approach');
  const ringTile = (fountain.y - 1) * 40 + fountain.x;
  const ringWall = [...map.layout.tiles];
  ringWall[ringTile] = false;
  invalid.push({ ...map, layout: { ...map.layout, tiles: ringWall } });
  invalid.push({
    ...map,
    decoration: {
      ...map.decoration,
      props: [
        ...map.decoration.props,
        { ...gate, kind: 'broken_column', blocking: true, variation: 0.5 },
      ],
    },
  });
  for (const candidate of invalid)
    expect(parseSavedMap({ ...record, map: candidate })).toBeUndefined();
  expect(parseSavedMap(record)?.map).toBe(map);
});
