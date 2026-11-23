import { expect, test } from 'vitest';
import { editorFixture } from '../../../../scripts/editor-test-support';
import { forestEditorFixture } from '../../../../scripts/forest-editor-test-support';
import { courtyardEditorFixture } from '../../../../scripts/courtyard-editor-test-support';
import { towerEditorFixture } from '../../../../scripts/tower-editor-test-support';
import { applyEditorCommand } from './editor-commands';
import { editorInstances, editorSelections } from './editor-view';
import { propCells } from '../prop-footprint';
import { mapDimensions } from '../model';
import type { EditableMapDocument, Point } from '../model';
import type { ObjectCommand } from './object-command';
import { makeSavedMap, parseSavedMap, parseBundle, serializeBundle } from '../../save/save-format';

function accept(map: EditableMapDocument, command: ObjectCommand): EditableMapDocument {
  const result = applyEditorCommand(map, command);
  if (!result.ok) throw Error(result.error);
  return result.document;
}
function place(
  map: EditableMapDocument,
  make: (target: Point) => ObjectCommand,
): EditableMapDocument {
  const { width } = mapDimensions(map);
  for (const [index, walkable] of map.layout.tiles.entries())
    if (walkable) {
      const result = applyEditorCommand(
        map,
        make({ x: index % width, y: Math.floor(index / width) }),
      );
      if (result.ok && result.document !== map) return result.document;
    }
  throw Error('Missing valid bench position');
}
for (const base of [
  editorFixture(),
  forestEditorFixture(),
  courtyardEditorFixture(),
  towerEditorFixture({ floorCount: 3, portalFloor: null }),
])
  test(`${base.type}: benches occupy two cells, rotate, collide, and round-trip strictly`, () => {
    let source: EditableMapDocument = base;
    for (const item of editorSelections(base))
      if (item.removable) source = accept(source, { kind: 'remove', id: item.id });
    const before = structuredClone(source);
    expect(base.decoration.props.some((prop) => prop.kind === 'wooden_bench')).toBe(false);
    const inserted = place(source, (target) => ({ kind: 'add', propKind: 'wooden_bench', target }));
    const item = editorInstances(inserted).find((item) => item.id === 'added-1');
    if (!item) throw Error('Missing bench');
    let map = inserted;
    for (const rotation of [1, 2, 3, 0] as const) {
      map = place(map, (target) => ({ kind: 'move', id: item.id, target, rotation }));
      const bench = editorInstances(map).find((other) => other.id === item.id)?.prop;
      if (!bench) throw Error('Missing bench');
      expect(bench).toMatchObject({ footprint: { width: 2, height: 1 }, rotation, blocking: true });
      expect(bench.artRotation).toBeUndefined();
      expect(propCells(bench)).toEqual(
        rotation % 2 === 0
          ? [
              { x: bench.x, y: bench.y },
              { x: bench.x + 1, y: bench.y },
            ]
          : [
              { x: bench.x, y: bench.y },
              { x: bench.x, y: bench.y + 1 },
            ],
      );
      const second = propCells(bench)[1];
      if (!second) throw Error('Missing second cell');
      expect(applyEditorCommand(map, { kind: 'add', propKind: 'crate', target: second }).ok).toBe(
        false,
      );
      const record = makeSavedMap(
        map,
        'Bench',
        'data:image/png;base64,AAAA',
        'bench',
        '2026-11-23T12:00:00Z',
      );
      expect(parseSavedMap(record)?.map).toEqual(map);
      expect(parseBundle(serializeBundle([record]))).toEqual({
        ok: true,
        maps: [record],
        skipped: 0,
      });
      for (const corrupt of [
        { footprint: { width: 1, height: 1 } },
        { rotation: 4 },
        { artRotation: 1 },
        { footprint: undefined },
      ]) {
        const bad = structuredClone(record);
        const prop = bad.map.objectEdits?.added[0]?.prop;
        if (!prop) throw Error('Missing saved bench');
        Object.assign(prop, corrupt);
        expect(parseSavedMap(bad)).toBeUndefined();
      }
    }
    expect(accept(map, { kind: 'reset' })).toEqual(base);
    expect(editorInstances(accept(map, { kind: 'remove', id: item.id }))).toEqual(
      editorInstances(source),
    );
    expect(source).toEqual(before);
    // A turn that puts the second cell across a wall must fail without changing the accepted bench.
    const { width } = mapDimensions(source);
    let refused = false;
    for (const [index, walkable] of source.layout.tiles.entries())
      if (walkable) {
        const target = { x: index % width, y: Math.floor(index / width) };
        const horizontal = applyEditorCommand(source, {
          kind: 'add',
          propKind: 'wooden_bench',
          target,
          rotation: 0,
        });
        if (!horizontal.ok) continue;
        const vertical = applyEditorCommand(horizontal.document, {
          kind: 'move',
          id: 'added-1',
          target,
          rotation: 1,
        });
        if (!vertical.ok) {
          expect(
            editorInstances(horizontal.document).find((item) => item.id === 'added-1')?.prop
              .rotation,
          ).toBe(0);
          refused = true;
          break;
        }
      }
    expect(refused).toBe(true);
  });
