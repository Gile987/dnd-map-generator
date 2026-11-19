import { expect, test } from 'vitest';
import { editorFixture, validCommand } from '../../../scripts/editor-test-support';
import { applyObjectCommand } from '../engine/object-editor/commands';
import {
  makeSavedMap,
  parseSavedMap,
  parseBundle,
  serializeBundle,
  saveVocabulary,
  SAVE_FORMAT_VERSION,
} from './save-format';
import { isUsableMap } from './map-schema';
import { generateForestClearing } from '../engine/forest-generate';

function record() {
  const base = editorFixture(),
    r = applyObjectCommand(
      base,
      validCommand(base, (target) => ({ kind: 'add', propKind: 'moss', target })),
    );
  if (!r.ok) throw new Error(r.error);
  return makeSavedMap(
    r.document,
    'My edited dungeon',
    'data:image/png;base64,AAAA',
    'edited-map',
    '2026-11-02T12:00:00Z',
  );
}
test('current format persists the immutable base plus bounded edits through record, backup and sharing roundtrips', () => {
  const saved = record(),
    before = structuredClone(saved);
  expect(saved.saveFormatVersion).toBe(SAVE_FORMAT_VERSION);
  expect(saveVocabulary(SAVE_FORMAT_VERSION)?.objectEditVersions).toEqual([4, 5]);
  expect(parseSavedMap(saved)).toEqual(saved);
  expect(parseBundle(serializeBundle([saved]))).toEqual({ ok: true, maps: [saved], skipped: 0 });
  expect(saved).toEqual(before);
  expect(parseSavedMap({ ...saved, saveFormatVersion: '21.0.0' })).toBeUndefined();
  expect(parseSavedMap({ ...saved, saveFormatVersion: '20.0.0' })).toBeUndefined();
  expect(parseSavedMap({ ...saved, saveFormatVersion: '19.0.0' })).toBeUndefined();
  expect(isUsableMap(saved.map)).toBe(false);
});
test('malformed and future editing data are rejected, counted and never silently stripped', () => {
  const saved = record();
  if (saved.map.type !== 'dungeon' || !saved.map.objectEdits) throw new Error('Missing edits');
  for (const objectEdits of [
    undefined,
    null,
    {},
    { ...saved.map.objectEdits, version: 5 },
    { ...saved.map.objectEdits, version: 6 },
    { ...saved.map.objectEdits, added: [] },
  ]) {
    const bad = { ...saved, map: { ...saved.map, objectEdits } };
    expect(parseSavedMap(bad)).toBeUndefined();
    if (objectEdits !== undefined)
      expect(
        parseBundle(
          JSON.stringify({
            format: 'encounter-map-forge-saves',
            saveFormatVersion: SAVE_FORMAT_VERSION,
            maps: [saved, bad],
          }),
        ),
      ).toEqual({ ok: true, maps: [saved], skipped: 1 });
  }
  const forest = generateForestClearing({
    seed: 'woodland-glade',
    density: 'Balanced',
    character: 'Verdant',
  });
  if (!forest.ok) throw new Error(forest.error);
  expect(
    parseSavedMap({ ...saved, map: { ...forest.map, objectEdits: saved.map.objectEdits } }),
  ).toBeUndefined();
});
