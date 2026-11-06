import { towerStairFootprint } from '../tower-connection-geometry';
import { shapeContains } from '../feature-reservation';
import legacySeparate from '../../save/fixtures/tower-v1.json';
import legacySpiral from '../../save/fixtures/tower-v2.json';
import { parseBundle } from '../../save/save-format';
import { editableTowerStairs } from './tower-stairs';
import { parseTowerEdits } from './parse-tower-edits';
import { expect, test } from 'vitest';
import {
  towerStairFixture,
  towerEditorFixture,
  clearTower,
  validTowerCommand,
  acceptTower,
} from '../../../../scripts/tower-editor-test-support';
import { towerSelections } from './tower-rules';
import { resolveTower, towerBase } from './tower-document';
import { towerStairLandings } from '../tower-landings';
import { applyTowerCommand } from './tower-commands';

test.each(['spiral', 'separate'] as const)(
  '%s stairs can move with their routes and captions, without mutating the canonical tower',
  (stairStyle) => {
    const base = towerEditorFixture({ stairStyle, portalFloor: null }),
      map = clearTower(base),
      before = JSON.stringify(map);
    const stair = towerSelections(map).find((s) => s.id.startsWith('stairs-') && s.position.x < 16);
    expect(stair, 'Stairs must be selectable').toBeDefined();
    if (!stair) throw Error('Missing stairs');
    const command = validTowerCommand(
      map,
      1,
      (target) => ({ kind: 'move', id: stair.id, target }),
      stair.position,
    );
    const moved = acceptTower(map, command);
    expect(JSON.stringify(map)).toBe(before);
    expect(towerBase(moved)).toEqual(base);
    expect(resolveTower(moved).layout.connections).not.toEqual(base.layout.connections);
    expect(towerStairLandings(resolveTower(moved)).map((l) => l.routes)).toEqual(
      towerStairLandings(base).map((l) => l.routes),
    );
    expect(applyTowerCommand(moved, { kind: 'reset' })).toEqual({ ok: true, document: base });
  },
);

test.each(['spiral', 'separate'] as const)(
  '%s relocation releases the old landing, protects the new one, and keeps furniture commands and imports consistent',
  (stairStyle) => {
    const { base, prepared, stair, moved, command } = towerStairFixture(stairStyle);
    const current = editableTowerStairs(moved).find((s) => s.id === stair.id);
    if (!current) throw Error('Missing moved stairs');
    expect(current).toMatchObject(command.target);
    expect(current.routes).toEqual(stair.routes);
    if (stairStyle === 'spiral') expect(current.routes).toHaveLength(2);
    const withBox = acceptTower(moved, { kind: 'add', propKind: 'crate', target: stair });
    expect(parseTowerEdits(base, withBox.objectEdits)).toEqual(withBox);
    expect(
      applyTowerCommand(withBox, { kind: 'add', propKind: 'crate', target: current }),
    ).toMatchObject({ ok: false, error: expect.stringContaining('stairs') });
    expect(applyTowerCommand(withBox, { kind: 'move', id: stair.id, target: stair })).toMatchObject(
      { ok: false },
    );
    const removed = acceptTower(withBox, { kind: 'remove', id: 'added-1' });
    const restored = acceptTower(removed, { kind: 'move', id: stair.id, target: stair });
    expect(restored.objectEdits?.version).toBe(1);
    expect(resolveTower(restored).layout).toEqual(base.layout);
    expect(applyTowerCommand(prepared, { kind: 'move', id: stair.id, target: stair })).toEqual({
      ok: true,
      document: prepared,
    });
  },
);

