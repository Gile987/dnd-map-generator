import { expect, expectTypeOf, test } from 'vitest';
import {
  courtyardGroupFixture,
  acceptCourtyard as accept,
} from '../../../scripts/courtyard-editor-test-support';
import { parseCourtyardEdits } from '../engine/object-editor/parse-courtyard-edits';
import {
  courtyardBase,
  courtyardInstances,
  courtyardGroups,
  orderedCourtyardObjects,
} from '../engine/object-editor/courtyard-document';
import type {
  AuthoredCourtyard,
  ResolvedCourtyard,
} from '../engine/object-editor/courtyard-document';
import type { GeneratedMap, RuinedCourtyard } from '../engine/model';
import {
  makeSavedMap,
  parseSavedMap,
  parseBundle,
  serializeBundle,
  saveVocabulary,
  SAVE_FORMAT_VERSION,
} from './save-format';
import { isUsableMap } from './map-schema';
import { editorFixture } from '../../../scripts/editor-test-support';

test('format 25 explicitly supports Courtyard edits while canonical generators and old formats reject them', () => {
  const { prepared, target } = courtyardGroupFixture('wagon');
  const edited = accept(prepared, { kind: 'move-group', id: 'wagon', target, rotation: 3 });
  const saved = makeSavedMap(
    edited,
    'Edited courtyard',
    'data:image/png;base64,AAAA',
    'court-edited',
    '2026-11-03T12:00:00Z',
  );
  expect(saved.saveFormatVersion).toBe(SAVE_FORMAT_VERSION);
  expect(parseSavedMap(saved)).toEqual(saved);
  expect(parseBundle(serializeBundle([saved]))).toEqual({ ok: true, maps: [saved], skipped: 0 });
  for (let v = 1; v <= 24; v++) {
    expect(saveVocabulary(`${v}.0.0`)?.courtyardEditVersions).toBeUndefined();
    expect(parseSavedMap({ ...saved, saveFormatVersion: `${v}.0.0` })).toBeUndefined();
  }
  expect(saveVocabulary('25.0.0')?.courtyardEditVersions).toEqual([1]);
  expect(isUsableMap(edited)).toBe(false);
  expectTypeOf<AuthoredCourtyard>().not.toExtend<RuinedCourtyard>();
  expectTypeOf<ResolvedCourtyard>().not.toExtend<GeneratedMap>();
});

test('strict references, capabilities, counters, group transforms and complete permutations reject malformed data', () => {
  const { base, prepared, target } = courtyardGroupFixture('wagon');
  const moved = accept(prepared, { kind: 'move-group', id: 'wagon', target, rotation: 1 });
  const edited = accept(moved, { kind: 'add', propKind: 'moss', target: { x: 1, y: 1 } }),
    edits = edited.objectEdits;
  if (!edits) throw Error('Missing edits');
  const member = courtyardGroups(base).find((group) => group.id === 'wagon')?.members[0];
  if (!member) throw Error('Missing member');
  const allIds = courtyardInstances(edited).map((item) => item.id);
  const bads = [
    { ...edits, version: 2 },
    { ...edits, future: true },
    { ...edits, nextId: 0 },
    { ...edits, nextId: Number.MAX_SAFE_INTEGER + 1 },
    { ...edits, added: [...edits.added, ...edits.added] },
    { ...edits, added: Array(121).fill(edits.added[0]) },
    { ...edits, added: [{ id: 'added-2', prop: edits.added[0]?.prop }] },
    { ...edits, added: [{ ...edits.added[0], prop: { ...edits.added[0]?.prop, kind: 'crate' } }] },
    { ...edits, added: [{ ...edits.added[0], prop: { ...edits.added[0]?.prop, blocking: true } }] },
    { ...edits, added: [{ ...edits.added[0], prop: { ...edits.added[0]?.prop, variation: 0.4 } }] },
    { ...edits, moves: [{ id: member, x: 1, y: 1 }] },
    { ...edits, removed: [...edits.removed, member] },
    { ...edits, moves: [{ id: 'base-99999', x: 1, y: 1 }] },
    { ...edits, groups: [...edits.groups, ...edits.groups] },
    { ...edits, groups: [{ ...edits.groups[0], id: 'study' }] },
    { ...edits, groups: [{ ...edits.groups[0], rotation: 4 }] },
    { ...edits, groups: [{ ...edits.groups[0], id: 'fountain', rotation: 1 }] },
    { ...edits, groups: [{ ...edits.groups[0], x: 39, y: 29 }] },
    { ...edits, order: undefined },
    { ...edits, order: [...allIds, allIds[0]] },
    { ...edits, order: allIds.slice(1) },
    { ...edits, order: allIds.map((id, i) => (i === 0 ? 'base-999' : id)) },
  ];
  for (const bad of bads) expect(parseCourtyardEdits(base, bad)).toBeUndefined();
  expect(parseCourtyardEdits(base, edits)).toEqual(edited);
  const validOrder = orderedCourtyardObjects(edited).map((item) => item.id);
  expect(parseCourtyardEdits(base, { ...edits, order: validOrder })).toEqual({
    ...edited,
    objectEdits: { ...edits, order: validOrder },
  });
  const wagonMembers = courtyardGroups(base).find((group) => group.id === 'wagon')?.members;
  if (!wagonMembers || wagonMembers.length < 2) throw Error('Missing wagon members');
  const reversedMembers = validOrder.filter((id) => wagonMembers.includes(id)).reverse();
  let memberIndex = 0;
  const reorderedGroup = validOrder.map((id) => {
    if (!wagonMembers.includes(id)) return id;
    const replacement = reversedMembers[memberIndex++];
    if (!replacement) throw Error('Missing reversed member');
    return replacement;
  });
  expect(parseCourtyardEdits(base, { ...edits, order: reorderedGroup })).toBeUndefined();
  const saved = makeSavedMap(
    edited,
    'Bad future',
    'data:image/png;base64,AAAA',
    'bad-future',
    '2026-11-03T12:00:00Z',
  );
  expect(
    parseSavedMap({ ...saved, map: { ...editorFixture(), objectEdits: edits } }),
  ).toBeUndefined();
  expect(
    parseSavedMap({
      ...saved,
      map: { ...edited, doorStates: { version: 1, open: ['door-unknown'] } },
    }),
  ).toBeUndefined();
  expect(courtyardBase(edited)).toEqual(base);
});
