import { describe, expect, expectTypeOf, test } from 'vitest';
import { generateDungeon } from '../generate';
import { ALL_PRESETS, DUNGEON_PROP_KINDS, contains, indexOf, DENSITY_BUDGETS } from '../model';
import type { Dungeon, DungeonDocument, MapDocument } from '../model';
import type { ResolvedDungeon } from './document';
import { DUNGEON_OBJECTS_V1, DUNGEON_PALETTE } from './catalog';
import { applyObjectCommand } from './commands';
import type { ObjectCommand } from './commands';
import { dungeonBase, dungeonInstances, resolveDungeon } from './document';
import { dungeonObjectLock } from './dungeon-rules';
import { propCells } from '../prop-footprint';
import { parseDungeonEdits } from './parse-edits';

import { editorFixture, validCommand } from '../../../../scripts/editor-test-support';
function accept(document: DungeonDocument, command: ObjectCommand): DungeonDocument {
  const result = applyObjectCommand(document, command);
  if (!result.ok) throw new Error(result.error);
  return result.document;
}

test('the frozen Dungeon capability catalog accounts for every kind and exposes only audited independent items', () => {
  expect(Object.keys(DUNGEON_OBJECTS_V1).sort()).toEqual([...DUNGEON_PROP_KINDS].sort());
  expect(DUNGEON_PALETTE.map((p) => p.kind)).toEqual([
    'crate',
    'barrel',
    'rubble',
    'sarcophagus',
    'broken_column',
    'moss',
  ]);
  for (const c of Object.values(DUNGEON_OBJECTS_V1)) if (!c.editable) expect(c.reason).toBeTruthy();
});

describe.each(ALL_PRESETS)('%s authored documents', (preset) => {
  test('movement retains identity, variation, base geometry, immutable inputs and exact reset', () => {
    const base = editorFixture(preset),
      before = structuredClone(base);
    const source = dungeonInstances(base).find((item) => !dungeonObjectLock(base, item.prop));
    if (!source) throw new Error('No movable item');
    const move = validCommand(
      base,
      (target) => ({ kind: 'move', id: source.id, target }),
      source.prop,
    );
    const edited = accept(base, move),
      resolved = resolveDungeon(edited);
    expect(edited.layout).toBe(base.layout);
    expect(edited.decoration).toBe(base.decoration);
    expect(base).toEqual(before);
    expect(dungeonBase(edited)).toEqual(base);
    expect(resolved.decoration.props).not.toEqual(base.decoration.props);
    const moved = dungeonInstances(edited).find((item) => item.id === source.id);
    expect(moved?.prop.variation).toBe(source.prop.variation);
    expect(applyObjectCommand(edited, move)).toEqual({ ok: true, document: edited });
    const restored = accept(edited, { kind: 'move', id: source.id, target: source.prop });
    expect(restored).toEqual(base);
    expect(restored.objectEdits).toBeUndefined();
    expect(accept(edited, { kind: 'reset' })).toEqual(base);
  });
  test('insertion has unique persistent identity, supported movement and independently checked budgets/connectivity', () => {
    const base = editorFixture(preset);
    let edited = accept(
      base,
      validCommand(base, (target) => ({ kind: 'add', propKind: 'moss', target })),
    );
    edited = accept(
      edited,
      validCommand(edited, (target) => ({ kind: 'add', propKind: 'moss', target })),
    );
    expect(edited.objectEdits?.added.map((p) => p.id)).toEqual(['added-1', 'added-2']);
    const move = validCommand(edited, (target) => ({ kind: 'move', id: 'added-1', target }));
    edited = accept(edited, move);
    expect(parseDungeonEdits(base, edited.objectEdits)).toEqual(edited);
    const resolved = resolveDungeon(edited);
    const blocked = new Set(
      resolved.decoration.props
        .filter((p) => p.blocking)
        .flatMap(propCells)
        .map((p) => indexOf(p.x, p.y)),
    );
    const visited = new Set<number>(),
      queue = [indexOf(base.layout.entrance.x, base.layout.entrance.y)];
    for (let i = 0; i < queue.length; i++) {
      const tile = queue[i];
      if (tile === undefined || visited.has(tile)) continue;
      visited.add(tile);
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const x = (tile % 40) + dx,
          y = Math.floor(tile / 40) + dy,
          next = indexOf(x, y);
        if (
          x >= 0 &&
          x < 40 &&
          y >= 0 &&
          y < 30 &&
          base.layout.tiles[next] &&
          !blocked.has(next) &&
          !visited.has(next)
        )
          queue.push(next);
      }
    }
    expect(visited.size).toBe(base.layout.tiles.filter(Boolean).length - blocked.size);
    for (const room of base.layout.rooms) {
      expect(
        resolved.decoration.props.filter((p) => p.blocking && contains(room, p)).flatMap(propCells)
          .length,
      ).toBeLessThanOrEqual(
        Math.floor(room.width * room.height * DENSITY_BUDGETS[base.decoration.density]),
      );
    }
  });
});

