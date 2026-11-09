import { expect, test } from 'vitest';
import {
  towerStairFixture,
  towerEditorFixture,
  towerGroupFixture,
  acceptTower as accept,
  validTowerCommand,
  clearTower,
} from '../../../scripts/tower-editor-test-support';
import {
  towerGroups,
  towerInstances,
  orderedTowerObjects,
} from '../engine/object-editor/tower-document';
import { parseTowerEdits } from '../engine/object-editor/parse-tower-edits';
import {
  makeSavedMap,
  parseSavedMap,
  parseBundle,
  serializeBundle,
  saveVocabulary,
  SAVE_FORMAT_VERSION,
} from './save-format';
import { forestEditorFixture } from '../../../scripts/forest-editor-test-support';

test('format 27 permits Tower edit v1 while formats 1–26 keep their original closed vocabularies', () => {
  const { base, prepared, target } = towerGroupFixture('laboratory'),
    edited = accept(prepared, { kind: 'move-group', id: 'laboratory', target, rotation: 3 });
  const saved = makeSavedMap(
    edited,
    'Edited Tower',
    'data:image/png;base64,AAAA',
    'edited',
    '2026-11-05T12:00:00Z',
  );
  expect(saved.saveFormatVersion).toBe(SAVE_FORMAT_VERSION);
  expect(parseSavedMap(saved)).toEqual(saved);
  expect(parseBundle(serializeBundle([saved]))).toEqual({ ok: true, maps: [saved], skipped: 0 });
  for (let v = 1; v <= 26; v++) {
    expect(saveVocabulary(`${v}.0.0`)?.towerEditVersions).toBeUndefined();
    expect(parseSavedMap({ ...saved, saveFormatVersion: `${v}.0.0` })).toBeUndefined();
  }
  expect(saveVocabulary('27.0.0')?.towerEditVersions).toEqual([1]);
  expect(parseTowerEdits(base, edited.objectEdits)).toEqual(edited);
});

test('strict import validates dynamic coordinates, membership, canonical floors, order, and physical geometry', () => {
  const base = towerEditorFixture(),
    prepared = clearTower(base),
    edited = accept(
      prepared,
      validTowerCommand(prepared, 8, (target) => ({ kind: 'add', propKind: 'bedroll', target })),
    ),
    edits = edited.objectEdits;
  if (!edits) throw Error('Missing edits');
  const group = towerGroups(base)[0],
    member = group?.members[0];
  if (!group || !member) throw Error('Missing group');
  const order = orderedTowerObjects(edited).map((i) => i.id),
    original = towerInstances(base).find(
      (i) => !towerGroups(base).some((g) => g.members.includes(i.id)) && i.prop.x < 16,
    );
  if (!original) throw Error('Missing ordinary object');
  const other = validTowerCommand(prepared, 8, (target) => ({
    kind: 'add',
    propKind: 'crate',
    target,
  }));
  if (other.kind !== 'add') throw Error('Missing target');
  const bads = [
    { ...edits, version: 2 },
    { ...edits, unknown: true },
    { ...edits, nextId: 0 },
    { ...edits, nextId: Number.MAX_SAFE_INTEGER + 1 },
    { ...edits, added: Array(121).fill(edits.added[0]) },
    { ...edits, added: [...edits.added, ...edits.added] },
    { ...edits, added: [{ id: 'added-2', prop: edits.added[0]?.prop }] },
    ...['tree', 'cauldron', 'telescope', 'rug', 'fallen_trunk'].map((kind) => ({
      ...edits,
      added: [{ ...edits.added[0], prop: { ...edits.added[0]?.prop, kind } }],
    })),
    { ...edits, added: [{ ...edits.added[0], prop: { ...edits.added[0]?.prop, x: 48 } }] },
    { ...edits, added: [{ ...edits.added[0], prop: { ...edits.added[0]?.prop, y: 54 } }] },
    { ...edits, added: [{ ...edits.added[0], prop: { ...edits.added[0]?.prop, blocking: true } }] },
    { ...edits, added: [{ ...edits.added[0], prop: { ...edits.added[0]?.prop, variation: 0.1 } }] },
    { ...edits, added: [{ ...edits.added[0], prop: { ...edits.added[0]?.prop, floor: 1 } }] },
    { ...edits, removed: [...edits.removed, member] },
    { ...edits, moves: [{ id: member, x: 5, y: 5 }] },
    {
      ...edits,
      moves: [{ id: original.id, ...other.target }],
      removed: edits.removed.filter((id) => id !== original.id),
    },
    { ...edits, groups: [{ id: group.id, x: group.area.x, y: group.area.y, rotation: 4 }] },
    { ...edits, groups: [{ id: 'camp', x: 5, y: 5, rotation: 0 }] },
    { ...edits, order: undefined },
    { ...edits, order: order.slice(1) },
    { ...edits, order: [...order, order[0]] },
    { ...edits, order: order.map((id, i) => (i === 0 ? 'base-9999999' : id)) },
  ];
  for (const bad of bads) expect(parseTowerEdits(base, bad)).toBeUndefined();
  expect(parseTowerEdits(base, edits)).toEqual(edited);
  const reversed = order.filter((id) => group.members.includes(id)).reverse();
  let i = 0;
  const reordered = order.map((id) => {
    if (!group.members.includes(id)) return id;
    const member = reversed[i++];
    if (!member) throw Error('Missing member');
    return member;
  });
  expect(parseTowerEdits(base, { ...edits, order: reordered })).toBeUndefined();
  const saved = makeSavedMap(
    edited,
    'Cross type',
    'data:image/png;base64,AAAA',
    'bad',
    '2026-11-05T12:00:00Z',
  );
  expect(
    parseSavedMap({ ...saved, map: { ...forestEditorFixture(), objectEdits: edits } }),
  ).toBeUndefined();
  expect(
    parseSavedMap({ ...saved, map: { ...edited, doorStates: { version: 1, open: ['unknown'] } } }),
  ).toBeUndefined();
});

