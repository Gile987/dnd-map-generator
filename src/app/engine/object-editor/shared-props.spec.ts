import { expect, test } from 'vitest';
import {
  editorFixture,
  rotationFixture,
  validCommand,
} from '../../../../scripts/editor-test-support';
import {
  forestEditorFixture,
  validForestCommand,
} from '../../../../scripts/forest-editor-test-support';
import { courtyardEditorFixture } from '../../../../scripts/courtyard-editor-test-support';
import { towerEditorFixture } from '../../../../scripts/tower-editor-test-support';
import { isBlockingProp, mapDimensions } from '../model';
import type { EditableMapDocument, MapType, Point, PropKind } from '../model';
import { applyEditorCommand } from './editor-commands';
import { editorInstances, editorPalette, editorSelections } from './editor-view';
import { forestGroups, forestBase } from './forest-document';
import { dungeonGroups } from './dungeon-groups';
import { dungeonBase } from './document';
import { towerFloorAt } from '../tower';
import { makeSavedMap, parseBundle, parseSavedMap, serializeBundle } from '../../save/save-format';
import type { ObjectCommand } from './object-command';

const sources = {
  dungeon: editorFixture(),
  forest: forestEditorFixture(),
  courtyard: courtyardEditorFixture(),
  tower: towerEditorFixture({ floorCount: 3, portalFloor: null }),
};
function accept(map: EditableMapDocument, command: ObjectCommand): EditableMapDocument {
  const result = applyEditorCommand(map, command);
  if (!result.ok) throw Error(result.error);
  return result.document;
}
function clear(map: EditableMapDocument): EditableMapDocument {
  let result = map;
  for (const item of editorSelections(map))
    if (item.removable) result = accept(result, { kind: 'remove', id: item.id });
  return result;
}
function place(
  map: EditableMapDocument,
  make: (target: Point) => ObjectCommand,
  skip?: Point,
): EditableMapDocument {
  const { width } = mapDimensions(map);
  for (const [tile, floor] of map.layout.tiles.entries()) {
    if (!floor) continue;
    const target = { x: tile % width, y: Math.floor(tile / width) };
    if (target.x === skip?.x && target.y === skip.y) continue;
    if (map.type === 'tower' && towerFloorAt(map, target)?.number !== 1) continue;
    const result = applyEditorCommand(map, make(target));
    if (result.ok && result.document !== map) return result.document;
  }
  throw Error('Fixture has no valid placement');
}
const prepared = {
  dungeon: clear(sources.dungeon),
  forest: clear(sources.forest),
  courtyard: clear(sources.courtyard),
  tower: clear(sources.tower),
};
const common = [
  'treasure_chest',
  'supply_sacks',
  'weapon_rack',
  'crate',
  'barrel',
  'bedroll',
  'moss',
  'fern',
  'small_table',
] as const;
const availability: readonly [MapType, readonly PropKind[]][] = [
  ['dungeon', [...common, 'desk', 'bookshelf']],
  ['forest', [...common, 'log', 'stump']],
  ['courtyard', [...common, 'log', 'stump']],
  ['tower', [...common, 'desk', 'bookshelf']],
];
const cases = availability.flatMap(([type, kinds]) => kinds.map((kind) => ({ type, kind })));

