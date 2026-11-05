import { expect, test } from 'vitest';
import {
  layeredRugFixture,
  acceptLayerCommand as accept,
} from '../../../../scripts/layer-test-support';
import { rotationFixture, validCommand } from '../../../../scripts/editor-test-support';
import { dungeonBase, dungeonInstances, resolveDungeon } from './document';
import { dungeonSelections } from './dungeon-selection';
import { dungeonOverlaps, orderedDungeonObjects } from './dungeon-drawing-order';
import { applyObjectCommand } from './commands';
import { parseDungeonEdits } from './parse-edits';
import { makeSavedMap, parseSavedMap, saveVocabulary } from '../../save/save-format';
import { propCells } from '../prop-footprint';
import { toggleDungeonDoor, dungeonDoors } from '../dungeon-doors';

test('a rug steps over two physical objects without changing their position, blocking or base', () => {
  const { base, rug, prepared, once, covered } = layeredRugFixture();
  expect(dungeonInstances(covered)).toEqual(dungeonInstances(prepared));
  expect(dungeonBase(covered)).toEqual(base);
  expect(covered.objectEdits?.version).toBe(5);
  const order = (map: typeof covered) =>
    orderedDungeonObjects(
      dungeonInstances(map),
      map.objectEdits?.version === 5 ? map.objectEdits.order : [],
    );
  expect(order(prepared).findIndex((i) => i.id === rug.id)).toBeLessThan(
    order(prepared).findIndex((i) => i.id === 'added-1'),
  );
  expect(
    dungeonOverlaps(order(once), dungeonSelections(once)).find((i) => i.id === rug.id)?.underneath,
  ).toEqual(['added-1']);
  expect(
    dungeonOverlaps(order(covered), dungeonSelections(covered)).find((i) => i.id === rug.id)
      ?.underneath,
  ).toEqual(['added-1', 'added-2']);
  const blocked = dungeonInstances(covered)
    .filter((i) => i.prop.blocking)
    .flatMap((i) => propCells(i.prop));
  expect(blocked).toContainEqual({ x: rug.prop.x, y: rug.prop.y });
  expect(
    applyObjectCommand(covered, { kind: 'add', propKind: 'barrel', target: rug.prop }).ok,
  ).toBe(false);
  const backwards = accept(accept(covered, { kind: 'order', id: rug.id, direction: 'backward' }), {
    kind: 'order',
    id: rug.id,
    direction: 'backward',
  });
  expect(order(backwards)).toEqual(order(prepared));
  expect(applyObjectCommand(covered, { kind: 'order', id: rug.id, direction: 'forward' })).toEqual({
    ok: true,
    document: covered,
  });
});

test('custom order survives movement and insertion, and deletion removes obsolete IDs', () => {
  const { covered, rug } = layeredRugFixture();
  const moved = accept(
    covered,
    validCommand(covered, (target) => ({ kind: 'move', id: rug.id, target }), rug.prop),
  );
  expect(moved.objectEdits?.version === 5 && moved.objectEdits.order).toEqual(
    covered.objectEdits?.version === 5 && covered.objectEdits.order,
  );
  const removed = accept(covered, { kind: 'remove', id: 'added-1' });
  expect(removed.objectEdits?.version === 5 && removed.objectEdits.order).not.toContain('added-1');
  const recovered = accept(removed, { kind: 'add', propKind: 'barrel', target: rug.prop });
  expect(parseDungeonEdits(dungeonBase(recovered), recovered.objectEdits)).toEqual(recovered);
  const items = orderedDungeonObjects(
    dungeonInstances(recovered),
    recovered.objectEdits?.version === 5 ? recovered.objectEdits.order : [],
  );
  expect(items.at(-1)?.id).toBe('added-3');
  const surfaced = accept(covered, { kind: 'add', propKind: 'moss', target: rug.prop });
  const surfaceItems = orderedDungeonObjects(
    dungeonInstances(surfaced),
    surfaced.objectEdits?.version === 5 ? surfaced.objectEdits.order : [],
  );
  expect(surfaceItems[0]?.prop.kind).toBe('moss');
  expect(surfaceItems[0]?.id).toBe('added-3');
  expect(parseDungeonEdits(dungeonBase(surfaced), surfaced.objectEdits)).toEqual(surfaced);
});