test('format 28 adds Tower stair edit v2 without changing the format-27 furniture vocabulary', () => {
  const { base, moved, stair, command } = towerStairFixture();
  const edited = accept(moved, { kind: 'add', propKind: 'crate', target: stair }),
    saved = makeSavedMap(
      edited,
      'Moved stairs',
      'data:image/png;base64,AAAA',
      'stairs',
      '2026-11-05T12:00:00Z',
    );
  expect(saved.saveFormatVersion).toBe(SAVE_FORMAT_VERSION);
  expect(saveVocabulary('29.0.0')?.towerEditVersions).toEqual([1, 2]);
  expect(saveVocabulary('27.0.0')?.towerEditVersions).toEqual([1]);
  expect(parseSavedMap(saved)).toEqual(saved);
  expect(parseBundle(serializeBundle([saved]))).toEqual({ ok: true, maps: [saved], skipped: 0 });
  for (let v = 1; v <= 27; v++)
    expect(parseSavedMap({ ...saved, saveFormatVersion: `${v}.0.0` })).toBeUndefined();
  const edits = moved.objectEdits;
  if (edits?.version !== 2) throw Error('Missing stair edits');
  const move = edits.stairs[0];
  if (!move) throw Error('Missing stair move');
  for (const bad of [
    { ...edits, version: 3 },
    { ...edits, unknown: true },
    { ...edits, stairs: [] },
    { ...edits, stairs: [move, move] },
    { ...edits, stairs: Array(20).fill(move) },
    ...[
      { ...move, id: 'stairs-999' },
      { ...move, id: 'base-0' },
      { ...move, unknown: true },
      { ...move, x: Infinity },
      { ...move, x: -1 },
      { ...move, y: 54 },
      { ...move, y: 5.5 },
      { ...move, x: stair.x, y: stair.y },
      { ...move, x: 0, y: 0 },
    ].map((m) => ({ ...edits, stairs: [m] })),
    {
      ...edits,
      added: [
        {
          id: 'added-1',
          prop: { kind: 'crate', ...command.target, variation: 0.5, blocking: true },
        },
      ],
      nextId: 2,
    },
    { ...edits, stairs: [{ ...move, x: 5, y: 10 }] }, // another floor
  ])
    expect(parseTowerEdits(base, bad)).toBeUndefined();
  expect(parseTowerEdits(base, edited.objectEdits)).toEqual(edited);
});
