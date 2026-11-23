import { objectRotation } from './object-rotation';
import { expect, test } from 'vitest';
import { editorFixture } from '../../../../scripts/editor-test-support';
import { forestEditorFixture } from '../../../../scripts/forest-editor-test-support';
import { courtyardEditorFixture } from '../../../../scripts/courtyard-editor-test-support';
import { towerEditorFixture } from '../../../../scripts/tower-editor-test-support';
import { mapDimensions } from '../model';
import type { EditableMapDocument, Point, QuarterTurn } from '../model';
import { applyEditorCommand } from './editor-commands';
import { editorInstances, editorPalette, editorSelections } from './editor-view';
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

for (const [type, map] of Object.entries(prepared)) {
  for (const entry of editorPalette(map)) {
    test(`${type}: ${entry.label} rotates through all orientations and survives saves`, () => {
      const before = structuredClone(map);
      const added = place(map, (target) => ({ kind: 'add', propKind: entry.kind, target }));
      const item = editorInstances(added).find((item) => item.id === 'added-1');
      if (!item) throw Error('Missing added prop');
      let current = added;
      for (const rotation of [1, 2, 3, 0] as const) {
        current = accept(current, { kind: 'move', id: item.id, target: item.prop, rotation });
        const prop = editorInstances(current).find((other) => other.id === item.id)?.prop;
        expect(prop ? objectRotation(prop) : 0).toBe(rotation);
        expect(prop).toMatchObject({
          x: item.prop.x,
          y: item.prop.y,
          blocking: item.prop.blocking,
        });
        expect(editorSelections(current).find((other) => other.id === item.id)).toMatchObject({
          rotatable: true,
          rotation,
        });
        const record = makeSavedMap(
          current,
          'Turned',
          'data:image/png;base64,AAAA',
          'rotation',
          '2026-11-19T12:00:00Z',
        );
        expect(parseSavedMap(record)?.map).toEqual(current);
        expect(parseBundle(serializeBundle([record]))).toEqual({
          ok: true,
          maps: [record],
          skipped: 0,
        });
        if (rotation) {
          const invalid = structuredClone(record);
          const prop = invalid.map.objectEdits?.added[0]?.prop;
          if (!prop) throw Error('Missing stored prop');
          Object.assign(prop, { artRotation: 4 });
          expect(parseSavedMap(invalid)).toBeUndefined();
        }
      }
      expect(current).toEqual(added);
      const rotated = accept(added, { kind: 'move', id: item.id, target: item.prop, rotation: 1 });
      const moved = place(rotated, (target) => ({ kind: 'move', id: item.id, target }), item.prop);
      const movedProp = editorInstances(moved).find((other) => other.id === item.id)?.prop;
      expect(movedProp && objectRotation(movedProp)).toBe(1);
      expect(accept(rotated, { kind: 'remove', id: item.id })).toEqual(
        accept(added, { kind: 'remove', id: item.id }),
      );
      expect(accept(rotated, { kind: 'reset' })).toEqual(sources[map.type]);
      expect(map).toEqual(before);
    });
  }
  test(`${type}: generated objects rotate without moving and restore the canonical base`, () => {
    const item = editorSelections(sources[map.type]).find((item) => item.removable && !item.lock);
    if (!item) throw Error('Missing independent generated object');
    let current: EditableMapDocument = sources[map.type];
    for (const rotation of [1, 2, 3, 0] as const) {
      current = accept(current, { kind: 'move', id: item.id, target: item.position, rotation });
      const saved = makeSavedMap(
        current,
        'Generated',
        'data:image/png;base64,AAAA',
        'generated',
        '2026-11-19T12:00:00Z',
      );
      expect(parseSavedMap(saved)?.map).toEqual(current);
    }
    expect(current).toEqual(sources[map.type]);
    expect(
      applyEditorCommand(current, {
        kind: 'move',
        id: item.id,
        target: item.position,
        rotation: 4 as QuarterTurn,
      }).ok,
    ).toBe(false);
    for (const locked of editorSelections(current).filter((item) => item.lock))
      expect(
        applyEditorCommand(current, {
          kind: 'move',
          id: locked.id,
          target: locked.position,
          rotation: 1,
        }).ok,
      ).toBe(false);
  });
}

for (const map of Object.values(prepared))
  test(`${map.type}: initial orientation and canonical/invalid rotation boundaries`, () => {
    const added = place(map, (target) => ({
      kind: 'add',
      propKind: 'treasure_chest',
      target,
      rotation: 3,
    }));
    const item = editorInstances(added).find((item) => item.id === 'added-1');
    if (!item) throw Error('Missing chest');
    expect(item.prop.artRotation).toBe(3);
    for (const bad of [-1, 4, 1.5, NaN, '1', null] as const) {
      expect(
        applyEditorCommand(map, {
          kind: 'add',
          propKind: 'treasure_chest',
          target: item.prop,
          rotation: bad as QuarterTurn,
        }).ok,
      ).toBe(false);
      const record = makeSavedMap(
        added,
        'Bad',
        'data:image/png;base64,AAAA',
        'bad',
        '2026-11-19T12:00:00Z',
      );
      const prop = record.map.objectEdits?.added[0]?.prop;
      if (!prop) throw Error('Missing added prop');
      Object.assign(prop, { artRotation: bad });
      expect(parseSavedMap(record)).toBeUndefined();
    }
    const canonical = makeSavedMap(
      structuredClone(sources[map.type]),
      'Base',
      'data:image/png;base64,AAAA',
      'base',
      '2026-11-19T12:00:00Z',
    );
    const baseProp = canonical.map.decoration.props[0];
    if (!baseProp) throw Error('Missing canonical prop');
    Object.assign(baseProp, { artRotation: 1 });
    expect(parseSavedMap(canonical)).toBeUndefined();
  });
