import { expect, test } from 'vitest';
import {
  generateCourtyard,
  changeCourtyardAppearance,
  shuffleCourtyardDetails,
} from '../engine/courtyard-generate';
import fixture from './fixtures/courtyard-v24.json';
import { applyCourtyardCommand } from '../engine/object-editor/courtyard-commands';
import { courtyardInstances } from '../engine/object-editor/courtyard-document';
import { isUsableMap } from './map-schema';
import {
  makeSavedMap,
  parseBundle,
  parseSavedMap,
  saveVocabulary,
  serializeBundle,
  SAVE_FORMAT_VERSION,
} from './save-format';

function courtyard() {
  const result = generateCourtyard({
    seed: 'ivy-court',
    density: 'Balanced',
    character: 'Overgrown',
    fountain: true,
    wagon: true,
    well: true,
  });
  if (!result.ok) throw new Error(result.error);
  return result.map;
}

test('format 31 keeps the brazier object kind and old formats reject it', () => {
  const map = courtyard();
  const saved = makeSavedMap(
    map,
    'Courtyard with braziers',
    'data:image/png;base64,AAAA',
    'brazier',
    '2026-11-12T12:00:00Z',
  );
  expect(SAVE_FORMAT_VERSION).toBe('31.0.0');
  expect(map.decoration).not.toHaveProperty('brazier');
  expect(map.version).toBe('5.0.0');
  expect(parseSavedMap(saved)?.map).toEqual(map);
  expect(parseBundle(serializeBundle([saved]))).toEqual({ ok: true, maps: [saved], skipped: 0 });
  expect(saveVocabulary(SAVE_FORMAT_VERSION)?.propKinds).toContain('abandoned_brazier');
  for (let version = 1; version <= 30; version++) {
    expect(saveVocabulary(`${version}.0.0`)?.propKinds).not.toContain('abandoned_brazier');
    expect(parseSavedMap({ ...saved, saveFormatVersion: `${version}.0.0` })).toBeUndefined();
  }
  // Historical format-31 records may carry the retired brazier marker; it
  // stays accepted and changes nothing.
  const historical = {
    ...map,
    version: '4.0.0',
    decoration: { ...map.decoration, brazier: true as const },
  };
  expect(parseSavedMap({ ...saved, map: historical })?.map).toEqual(historical);
});

test('braziers are ordinary editable objects in the object editor', () => {
  const base = courtyard();
  const result = applyCourtyardCommand(base, {
    kind: 'add',
    propKind: 'abandoned_brazier',
    target: { x: 1, y: 1 },
  });
  if (!result.ok || !result.document.objectEdits) throw new Error('Could not add brazier');
  const edited = result.document;
  expect(courtyardInstances(edited).find((item) => item.id === 'added-1')?.prop.kind).toBe(
    'abandoned_brazier',
  );
  const saved = makeSavedMap(
    edited,
    'Edited courtyard',
    'data:image/png;base64,AAAA',
    'edited-brazier',
    '2026-11-12T12:00:00Z',
  );
  expect(parseSavedMap(saved)?.map).toEqual(edited);
  expect(isUsableMap(edited)).toBe(false);
  // Removing the spawned brazier through the editor stays a valid authored state.
  const index = base.decoration.props.findIndex((prop) => prop.kind === 'abandoned_brazier');
  if (index < 0) throw new Error('Missing spawned brazier');
  const removal = applyCourtyardCommand(base, { kind: 'remove', id: `base-${index}` });
  if (!removal.ok) throw new Error(removal.error);
  const remaining = courtyardInstances(removal.document);
  expect(remaining.some((item) => item.id === `base-${index}`)).toBe(false);
  expect(remaining.filter((item) => item.prop.kind === 'abandoned_brazier')).toHaveLength(
    base.decoration.props.filter((prop) => prop.kind === 'abandoned_brazier').length - 1,
  );
});

test.each(['wagon', 'well'] as const)(
  'historical courtyards restore their exact model after removing a %s',
  (addition) => {
    const bundle = parseBundle(JSON.stringify(fixture));
    if (!bundle.ok) throw new Error(bundle.error);
    const map = bundle.maps[1]?.map;
    if (!map || map.type !== 'courtyard' || map.objectEdits !== undefined)
      throw new Error('Missing historical courtyard');
    const before = structuredClone(map);
    const added = changeCourtyardAppearance(map, { ...map.decoration, [addition]: true });
    expect(added.decoration[addition]).toBe(true);
    expect(added.version).toBe(map.version);
    const removed = changeCourtyardAppearance(added, { ...map.decoration, [addition]: false });
    expect(removed).toEqual(map);
    expect(map).toEqual(before);
  },
);

test('historical courtyard shuffles keep the original generation version and ordinary vocabulary', () => {
  const bundle = parseBundle(JSON.stringify(fixture));
  if (!bundle.ok) throw new Error(bundle.error);
  for (const record of bundle.maps) {
    const map = record.map;
    if (map.type !== 'courtyard' || map.objectEdits !== undefined)
      throw new Error('Missing historical courtyard');
    const shuffled = shuffleCourtyardDetails(map);
    expect(shuffled.version).toBe('4.0.0');
    expect(shuffled.layout).toBe(map.layout);
    expect(shuffled.surfaceSeed).toBe(map.surfaceSeed);
    expect(shuffled.decoration.revision).toBe(map.decoration.revision + 1);
    expect(shuffled.decoration.props.some((prop) => prop.kind === 'abandoned_brazier')).toBe(false);
  }
});
