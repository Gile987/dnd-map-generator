import { expect, test } from 'vitest';
import { generateForestClearing, changeForestAppearance } from '../engine/forest-generate';
import { generateDungeon } from '../engine/generate';
import { generateCourtyard } from '../engine/courtyard-generate';
import { generateTower } from '../engine/tower';
import {
  makeSavedMap,
  parseSavedMap,
  serializeBundle,
  parseBundle,
  saveVocabulary,
  SAVE_FORMAT_VERSION,
} from './save-format';
import { isUsableMap } from './map-schema';
import fixture from './fixtures/forest-v3.json';

function saved() {
  const r = generateForestClearing({
    seed: 'woodland-glade',
    character: 'Verdant',
    density: 'Balanced',
    fallenTree: true,
    scene: 'Abandoned camp',
    landmark: 'standing-stone-circle',
  });
  if (!r.ok) throw new Error(r.error);
  return makeSavedMap(
    r.map,
    'Fallen tree',
    'data:image/png;base64,AAAA',
    'fallen-tree',
    '2026-11-02T12:00:00Z',
  );
}
test('format 18 preserves a complete tree and freezes earlier vocabularies', () => {
  const record = saved(),
    before = structuredClone(record);
  expect(record.saveFormatVersion).toBe(SAVE_FORMAT_VERSION);
  expect(parseSavedMap({ ...record, saveFormatVersion: '18.0.0' })?.map).toBe(record.map);
  expect(parseSavedMap(record)?.map).toBe(record.map);
  expect(parseBundle(serializeBundle([record]))).toEqual({ ok: true, maps: [record], skipped: 0 });
  for (let v = 1; v <= 17; v++) {
    const vocabulary = saveVocabulary(`${v}.0.0`);
    expect(vocabulary?.forestFallenTrees).toBeUndefined();
    expect(vocabulary?.propKinds).not.toContain('fallen_trunk');
    expect(vocabulary?.propFootprints?.['fallen_trunk']).toBeUndefined();
    expect(parseSavedMap({ ...record, saveFormatVersion: `${v}.0.0` })).toBeUndefined();
  }
  expect(record).toEqual(before);
});
test('historical Forest models retain absent tree metadata through loading and backup and opt in explicitly', () => {
  const before = structuredClone(fixture),
    parsed = parseBundle(JSON.stringify(fixture));
  if (!parsed.ok) throw new Error(parsed.error);
  expect(parsed.maps.length).toBeGreaterThan(0);
  for (const record of parsed.maps) {
    const map = record.map;
    if (map.type !== 'forest' || !!map.objectEdits) throw new Error('Expected forest');
    expect(map.decoration).not.toHaveProperty('fallenTree');
    expect(parseSavedMap(record)?.map).toBe(map);
    const changed = changeForestAppearance(map, { ...map.decoration, fallenTree: true });
    expect(changed.decoration.fallenTree).toBe(true);
    expect(changed.layout).toBe(map.layout);
    expect(changed.version).toBe(map.version);
    expect(isUsableMap(changed)).toBe(true);
  }
  expect(parseBundle(serializeBundle(parsed.maps))).toEqual(parsed);
  expect(fixture).toEqual(before);
});
test('malformed or incomplete tree scenes and footprints are rejected while valid records remain readable', () => {
  const record = saved(),
    map = record.map;
  if (map.type !== 'forest' || !!map.objectEdits) throw new Error('Expected forest');
  const body = map.decoration.props.find((p) => p.kind === 'fallen_trunk');
  if (!body) throw new Error('Missing trunk');
  const candidates: unknown[] = [];
  for (const fallenTree of [undefined, false, null, 'yes', 1, {}])
    candidates.push({ ...map, decoration: { ...map.decoration, fallenTree } });
  for (const changes of [
    { x: body.x + 1 },
    { blocking: false },
    { variation: 0.8 },
    { rotation: 3 },
    { footprint: { width: 1e100, height: 1 } },
  ])
    candidates.push({
      ...map,
      decoration: {
        ...map.decoration,
        props: map.decoration.props.map((p) => (p === body ? { ...p, ...changes } : p)),
      },
    });
  for (const kind of ['fallen_trunk', 'fallen_roots', 'fallen_branch', 'fallen_fungi'])
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
test('other map types reject fallen-tree fields and objects', () => {
  const record = saved();
  for (const r of [
    generateDungeon({ seed: 'tree', roomCount: 6, preset: 'Mosslit', density: 'Balanced' }),
    generateCourtyard({
      character: 'Overgrown',
      seed: 'tree',
      fountain: true,
      density: 'Balanced',
    }),
    generateTower({ seed: 'tree', floorCount: 4, portalFloor: null, density: 'Balanced' }),
  ]) {
    if (!r.ok) throw new Error(r.error);
    for (const decoration of [
      { ...r.map.decoration, fallenTree: true },
      {
        ...r.map.decoration,
        props: [
          ...r.map.decoration.props,
          { kind: 'fallen_roots', x: 1, y: 1, blocking: true, variation: 0.4 },
        ],
      },
    ]) {
      const candidate = { ...r.map, decoration };
      expect(isUsableMap(candidate)).toBe(false);
      expect(parseSavedMap({ ...record, map: candidate })).toBeUndefined();
    }
  }
});