test('refused placement, overlap, protected source, unsupported item and malformed coordinates leave the input intact and permit retry', () => {
  const base = editorFixture(),
    before = structuredClone(base);
  for (const propKind of ['crate', 'barrel', 'moss'] as const)
    for (const target of [
      { x: -1, y: 2 },
      { x: 0, y: 0 },
      { x: NaN, y: 2 },
      { x: Infinity, y: 2 },
      { x: 1.5, y: 2 },
      base.layout.entrance,
    ])
      expect(applyObjectCommand(base, { kind: 'add', propKind, target }).ok).toBe(false);
  for (const propKind of ['desk', 'dining_table', 'ritual_candles', 'tree', 'sconce'] as const)
    expect(applyObjectCommand(base, { kind: 'add', propKind, target: { x: 10, y: 10 } }).ok).toBe(
      false,
    );
  const edited = accept(
    base,
    validCommand(base, (target) => ({ kind: 'add', propKind: 'moss', target })),
  );
  const item = edited.objectEdits?.added[0];
  if (!item) throw new Error('Missing added object');
  expect(applyObjectCommand(edited, { kind: 'add', propKind: 'moss', target: item.prop }).ok).toBe(
    false,
  );
  expect(
    applyObjectCommand(base, { kind: 'move', id: 'base-9999999999', target: { x: 10, y: 10 } }).ok,
  ).toBe(false);
  const locked = dungeonInstances(base).find((item) => dungeonObjectLock(base, item.prop));
  if (locked)
    expect(
      applyObjectCommand(base, { kind: 'move', id: locked.id, target: { x: 10, y: 10 } }).ok,
    ).toBe(false);
  expect(base).toEqual(before);
  expect(
    applyObjectCommand(
      base,
      validCommand(base, (target) => ({ kind: 'add', propKind: 'moss', target })),
    ).ok,
  ).toBe(true);
});

test('parser rejects unsupported versions, references, complete-arrangement collisions, object spoofing and oversized collections', () => {
  const base = editorFixture(),
    edited = accept(
      base,
      validCommand(base, (target) => ({ kind: 'add', propKind: 'moss', target })),
    );
  const edits = edited.objectEdits;
  if (!edits) throw new Error('Missing edits');
  const prop = edits.added[0]?.prop;
  if (!prop) throw new Error('Missing added');
  const bad = [
    null,
    {},
    { ...edits, version: 5 },
    { ...edits, nextId: 0 },
    { ...edits, nextId: Infinity },
    { ...edits, moves: [{ id: 'base-99999', x: 10, y: 10 }] },
    { ...edits, added: [...edits.added, ...edits.added] },
    { ...edits, added: [...edits.added, { id: 'added-2', prop }], nextId: 3 },
    { ...edits, added: [{ id: 'added-1', prop: { ...prop, kind: 'desk' } }] },
    { ...edits, added: [{ id: 'added-1', prop: { ...prop, blocking: true } }] },
    { ...edits, added: [{ id: 'added-1', prop: { ...prop, variation: 0.9 } }] },
    {
      ...edits,
      added: [{ id: 'added-1', prop: { ...prop, footprint: { width: 999999, height: 999999 } } }],
    },
    { ...edits, added: Array(121).fill(edits.added[0]) },
    { ...edits, unknown: true },
    { ...edits, moves: [], added: [] },
  ];
  for (const input of bad)
    expect(parseDungeonEdits(base, input), JSON.stringify(input)?.slice(0, 120)).toBeUndefined();
});

