import { expect, test } from 'vitest';
import { editorFixture, validCommand } from '../../../scripts/editor-test-support';
import { applyObjectCommand } from '../engine/object-editor/commands';
import {
  makeSavedMap,
  parseSavedMap,
  parseBundle,
  serializeBundle,
  saveVocabulary,
} from './save-format';
import { isUsableMap } from './map-schema';
import oldStudy from './fixtures/study-v9.json';
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
test('format 21 persists the immutable base plus bounded edits through record, backup and sharing roundtrips', () => {
  const saved = record(),
    before = structuredClone(saved);
  expect(saved.saveFormatVersion).toBe('21.0.0');
  expect(parseSavedMap(saved)).toEqual(saved);
  expect(parseBundle(serializeBundle([saved]))).toEqual({ ok: true, maps: [saved], skipped: 0 });
  expect(saved).toEqual(before);
  expect(saveVocabulary('19.0.0')?.objectEditVersions).toEqual([1]);
  expect(saveVocabulary('20.0.0')?.objectEditVersions).toEqual([1, 2]);
  expect(saveVocabulary('21.0.0')?.objectEditVersions).toEqual([1, 2, 3]);
  expect(parseSavedMap({ ...saved, saveFormatVersion: '20.0.0' })).toBeUndefined();
  expect(parseSavedMap({ ...saved, saveFormatVersion: '19.0.0' })).toBeUndefined();
  expect(isUsableMap(saved.map)).toBe(false); // Not a canonical generator snapshot.
  for (let v = 1; v <= 18; v++) {
    expect(saveVocabulary(`${v}.0.0`)?.objectEditVersions).toBeUndefined();
    expect(parseSavedMap({ ...saved, saveFormatVersion: `${v}.0.0` })).toBeUndefined();
  }
});
test('historical and current unedited snapshots stay unedited and preserve original map bodies', () => {
  const result = parseBundle(JSON.stringify(oldStudy));
  if (!result.ok) throw new Error(result.error);
  for (const saved of result.maps) {
    expect(saved.map).not.toHaveProperty('objectEdits');
    expect(parseSavedMap(saved)?.map).toBe(saved.map);
  }
  const saved = record();
  expect(
    parseSavedMap({ ...saved, saveFormatVersion: '18.0.0', map: editorFixture() })?.map,
  ).not.toHaveProperty('objectEdits');
  expect(parseBundle(serializeBundle(result.maps))).toEqual(result);
});
test('malformed and future editing data are rejected, counted and never silently stripped', () => {
  const saved = record();
  if (saved.map.type !== 'dungeon' || !saved.map.objectEdits) throw new Error('Missing edits');
  for (const objectEdits of [
    undefined,
    null,
    {},
    { ...saved.map.objectEdits, version: 4 },
    { ...saved.map.objectEdits, added: [] },
  ]) {
    const bad = { ...saved, map: { ...saved.map, objectEdits } };
    expect(parseSavedMap(bad)).toBeUndefined();
    if (objectEdits !== undefined)
      expect(
        parseBundle(
          JSON.stringify({
            format: 'encounter-map-forge-saves',
            saveFormatVersion: '21.0.0',
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