test('stairs reject cross-floor, wall, portal, other landing and occupied destinations, then accept a corrected move', () => {
  const { prepared, stair, command } = towerStairFixture('separate');
  const otherFloor = editableTowerStairs(prepared).find((s) => s.floor !== stair.floor),
    otherStair = editableTowerStairs(prepared).find(
      (s) => s.floor === stair.floor && s.id !== stair.id,
    );
  if (!otherFloor || !otherStair) throw Error('Missing other stairs');
  const before = JSON.stringify(prepared);
  for (const target of [otherFloor, otherStair, { x: 0, y: 0 }, { x: NaN, y: 5 }, { x: 5.5, y: 5 }])
    expect(applyTowerCommand(prepared, { kind: 'move', id: stair.id, target }).ok).toBe(false);
  for (const kind of ['remove', 'order', 'move-group'] as const) {
    const action =
      kind === 'order'
        ? { kind, id: stair.id, direction: 'forward' as const }
        : kind === 'move-group'
          ? { kind, id: stair.id, target: command.target }
          : { kind, id: stair.id };
    expect(applyTowerCommand(prepared, action).ok).toBe(false);
  }
  // Put a box at a valid future landing, then move the stairs onto it.
  const occupied = acceptTower(prepared, {
    kind: 'add',
    propKind: 'crate',
    target: command.target,
  });
  expect(applyTowerCommand(occupied, command).ok).toBe(false);
  expect(applyTowerCommand(prepared, command).ok).toBe(true);
  expect(JSON.stringify(prepared)).toBe(before);
  const portalBase = clearTower(
      towerEditorFixture({ laboratoryFloor: undefined, observatoryFloor: undefined }),
    ),
    portal = portalBase.layout.connections.find((c) => c.kind === 'portal'),
    localStair = portal && editableTowerStairs(portalBase).find((s) => s.floor === portal.from);
  if (!portal || !localStair) throw Error('Missing portal stairs');
  expect(
    applyTowerCommand(portalBase, { kind: 'move', id: localStair.id, target: portal.departure }).ok,
  ).toBe(false);
  const errors = [];
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++) {
      const result = applyTowerCommand(portalBase, {
        kind: 'move',
        id: localStair.id,
        target: { x: portal.departure.x + dx, y: portal.departure.y + dy },
      });
      if (!result.ok) errors.push(result.error);
    }
  expect(errors.some((e) => e.includes('portal'))).toBe(true);
});

test('a stairs-only edit can be saved, returned to its original position, and reset exactly', () => {
  const { base, stair, command } = towerStairFixture();
  const moved = acceptTower(
    base,
    validTowerCommand(base, stair.floor, (target) => ({ ...command, target }), stair),
  );
  expect(moved.objectEdits).toMatchObject({
    version: 2,
    moves: [],
    removed: [],
    added: [],
    groups: [],
    order: [],
  });
  expect(parseTowerEdits(base, moved.objectEdits)).toEqual(moved);
  expect(acceptTower(moved, { kind: 'move', id: stair.id, target: stair })).toEqual(base);
  expect(acceptTower(moved, { kind: 'reset' })).toEqual(base);
});

test.each([legacySeparate, legacySpiral])(
  'historical Tower $saveFormatVersion landings can be edited without upgrading the generator',
  (fixture) => {
    const bundle = parseBundle(JSON.stringify(fixture));
    if (!bundle.ok) throw Error(bundle.error);
    for (const saved of bundle.maps) {
      const base = saved.map;
      if (base.type !== 'tower') throw Error('Expected Tower');
      const prepared = clearTower(base),
        stair = editableTowerStairs(prepared)[0];
      if (!stair) throw Error('Missing historic stairs');
      const command = validTowerCommand(
          prepared,
          stair.floor,
          (target) => ({ kind: 'move', id: stair.id, target }),
          stair,
        ),
        moved = acceptTower(prepared, command);
      expect(moved.version).toBe(base.version);
      expect(towerBase(moved)).toEqual(base);
      expect(parseTowerEdits(towerBase(moved), moved.objectEdits)).toEqual(moved);
      expect(acceptTower(moved, { kind: 'reset' })).toEqual(base);
    }
  },
);

