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

function courtyard(brazier: boolean) {
  const result = generateCourtyard({
    seed: 'ivy-court',
    density: 'Balanced',
    character: 'Overgrown',
    fountain: true,
    wagon: true,
    well: true,
    brazier,
  });
  if (!result.ok) throw new Error(result.error);
  return result.map;
}

test('format 31 round-trips the brazier and preserves format 30 without it', () => {
  const map = courtyard(true);
  const saved = makeSavedMap(
    map,
    'Brazier courtyard',
    'data:image/png;base64,AAAA',
    'brazier',
    '2026-11-11T12:00:00Z',
  );
  expect(SAVE_FORMAT_VERSION).toBe('31.0.0');
  expect(saved.saveFormatVersion).toBe(SAVE_FORMAT_VERSION);
  expect(parseSavedMap(saved)?.map).toEqual(map);
  expect(parseBundle(serializeBundle([saved]))).toEqual({ ok: true, maps: [saved], skipped: 0 });
  expect(saveVocabulary('30.0.0')?.courtyardBraziers).toBeUndefined();
  expect(saveVocabulary('30.0.0')?.propKinds).not.toContain('abandoned_brazier');
  expect(saveVocabulary(SAVE_FORMAT_VERSION)?.courtyardBraziers).toEqual([true]);
  expect(parseSavedMap({ ...saved, saveFormatVersion: '30.0.0' })).toBeUndefined();
  expect(
    parseSavedMap({ ...saved, map: courtyard(false), saveFormatVersion: '30.0.0' })?.map,
  ).toEqual(courtyard(false));
});

test('the editable brazier round-trips and old sidecar vocabularies reject it', () => {
  const base = courtyard(false);
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
    '2026-11-11T12:00:00Z',
  );
  expect(parseSavedMap(saved)?.map).toEqual(edited);
  expect(parseSavedMap({ ...saved, saveFormatVersion: '30.0.0' })).toBeUndefined();
  expect(isUsableMap(edited)).toBe(false);
});

test('malformed brazier metadata and duplicate or moved canonical props are rejected', () => {
  const map = courtyard(true);
  const saved = makeSavedMap(
    map,
    'Brazier courtyard',
    'data:image/png;base64,AAAA',
    'brazier-validation',
    '2026-11-11T12:00:00Z',
  );
  const body = map.decoration.props.find((prop) => prop.kind === 'abandoned_brazier');
  if (!body) throw new Error('Missing brazier');
  const candidates: unknown[] = [
    { ...map, decoration: { ...map.decoration, brazier: false } },
    { ...map, decoration: { ...map.decoration, brazier: 1 } },
    { ...map, decoration: { ...map.decoration, props: [...map.decoration.props, body] } },
    {
      ...map,
      decoration: {
        ...map.decoration,
        props: map.decoration.props.map((prop) =>
          prop === body ? { ...prop, x: prop.x + 1 } : prop,
        ),
      },
    },
  ];
  for (const candidate of candidates) {
    expect(isUsableMap(candidate)).toBe(false);
    expect(parseSavedMap({ ...saved, map: candidate })).toBeUndefined();
  }
});
