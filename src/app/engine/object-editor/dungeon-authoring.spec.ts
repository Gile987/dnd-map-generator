import { expect, test } from 'vitest';
import { generateDungeon } from '../generate';
import { editorFixture, validCommand } from '../../../../scripts/editor-test-support';
import { applyObjectCommand, authoredPlacementError } from './commands';
import type { DungeonDocument, Point } from '../model';
import { contains, DENSITY_BUDGETS, isFloor } from '../model';
import { dungeonBase, dungeonInstances, resolveDungeon } from './document';
import { dungeonGroups } from './dungeon-groups';
import { dungeonSelections } from './dungeon-selection';
import { parseDungeonEdits } from './parse-edits';
import { individualObjectLock } from './dungeon-authoring-rules';
import { propCells } from '../prop-footprint';
import { areaContains, areasOverlap } from '../feature-reservation';
import { currentDungeonGroups } from './dungeon-authoring-rules';
import oldEdits from '../../save/fixtures/dungeon-editor-v1.json';
import { parseBundle } from '../../save/save-format';

function accept(doc: DungeonDocument, id: string, target: Point, group = false): DungeonDocument {
  const result = applyObjectCommand(doc, { kind: group ? 'move-group' : 'move', id, target });
  if (!result.ok) throw new Error(result.error);
  return result.document;
}
function independentAccess(doc: DungeonDocument) {
  const map = resolveDungeon(doc),
    blocked = new Set(
      map.decoration.props
        .filter((p) => p.blocking)
        .flatMap(propCells)
        .map((p) => p.y * 40 + p.x),
    );
  const visited = new Set<number>(),
    queue = [map.layout.entrance.y * 40 + map.layout.entrance.x];
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i];
    if (cell === undefined || visited.has(cell)) continue;
    visited.add(cell);
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const x = (cell % 40) + dx,
        y = Math.floor(cell / 40) + dy,
        n = y * 40 + x;
      if (
        x >= 0 &&
        x < 40 &&
        y >= 0 &&
        y < 30 &&
        map.layout.tiles[n] &&
        !blocked.has(n) &&
        !visited.has(n)
      )
        queue.push(n);
    }
  }
  expect(visited.size).toBe(map.layout.tiles.filter(Boolean).length - blocked.size);
}

test('opening old edits and rejected/no-op commands retain v1; a real successful change explicitly adopts v2', () => {
  const parsed = parseBundle(JSON.stringify(oldEdits));
  if (!parsed.ok) throw Error(parsed.error);
  const doc = parsed.maps[0]?.map;
  if (doc?.type !== 'dungeon' || doc.objectEdits?.version !== 1) throw Error('Missing v1 fixture');
  const before = structuredClone(doc),
    added = doc.objectEdits.added[0];
  if (!added) throw Error('Missing old added object');
  const noop = applyObjectCommand(doc, { kind: 'move', id: added.id, target: added.prop });
  expect(noop.ok && noop.document).toBe(doc);
  expect(applyObjectCommand(doc, { kind: 'move', id: added.id, target: { x: 0, y: 0 } }).ok).toBe(
    false,
  );
  const changed = applyObjectCommand(
    doc,
    validCommand(doc, (target) => ({ kind: 'add', propKind: 'moss', target })),
  );
  if (!changed.ok) throw Error(changed.error);
  expect(changed.document.objectEdits?.version).toBe(3);
  expect(parseDungeonEdits(dungeonBase(doc), changed.document.objectEdits)).toEqual(
    changed.document,
  );
  expect(doc).toEqual(before);
});

test('the reported barrel-shaped move into open passage floor is valid, while blocking the actual route remains invalid', () => {
  const base = editorFixture(),
    source = dungeonInstances(base).find(
      (i) => i.prop.kind === 'barrel' && i.prop.x === 21 && i.prop.y === 5,
    );
  if (!source) throw new Error('Missing reported-room barrel');
  const atStart = accept(base, source.id, { x: 21, y: 7 });
  const target = { x: 21, y: 9 };
  expect(isFloor(base.layout, target.x, target.y)).toBe(true);
  expect(base.layout.rooms.some((room) => contains(room, target))).toBe(false);
  const legacy = {
    ...base,
    objectEdits: {
      version: 1 as const,
      nextId: 1,
      moves: [{ id: source.id, ...target }],
      removed: [],
      added: [],
    },
  };
  expect(authoredPlacementError(legacy)).toBe('Place the object inside a room.');
  const edited = accept(atStart, source.id, target);
  expect(dungeonInstances(edited).find((i) => i.id === source.id)?.prop).toMatchObject(target);
  independentAccess(edited);
  expect(parseDungeonEdits(base, edited.objectEdits)).toEqual(edited);
  expect(accept(edited, source.id, source.prop)).toEqual(base);
});