test.each(['spiral', 'separate'] as const)(
  '%s stairs accept clear ground beside furniture outside the visible caption, while actual overlap still rejects',
  (stairStyle) => {
    const base = towerEditorFixture({
        stairStyle,
        portalFloor: null,
        laboratoryFloor: undefined,
        observatoryFloor: undefined,
      }),
      prepared = clearTower(base),
      stair = editableTowerStairs(prepared).find((s) => s.floor === 1);
    if (!stair) throw Error('Missing first-floor staircase');
    const target = { x: 8, y: 10 },
      adjacent = { x: 8, y: 13 },
      occupied = acceptTower(prepared, { kind: 'add', propKind: 'barrel', target: adjacent }),
      command = { kind: 'move' as const, id: stair.id, target };
    const moved = applyTowerCommand(occupied, command);
    expect(moved, 'Furniture below the visible caption must not block clear ground').toMatchObject({
      ok: true,
    });
    if (!moved.ok) throw Error(moved.error);
    expect(parseTowerEdits(base, moved.document.objectEdits)).toEqual(moved.document);
    // The same geometry applies when furniture is placed after the stairs.
    const stairsFirst = acceptTower(prepared, command);
    expect(acceptTower(stairsFirst, { kind: 'add', propKind: 'barrel', target: adjacent })).toEqual(
      moved.document,
    );
    for (const blocked of [target, { x: target.x, y: target.y + 2 }])
      expect(
        applyTowerCommand(moved.document, { kind: 'move', id: 'added-1', target: blocked }).ok,
      ).toBe(false);
    expect(acceptTower(moved.document, { kind: 'move', id: stair.id, target: stair })).toEqual(
      occupied,
    );
    // Returning the last moved stair must not revive the invisible padding when
    // the sparse sidecar returns to furniture-only version 1.
    const belowOriginal = { x: stair.x, y: stair.y + 3 },
      nearOriginal = acceptTower(prepared, {
        kind: 'add',
        propKind: 'barrel',
        target: belowOriginal,
      }),
      movedAway = acceptTower(
        nearOriginal,
        validTowerCommand(
          nearOriginal,
          1,
          (target) => ({ kind: 'move', id: stair.id, target }),
          stair,
        ),
      ),
      returned = acceptTower(movedAway, { kind: 'move', id: stair.id, target: stair });
    expect(returned).toEqual(nearOriginal);
    expect(returned.objectEdits?.version).toBe(1);
    expect(parseTowerEdits(base, returned.objectEdits)).toEqual(returned);
  },
);

test.each(['spiral', 'separate'] as const)(
  '%s stairs fit the circular room even when their outline touches a partially walkable edge cell',
  (stairStyle) => {
    const base = towerEditorFixture({
        stairStyle,
        portalFloor: null,
        laboratoryFloor: undefined,
        observatoryFloor: undefined,
      }),
      prepared = clearTower(base);
    // Sample both one-route landings and the taller shared up/down caption.
    for (const number of [1, 2, 8]) {
      const floor = base.layout.floors.find((f) => f.number === number),
        stair = editableTowerStairs(prepared).find((s) => s.floor === number);
      if (!floor || !stair) throw Error('Missing floor or landing');
      for (const offset of [
        { x: 3, y: 6 },
        { x: 10, y: 6 },
      ]) {
        const target = { x: floor.x + offset.x, y: floor.y + offset.y },
          moved = applyTowerCommand(prepared, { kind: 'move', id: stair.id, target });
        expect(moved, 'The outline is inside the visible circular wall').toMatchObject({
          ok: true,
        });
        if (!moved.ok) throw Error(moved.error);
        expect(parseTowerEdits(base, moved.document.objectEdits)).toEqual(moved.document);
      }
      for (const offset of [
        { x: 1, y: 6 },
        { x: 12, y: 6 },
        { x: 7, y: 0 },
        { x: 7, y: 11 },
      ]) {
        const rejected = applyTowerCommand(prepared, {
          kind: 'move',
          id: stair.id,
          target: { x: floor.x + offset.x, y: floor.y + offset.y },
        });
        expect(rejected).toMatchObject({
          ok: false,
          error: expect.stringContaining('circular walls'),
        });
      }
    }
  },
);

test.each(['spiral', 'separate'] as const)(
  '%s stairs can move over ground moss in either editing order without relaxing physical collisions',
  (stairStyle) => {
    const base = towerEditorFixture({
        stairStyle,
        portalFloor: null,
        laboratoryFloor: undefined,
        observatoryFloor: undefined,
      }),
      cleared = clearTower(base),
      stair = editableTowerStairs(cleared).find((s) => s.floor === 1);
    if (!stair) throw Error('Missing first-floor staircase');
    const prepared = acceptTower(cleared, { kind: 'move', id: stair.id, target: { x: 8, y: 10 } }),
      target = { x: 8, y: 7 },
      move = { kind: 'move' as const, id: stair.id, target };
    // Reproduce the screenshot: moss clips the top-left of the proposed outline,
    // while the previous landing and every piece of furniture are clear.
    for (const ground of [{ x: 7, y: 6 }, target, { x: 8, y: 8 }]) {
      const add = { kind: 'add' as const, propKind: 'moss' as const, target: ground },
        mossFirst = acceptTower(prepared, add),
        result = applyTowerCommand(mossFirst, move);
      expect(result, 'Ground moss must not make an empty stair destination invalid').toMatchObject({
        ok: true,
      });
      if (!result.ok) throw Error(result.error);
      expect(acceptTower(acceptTower(prepared, move), add)).toEqual(result.document);
      expect(parseTowerEdits(base, result.document.objectEdits)).toEqual(result.document);
      expect(towerBase(result.document)).toEqual(base);
    }
    for (const propKind of ['crate', 'barrel', 'bedroll'] as const) {
      const occupied = acceptTower(prepared, { kind: 'add', propKind, target });
      expect(applyTowerCommand(occupied, move)).toMatchObject({
        ok: false,
        error: expect.stringContaining(
          `${propKind === 'bedroll' ? 'Bedroll' : propKind === 'crate' ? 'Crate' : 'Barrel'} on floor 1 at column 9, row 8`,
        ),
      });
    }
  },
);