test('protected additions remain exact and neither moved nor inserted objects can enter their reserves', () => {
  for (const options of [
    { scene: 'Forgotten study' as const },
    { ritual: true },
    { landmark: 'weathered-statue' as const },
    { furniture: 'dining-table' as const },
  ]) {
    const result = generateDungeon({
      seed: 'mosslit-sanctum',
      roomCount: 6,
      density: 'Balanced',
      preset: 'Mosslit',
      ...options,
    });
    if (!result.ok) throw new Error(result.error);
    const base = result.map;
    const locked = dungeonInstances(base).filter((item) => dungeonObjectLock(base, item.prop));
    expect(locked.length).toBeGreaterThan(0);
    for (const item of locked)
      expect(
        applyObjectCommand(base, { kind: 'move', id: item.id, target: { x: 10, y: 10 } }).ok,
      ).toBe(false);
    const edited = accept(
      base,
      validCommand(base, (target) => ({ kind: 'add', propKind: 'moss', target })),
    );
    for (const item of locked)
      expect(resolveDungeon(edited).decoration.props).toContainEqual(item.prop);
  }
});

test('the command boundary stores only coordinates from structurally richer pointer/inspector targets', () => {
  const base = editorFixture(),
    source = dungeonInstances(base).find((item) => !dungeonObjectLock(base, item.prop));
  if (!source) throw new Error('Missing source');
  const command = validCommand(
    base,
    (target) => ({ kind: 'move', id: source.id, target }),
    source.prop,
  );
  if (command.kind !== 'move') throw new Error('Missing move');
  const edited = accept(base, { ...command, target: { ...source.prop, ...command.target } });
  expect(edited.objectEdits?.moves[0]).toEqual({
    id: source.id,
    x: command.target.x,
    y: command.target.y,
  });
  expect(parseDungeonEdits(base, edited.objectEdits)).toEqual(edited);
});

test('removing eligible blockers permits replacements without changing density and removed identities roundtrip atomically', () => {
  const base = editorFixture(),
    source = dungeonInstances(base).find(
      (item) => item.prop.blocking && !dungeonObjectLock(base, item.prop),
    );
  if (!source) throw new Error('Missing blocker');
  const removed = accept(base, { kind: 'remove', id: source.id });
  expect(dungeonInstances(removed).some((item) => item.id === source.id)).toBe(false);
  expect(removed.objectEdits?.removed).toEqual([source.id]);
  expect(parseDungeonEdits(base, removed.objectEdits)).toEqual(removed);
  expect(applyObjectCommand(removed, { kind: 'remove', id: source.id }).ok).toBe(false);
  expect(applyObjectCommand(removed, { kind: 'move', id: source.id, target: source.prop }).ok).toBe(
    false,
  );
  const command = validCommand(removed, (target) => ({ kind: 'add', propKind: 'barrel', target }));
  const replaced = accept(removed, command);
  expect(replaced.decoration.density).toBe(base.decoration.density);
  expect(parseDungeonEdits(base, replaced.objectEdits)).toEqual(replaced);
  const added = replaced.objectEdits?.added[0];
  if (!added) throw new Error('Missing added blocker');
  const deleted = accept(replaced, { kind: 'remove', id: added.id });
  expect(dungeonInstances(deleted)).toEqual(dungeonInstances(removed));
  expect(deleted.objectEdits?.nextId).toBe(2);
  expect(parseDungeonEdits(base, deleted.objectEdits)).toEqual(deleted);
  const readded = accept(deleted, command);
  expect(readded.objectEdits?.added[0]?.id).toBe('added-2');
  expect(
    parseDungeonEdits(base, { ...removed.objectEdits, removed: [source.id, source.id] }),
  ).toBeUndefined();
  expect(
    parseDungeonEdits(base, { ...removed.objectEdits, moves: [{ id: source.id, x: 18, y: 18 }] }),
  ).toBeUndefined();
});

test('resolved artwork views are excluded from generator/save document contracts', () => {
  expectTypeOf<ResolvedDungeon>().not.toExtend<Dungeon>();
  expectTypeOf<ResolvedDungeon>().not.toExtend<MapDocument>();
});