test('wall-side objects can move along and between solid walls without a blanket empty-square margin', () => {
  const base = editorFixture(),
    source = dungeonInstances(base).find(
      (i) => i.prop.kind === 'barrel' && i.prop.x === 16 && i.prop.y === 24,
    );
  if (!source) throw new Error('Missing wall barrel');
  for (const target of [
    { x: 16, y: 26 },
    { x: 20, y: 26 },
  ]) {
    const legacy = {
      ...base,
      objectEdits: {
        version: 1 as const,
        nextId: 1,
        moves: [{ id: source.id, ...target }],
        removed: [],
        added: [],
      },
    };
    expect(authoredPlacementError(legacy)).toBe(
      'Leave one square between the object and solid walls.',
    );
    const edited = accept(base, source.id, target);
    independentAccess(edited);
    expect(parseDungeonEdits(base, edited.objectEdits)).toEqual(edited);
  }
  expect(
    applyObjectCommand(base, { kind: 'move', id: source.id, target: { x: 15, y: 26 } }).ok,
  ).toBe(false);
});

test.each(['study', 'statue', 'table', 'ritual'] as const)(
  '%s moves as one rigid addition with complete group identity and atomic refusal',
  (id) => {
    const options = {
      study: { scene: 'Forgotten study' as const },
      statue: { landmark: 'weathered-statue' as const },
      table: { furniture: 'dining-table' as const },
      ritual: { ritual: true },
    }[id];
    const r = generateDungeon({
      seed: 'mosslit-sanctum',
      roomCount: 6,
      density: 'Balanced',
      preset: 'Mosslit',
      ...options,
    });
    if (!r.ok) throw new Error(r.error);
    const base = r.map,
      original = structuredClone(base),
      group = dungeonGroups(base).find((g) => g.id === id);
    if (!group) throw new Error('Missing group');
    let prepared: DungeonDocument = base;
    for (const item of dungeonInstances(base))
      if (!individualObjectLock(base, item.id, item.prop)) {
        const result = applyObjectCommand(prepared, { kind: 'remove', id: item.id });
        if (!result.ok) throw new Error(result.error);
        prepared = result.document;
      }
    const command = validCommand(
      prepared,
      (target) => ({ kind: 'move-group', id, target }),
      group.area,
    );
    if (command.kind !== 'move-group') throw new Error('Missing move');
    const moved = accept(prepared, id, command.target, true),
      dx = command.target.x - group.area.x,
      dy = command.target.y - group.area.y;
    const before = dungeonInstances(prepared),
      after = dungeonInstances(moved);
    for (const item of before) {
      const expected = group.members.includes(item.id)
        ? { ...item.prop, x: item.prop.x + dx, y: item.prop.y + dy }
        : item.prop;
      expect(after.find((p) => p.id === item.id)?.prop).toEqual(expected);
    }
    expect(dungeonSelections(moved).find((s) => s.groupId === id)?.members).toEqual(group.members);
    for (const member of group.members)
      expect(
        applyObjectCommand(moved, { kind: 'move', id: member, target: { x: 10, y: 10 } }).ok,
      ).toBe(false);
    expect(applyObjectCommand(moved, { kind: 'move-group', id, target: { x: 0, y: 0 } }).ok).toBe(
      false,
    );
    expect(parseDungeonEdits(base, moved.objectEdits)).toEqual(moved);
    expect(accept(moved, id, group.area, true)).toEqual(prepared);
    expect(base).toEqual(original);
    expect(dungeonBase(moved)).toEqual(base);
    independentAccess(moved);
  },
);

test('real doors and layout markers stay clear; visible refusals are actual geometry errors', () => {
  const base = editorFixture(),
    source = dungeonInstances(base).find((i) => !individualObjectLock(base, i.id, i.prop));
  if (!source) throw new Error('Missing source');
  for (const point of [...base.layout.thresholds, base.layout.entrance, base.layout.objective])
    expect(applyObjectCommand(base, { kind: 'move', id: source.id, target: point })).toMatchObject({
      ok: false,
      error: 'Keep the doorway, entrance stairs and objective clear.',
    });
});

test('a clear passage can contain one barrel, but closing its second lane is rejected without mutation', () => {
  const base = editorFixture(),
    items = dungeonInstances(base);
  const barrel = items.find((i) => i.prop.kind === 'barrel' && i.prop.x === 21 && i.prop.y === 5),
    crate = items.find((i) => i.prop.kind === 'crate');
  if (!barrel || !crate) throw new Error('Missing passage fixtures');
  const first = accept(base, barrel.id, { x: 17, y: 7 }),
    before = structuredClone(first);
  independentAccess(first);
  expect(
    applyObjectCommand(first, { kind: 'move', id: crate.id, target: { x: 17, y: 8 } }),
  ).toMatchObject({
    ok: false,
    error: 'Keep every floor area reachable and a clear 2 × 2 space in each room.',
  });
  expect(first).toEqual(before);
});