test('format 24 introduces authored order and later formats retain it; malformed permutations and future edit versions are rejected', () => {
  const { base, covered } = layeredRugFixture();
  const edits = covered.objectEdits;
  if (edits?.version !== 5) throw Error('Missing order');
  const saved = makeSavedMap(
    covered,
    'Covered boxes',
    'data:image/png;base64,AAAA',
    'layers',
    '2026-11-03T12:00:00Z',
  );
  expect(parseSavedMap(saved)?.map).toEqual(covered);
  expect(saved.saveFormatVersion).toBe('26.0.0');
  expect(saveVocabulary('23.0.0')?.objectEditVersions).toEqual([1, 2, 3, 4]);
  expect(saveVocabulary('24.0.0')?.objectEditVersions).toEqual([1, 2, 3, 4, 5]);
  for (let v = 1; v <= 23; v++)
    expect(parseSavedMap({ ...saved, saveFormatVersion: `${v}.0.0` })).toBeUndefined();
  for (const order of [
    undefined,
    {},
    [42],
    edits.order.slice(1),
    [...edits.order, edits.order[0]],
    edits.order.map((_, i) => (i === 0 ? 'base-999999' : edits.order[i])),
  ])
    expect(parseDungeonEdits(base, { ...edits, order })).toBeUndefined();
  expect(parseDungeonEdits(base, { ...edits, version: 4 })).toBeUndefined();
  expect(parseDungeonEdits(base, { ...edits, version: 6 })).toBeUndefined();
});

test('complete additions reorder as units without breaking rotations or exposing their internal overlaps as badges', () => {
  const { prepared, target } = rotationFixture('study');
  let map = accept(prepared, { kind: 'move-group', id: 'study', target, rotation: 1 });
  const study = dungeonSelections(map).find((i) => i.groupId === 'study');
  const rug = dungeonInstances(map).find((i) => i.prop.kind === 'rug');
  if (!study || !rug) throw Error('Missing study');
  map = accept(map, { kind: 'add', propKind: 'barrel', target: rug.prop });
  const changed = accept(map, { kind: 'order', id: study.id, direction: 'forward' });
  expect(changed).not.toBe(map);
  expect(dungeonInstances(changed)).toEqual(dungeonInstances(map));
  expect(parseDungeonEdits(dungeonBase(changed), changed.objectEdits)).toEqual(changed);
  const edits = changed.objectEdits;
  if (edits?.version !== 5) throw Error('Missing order');
  const reversedMembers = [...groupOrder(changed)].reverse();
  let nextMember = 0;
  const tampered = edits.order.map((id) =>
    study.members.includes(id) ? reversedMembers[nextMember++] : id,
  );
  expect(parseDungeonEdits(dungeonBase(changed), { ...edits, order: tampered })).toBeUndefined();
  function groupOrder(document: typeof changed) {
    return orderedDungeonObjects(
      dungeonInstances(document),
      document.objectEdits?.version === 5 ? document.objectEdits.order : [],
    )
      .filter((item) => study?.members.includes(item.id))
      .map((item) => item.id);
  }

  expect(resolveDungeon(changed)).toMatchObject({ studyTransform: { move: { rotation: 1 } } });
  const ordered = orderedDungeonObjects(
    dungeonInstances(changed),
    changed.objectEdits?.version === 5 ? changed.objectEdits.order : [],
  );
  const groupIds = ordered.filter((i) => study.members.includes(i.id)).map((i) => i.id);
  expect(groupIds).toEqual(
    orderedDungeonObjects(dungeonInstances(map))
      .filter((i) => study.members.includes(i.id))
      .map((i) => i.id),
  );
  expect(
    dungeonOverlaps(ordered, dungeonSelections(changed))
      .filter((i) => study.members.includes(i.id))
      .every((i) => i.underneath.every((id) => !study.members.includes(id))),
  ).toBe(true);
});

test('locked items and unknown selections reject order changes; resetting order and placement preserves doors', () => {
  const { base, covered } = layeredRugFixture();
  const locked = dungeonSelections(covered).find((i) => i.lock);
  if (!locked) throw Error('Missing attachment');
  expect(
    applyObjectCommand(covered, { kind: 'order', id: locked.id, direction: 'forward' }).ok,
  ).toBe(false);
  expect(
    applyObjectCommand(covered, { kind: 'order', id: 'unknown', direction: 'forward' }).ok,
  ).toBe(false);
  const door = dungeonDoors(base.layout)[0];
  if (!door) throw Error('Missing door');
  const opened = toggleDungeonDoor(covered, door.id);
  if (!opened.ok) throw Error(opened.error);
  expect(accept(opened.document, { kind: 'reset' })).toEqual({
    ...base,
    doorStates: opened.document.doorStates,
  });
});
