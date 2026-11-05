import { expect, test } from 'vitest';
import {
  forestEditorFixture,
  forestGroupFixture,
  acceptForest as accept,
} from '../../../scripts/forest-editor-test-support';
import { parseForestEdits } from '../engine/object-editor/parse-forest-edits';
import {
  forestGroups,
  forestInstances,
  orderedForestObjects,
} from '../engine/object-editor/forest-document';
import {
  makeSavedMap,
  parseSavedMap,
  parseBundle,
  serializeBundle,
  saveVocabulary,
} from './save-format';
import { isUsableMap } from './map-schema';
import { courtyardEditorFixture } from '../../../scripts/courtyard-editor-test-support';

test('format 26 introduces independent Forest edit version 1 and prior vocabularies remain closed', () => {
  const { base, prepared, target } = forestGroupFixture('fallen-tree');
  const edited = accept(prepared, { kind: 'move-group', id: 'fallen-tree', target, rotation: 3 });
  const saved = makeSavedMap(
    edited,
    'Edited forest',
    'data:image/png;base64,AAAA',
    'forest-edit',
    '2026-11-05T12:00:00Z',
  );
  expect(saved.saveFormatVersion).toBe('26.0.0');
  expect(parseSavedMap(saved)).toEqual(saved);
  expect(parseBundle(serializeBundle([saved]))).toEqual({ ok: true, maps: [saved], skipped: 0 });
  expect(isUsableMap(edited)).toBe(false);
  for (let v = 1; v <= 25; v++) {
    expect(saveVocabulary(`${v}.0.0`)?.forestEditVersions).toBeUndefined();
    expect(parseSavedMap({ ...saved, saveFormatVersion: `${v}.0.0` })).toBeUndefined();
  }
  expect(saveVocabulary('26.0.0')?.forestEditVersions).toEqual([1]);
  expect(parseForestEdits(base, edited.objectEdits)).toEqual(edited);
});

test('strict references, safe IDs, protected components, physical geometry and complete order are validated before import', () => {
  const { base, prepared, target } = forestGroupFixture('camp');
  const moved = accept(prepared, { kind: 'move-group', id: 'camp', target, rotation: 1 }),
    edited = accept(moved, { kind: 'add', propKind: 'flower', target: { x: 1, y: 1 } }),
    edits = edited.objectEdits;
  if (!edits) throw Error('Missing edits');
  const tree = forestInstances(base).find((item) => item.prop.kind === 'tree'),
    group = forestGroups(base).find((group) => group.id === 'camp');
  if (!tree || !group) throw Error('Missing protected members');
  const member = group.members[0];
  if (!member) throw Error('Missing member');
  const order = orderedForestObjects(edited).map((item) => item.id);
  const bads = [
    { ...edits, version: 2 },
    { ...edits, future: true },
    { ...edits, nextId: 0 },
    { ...edits, nextId: Number.MAX_SAFE_INTEGER + 1 },
    { ...edits, added: Array(121).fill(edits.added[0]) },
    { ...edits, added: [...edits.added, ...edits.added] },
    { ...edits, added: [{ id: 'added-2', prop: edits.added[0]?.prop }] },
    ...['tree', 'tent', 'standing_stone', 'fallen_trunk', 'crate'].map((kind) => ({
      ...edits,
      added: [{ ...edits.added[0], prop: { ...edits.added[0]?.prop, kind } }],
    })),
    { ...edits, added: [{ ...edits.added[0], prop: { ...edits.added[0]?.prop, blocking: true } }] },
    { ...edits, added: [{ ...edits.added[0], prop: { ...edits.added[0]?.prop, variation: 0.4 } }] },
    {
      ...edits,
      added: [
        {
          ...edits.added[0],
          prop: { ...edits.added[0]?.prop, footprint: { width: 2, height: 2 } },
        },
      ],
    },
    { ...edits, removed: [...edits.removed, tree.id] },
    { ...edits, removed: [...edits.removed, member] },
    { ...edits, moves: [{ id: tree.id, x: 1, y: 1 }] },
    { ...edits, moves: [{ id: member, x: 1, y: 1 }] },
    { ...edits, moves: [{ id: 'base-999999', x: 1, y: 1 }] },
    { ...edits, groups: [...edits.groups, ...edits.groups] },
    { ...edits, groups: [{ ...edits.groups[0], id: 'wagon' }] },
    { ...edits, groups: [{ ...edits.groups[0], rotation: 4 }] },
    { ...edits, groups: [{ ...edits.groups[0], x: 39, y: 29 }] },
    { ...edits, groups: [{ id: 'camp', x: group.area.x, y: group.area.y, rotation: 0 }] },
    { ...edits, order: undefined },
    { ...edits, order: [...order, order[0]] },
    { ...edits, order: order.slice(1) },
    { ...edits, order: order.map((id, i) => (i === 0 ? 'base-999999' : id)) },
  ];
  for (const bad of bads) expect(parseForestEdits(base, bad)).toBeUndefined();
  expect(parseForestEdits(base, edits)).toEqual(edited);
  expect(parseForestEdits(base, { ...edits, order })).toEqual({
    ...edited,
    objectEdits: { ...edits, order },
  });
  const members = order.filter((id) => group.members.includes(id)).reverse();
  let index = 0;
  const invalidOrder = order.map((id) => {
    if (!group.members.includes(id)) return id;
    const replacement = members[index++];
    if (!replacement) throw Error('Missing member');
    return replacement;
  });
  expect(parseForestEdits(base, { ...edits, order: invalidOrder })).toBeUndefined();
  const record = makeSavedMap(
    edited,
    'Bad cross-map',
    'data:image/png;base64,AAAA',
    'bad',
    '2026-11-05T12:00:00Z',
  );
  expect(
    parseSavedMap({ ...record, map: { ...courtyardEditorFixture(), objectEdits: edits } }),
  ).toBeUndefined();
  expect(
    parseSavedMap({ ...record, map: { ...edited, doorStates: { version: 1, open: ['unknown'] } } }),
  ).toBeUndefined();
  expect(
    parseForestEdits(forestEditorFixture(), {
      version: 1,
      nextId: 1,
      moves: [],
      removed: [],
      added: [],
      groups: [],
      order: [],
    }),
  ).toBeUndefined();
});