test('neighboring additions can share empty circulation floor without allowing occupied areas to collide', () => {
  const result = generateDungeon({
    seed: 'mosslit-sanctum',
    roomCount: 6,
    density: 'Balanced',
    preset: 'Mosslit',
    landmark: 'weathered-statue',
    furniture: 'dining-table',
  });
  if (!result.ok) throw Error(result.error);
  const base = result.map;
  const removed = dungeonInstances(base)
    .filter((i) => !individualObjectLock(base, i.id, i.prop))
    .map((i) => i.id);
  const document = {
    ...base,
    objectEdits: {
      version: 2 as const,
      nextId: 1,
      moves: [],
      added: [],
      removed,
      groups: [
        { id: 'statue' as const, x: 26, y: 8 },
        { id: 'table' as const, x: 30, y: 8 },
      ],
    },
  };
  const groups = currentDungeonGroups(base, document);
  const first = groups[0],
    second = groups[1];
  if (!first || !second) throw Error('Missing groups');
  expect(areasOverlap(first.area, second.area)).toBe(true);
  expect(authoredPlacementError(document)).toBeUndefined();
  expect(parseDungeonEdits(base, document.objectEdits)).toEqual(document);
  independentAccess(document);
  const blocked = {
    ...document.objectEdits,
    groups: document.objectEdits.groups.map((g) => (g.id === 'table' ? { ...g, x: 27 } : g)),
  };
  expect(parseDungeonEdits(base, blocked)).toBeUndefined();
});

test('moving an existing blocker into another room is not limited by the generator’s local distribution budget', () => {
  const base = editorFixture(),
    items = dungeonInstances(base);
  for (const room of base.layout.rooms) {
    const blocked = items.filter((i) => i.prop.blocking && contains(room, i.prop)).length;
    const budget = Math.floor(room.width * room.height * DENSITY_BUDGETS[base.decoration.density]);
    if (blocked < budget) continue;
    const source = items.find(
      (i) =>
        i.prop.blocking && !contains(room, i.prop) && !individualObjectLock(base, i.id, i.prop),
    );
    if (!source) continue;
    for (let y = room.y; y < room.y + room.height; y++)
      for (let x = room.x; x < room.x + room.width; x++) {
        const moved = applyObjectCommand(base, { kind: 'move', id: source.id, target: { x, y } });
        if (!moved.ok) continue;
        expect(
          dungeonInstances(moved.document).filter((i) => i.prop.blocking && contains(room, i.prop)),
        ).toHaveLength(blocked + 1);
        expect(dungeonInstances(moved.document).filter((i) => i.prop.blocking)).toHaveLength(
          items.filter((i) => i.prop.blocking).length,
        );
        independentAccess(moved.document);
        expect(parseDungeonEdits(base, moved.document.objectEdits)).toEqual(moved.document);
        return;
      }
  }
  throw Error(
    'Fixture should provide an otherwise valid move into a room at its generation budget',
  );
});

test('group save data rejects spoofed membership, duplicate identities and invalid geometry atomically', () => {
  const result = generateDungeon({
    seed: 'mosslit-sanctum',
    roomCount: 6,
    density: 'Balanced',
    preset: 'Mosslit',
    scene: 'Forgotten study',
  });
  if (!result.ok) throw Error(result.error);
  const base = result.map,
    group = dungeonGroups(base)[0];
  if (!group) throw Error('Missing study');
  let prepared: DungeonDocument = base;
  for (const item of dungeonInstances(base))
    if (!individualObjectLock(base, item.id, item.prop)) {
      const r = applyObjectCommand(prepared, { kind: 'remove', id: item.id });
      if (!r.ok) throw Error(r.error);
      prepared = r.document;
    }
  const command = validCommand(
    prepared,
    (target) => ({ kind: 'move-group', id: group.id, target }),
    group.area,
  );
  if (command.kind !== 'move-group') throw Error('Missing move');
  const document = accept(prepared, group.id, command.target, true),
    edits = document.objectEdits;
  if (edits?.version !== 3) throw Error('Missing edits');
  const move = edits.groups[0],
    member = group.members[0];
  if (!move || !member) throw Error('Missing identity');
  const before = structuredClone(base);
  for (const bad of [
    { ...edits, groups: [move, move] },
    { ...edits, groups: [{ ...move, id: 'unknown' }] },
    { ...edits, groups: [{ ...move, members: [] }] },
    { ...edits, groups: [{ ...move, x: move.x + 0.5 }] },
    { ...edits, groups: [{ ...move, x: 39 }] },
    { ...edits, groups: [{ ...move, x: group.area.x, y: group.area.y }] },
    { ...edits, removed: [...edits.removed, member] },
    { ...edits, moves: [{ id: member, x: 10, y: 10 }] },
  ])
    expect(parseDungeonEdits(base, bad)).toBeUndefined();
  expect(base).toEqual(before);
  expect(parseDungeonEdits(base, edits)).toEqual(document);
  const resolved = resolveDungeon(document);
  expect(resolved.objectEdits === 'resolved' && resolved.studyArea).toEqual({
    ...group.area,
    ...command.target,
  });
  for (const item of dungeonInstances(document).filter((i) => group.members.includes(i.id)))
    expect(areaContains({ ...group.area, ...command.target }, item.prop)).toBe(true);
});