test.each(cases)(
  '$type: $kind can be added, moved, removed, saved and backed up without changing its base',
  ({ type, kind }) => {
    const map = prepared[type],
      before = structuredClone(map);
    expect(editorPalette(map).some((entry) => entry.kind === kind)).toBe(true);
    const edited = place(map, (target) => ({ kind: 'add', propKind: kind, target }));
    const added = editorInstances(edited).find((item) => item.id === 'added-1');
    if (!added) throw Error('Missing added object');
    expect(added.prop).toMatchObject({ kind, variation: 0.5, blocking: isBlockingProp(kind) });
    if (isBlockingProp(kind))
      expect(
        applyEditorCommand(edited, { kind: 'add', propKind: 'crate', target: added.prop }).ok,
      ).toBe(false);
    const moved = place(edited, (target) => ({ kind: 'move', id: added.id, target }), added.prop);
    const current = editorInstances(moved).find((item) => item.id === added.id);
    expect(current?.prop.kind).toBe(kind);
    expect(current?.prop).not.toEqual(added.prop);
    const saved = makeSavedMap(
      moved,
      'Shared props',
      'data:image/png;base64,AAAA',
      'shared',
      '2026-11-19T12:00:00Z',
    );
    expect(parseSavedMap(saved)?.map).toEqual(moved);
    expect(parseBundle(serializeBundle([saved]))).toEqual({ ok: true, maps: [saved], skipped: 0 });
    const malformed = {
      ...saved,
      map: {
        ...moved,
        objectEdits: {
          ...moved.objectEdits,
          added: moved.objectEdits?.added.map((item) => ({
            ...item,
            prop: { ...item.prop, blocking: !item.prop.blocking },
          })),
        },
      },
    };
    expect(parseSavedMap(malformed)).toBeUndefined();
    const removed = accept(moved, { kind: 'remove', id: added.id });
    expect(editorInstances(removed)).toEqual(editorInstances(map));
    expect(accept(edited, { kind: 'reset' })).toEqual(sources[type]);
    expect(map).toEqual(before);
  },
);

test.each([
  ['dungeon', 'log'],
  ['tower', 'stump'],
  ['forest', 'desk'],
  ['courtyard', 'bookshelf'],
] as const)('%s excludes shared %s when that map does not support it', (type, propKind) => {
  const map = prepared[type];
  expect(editorPalette(map).some((item) => item.kind === propKind)).toBe(false);
  expect(applyEditorCommand(map, { kind: 'add', propKind, target: { x: 10, y: 10 } }).ok).toBe(
    false,
  );
});

test('an independent bedroll never becomes a camp member or moves with the camp', () => {
  const base = sources.forest,
    groups = forestGroups(base);
  const added = place(prepared.forest, (target) => ({ kind: 'add', propKind: 'bedroll', target }));
  if (added.type !== 'forest') throw Error('Expected forest');
  const loose = editorInstances(added).find((item) => item.id === 'added-1');
  const camp = groups.find((group) => group.id === 'camp');
  if (!loose || !camp) throw Error('Missing camp/bedroll');
  const command = validForestCommand(
    added,
    (target) => ({ kind: 'move-group', id: 'camp', target }),
    camp.area,
  );
  const moved = accept(added, command);
  expect(editorInstances(moved).find((item) => item.id === loose.id)).toEqual(loose);
  expect(forestGroups(forestBase(added))).toEqual(groups);
  const bedroll = editorInstances(base).find((item) => item.prop.kind === 'bedroll');
  if (!bedroll) throw Error('Missing camp bedroll');
  expect(applyEditorCommand(added, { kind: 'remove', id: bedroll.id }).ok).toBe(false);
  expect(applyEditorCommand(added, { kind: 'move', id: bedroll.id, target: loose.prop }).ok).toBe(
    false,
  );
});

test('standalone desks and shelves remain independent of the generated study', () => {
  const { base, prepared, group } = rotationFixture('study');
  let map = place(prepared, (target) => ({ kind: 'add', propKind: 'desk', target }));
  map = place(map, (target) => ({ kind: 'add', propKind: 'bookshelf', target }));
  if (map.type !== 'dungeon') throw Error('Expected dungeon');
  const loose = editorInstances(map).filter((item) => item.id.startsWith('added-'));
  const command = validCommand(
    map,
    (target) => ({ kind: 'move-group', id: 'study', target }),
    group.area,
  );
  const moved = accept(map, command);
  expect(editorInstances(moved).filter((item) => item.id.startsWith('added-'))).toEqual(loose);
  expect(dungeonGroups(dungeonBase(map))).toEqual(dungeonGroups(base));
  const desk = editorInstances(base).find((item) => item.prop.kind === 'desk');
  if (!desk) throw Error('Missing study desk');
  expect(applyEditorCommand(map, { kind: 'remove', id: desk.id }).ok).toBe(false);
});

test.each(Object.values(sources))(
  '$type generators do not spawn manually introduced props',
  (map) => {
    expect(
      map.decoration.props.some((prop) =>
        ['treasure_chest', 'supply_sacks', 'weapon_rack', 'small_table'].includes(prop.kind),
      ),
    ).toBe(false);
  },
);