test('a crate beside the spiral body does not collide with the wider caption on a different row', () => {
  const base = towerEditorFixture({
      portalFloor: null,
      laboratoryFloor: undefined,
      observatoryFloor: undefined,
    }),
    cleared = clearTower(base),
    stair = editableTowerStairs(cleared).find((s) => s.floor === 1);
  if (!stair) throw Error('Missing stairs');
  const prepared = acceptTower(cleared, { kind: 'move', id: stair.id, target: { x: 8, y: 7 } }),
    withCrate = acceptTower(prepared, { kind: 'add', propKind: 'crate', target: { x: 12, y: 9 } }),
    move = { kind: 'move' as const, id: stair.id, target: { x: 10, y: 9 } },
    result = applyTowerCommand(withCrate, move);
  expect(
    result,
    'The caption width must not reserve empty space beside the stair body',
  ).toMatchObject({ ok: true });
  if (!result.ok) throw Error(result.error);
  expect(parseTowerEdits(base, result.document.objectEdits)).toEqual(result.document);
  expect(
    acceptTower(acceptTower(prepared, move), {
      kind: 'add',
      propKind: 'crate',
      target: { x: 12, y: 9 },
    }),
  ).toEqual(result.document);
  expect(
    applyTowerCommand(result.document, { kind: 'move', id: 'added-1', target: { x: 12, y: 10 } }),
  ).toMatchObject({ ok: false });
});

test.each(['spiral', 'separate'] as const)(
  '%s stair body and caption have separate picking, wall and collision footprints',
  (stairStyle) => {
    const base = towerEditorFixture({
        stairStyle,
        portalFloor: null,
        laboratoryFloor: undefined,
        observatoryFloor: undefined,
      }),
      cleared = clearTower(base),
      stair = editableTowerStairs(cleared).find((s) => s.floor === 1);
    if (!stair) throw Error('Missing stairs');
    const target = { x: 8, y: 9 },
      moved = acceptTower(cleared, { kind: 'move', id: stair.id, target }),
      selection = towerSelections(moved).find((s) => s.id === stair.id);
    if (!selection?.footprint) throw Error('Missing stair footprint');
    const contains = (x: number, y: number) =>
      selection.footprint?.some((shape) => shapeContains(shape, { x, y }));
    expect(contains(8.5, 9.5)).toBe(true);
    expect(contains(8.5, 11)).toBe(true);
    expect(contains(7.3, 9.5)).toBe(false);
    expect(contains(8.5, 10.5)).toBe(stairStyle === 'separate');
    expect(selection.footprint).toEqual(towerStairFootprint({ ...stair, ...target }, stairStyle));
    // Both sides are available above the caption; the same columns remain
    // protected on the caption row. Furniture-first and stairs-first agree.
    const free = [6, 10];
    for (const x of free) {
      expect(
        applyTowerCommand(moved, { kind: 'add', propKind: 'crate', target: { x, y: 9 } }).ok,
      ).toBe(true);
      const blockedX = stairStyle === 'spiral' ? x : x === 6 ? 7 : 9;
      expect(
        applyTowerCommand(moved, { kind: 'add', propKind: 'crate', target: { x: blockedX, y: 10 } })
          .ok,
      ).toBe(false);
    }
    // A real circle and its caption can fit even when a corner of their combined
    // bounding box would cross the curved wall.
    const besideWall = applyTowerCommand(cleared, {
      kind: 'move',
      id: stair.id,
      target: { x: 4, y: 8 },
    });
    expect(besideWall.ok).toBe(true);
    if (!besideWall.ok) throw Error(besideWall.error);
    expect(parseTowerEdits(base, besideWall.document.objectEdits)).toEqual(besideWall.document);
  },
);
