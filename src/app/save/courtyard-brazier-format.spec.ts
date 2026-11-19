import { expect, test } from 'vitest';
import { generateCourtyard } from '../engine/courtyard-generate';
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

test('current format keeps the brazier object kind and old formats reject it', () => {
  const map = courtyard();
  const saved = makeSavedMap(
    map,
    'Courtyard with braziers',
    'data:image/png;base64,AAAA',
    'brazier',
    '2026-11-12T12:00:00Z',
  );
  expect(map.decoration).not.toHaveProperty('brazier');
  expect(map.version).toBe('5.0.0');
  expect(parseSavedMap(saved)?.map).toEqual(map);
  expect(parseBundle(serializeBundle([saved]))).toEqual({ ok: true, maps: [saved], skipped: 0 });
  expect(saveVocabulary(SAVE_FORMAT_VERSION)?.propKinds).toContain('abandoned_brazier');
  expect(
    parseSavedMap({
      ...saved,
      map: {
        ...map,
        decoration: { ...map.decoration, brazier: true },
      },
    }),
  ).toBeUndefined();
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
