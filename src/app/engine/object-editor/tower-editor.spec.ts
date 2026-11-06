import { expect, expectTypeOf, test } from 'vitest';
import {
  towerEditorFixture,
  clearTower,
  acceptTower as accept,
  validTowerCommand,
  towerGroupFixture,
} from '../../../../scripts/tower-editor-test-support';
import { TOWER_PALETTE } from './tower-catalog';
import {
  towerInstances,
  towerBase,
  towerGroups,
  resolveTower,
  currentTowerGroups,
} from './tower-document';
import type { AuthoredTower, ResolvedTower } from './tower-document';
import { towerPlacementError } from './tower-rules';
import { applyTowerCommand } from './tower-commands';
import { parseTowerEdits } from './parse-tower-edits';
import { editorVisibleObjects, editorVisibleSelections, editorOverlaps } from './editor-view';
import { propCells, QUARTER_TURNS } from '../prop-footprint';
import { towerFloorAt, isUsableTower } from '../tower';
import type { Tower } from '../tower';
import type { GeneratedMap } from '../model';

test.each(['separate', 'spiral'] as const)(
  '%s Tower canonical layouts remain valid, and every ordinary palette object can be placed and reopened on the last floor',
  (stairStyle) => {
    const base = towerEditorFixture({ stairStyle }),
      prepared = clearTower(base),
      before = structuredClone(base);
    expect(towerPlacementError(base)).toBeUndefined();
    expect(towerBase(base)).toBe(base);
    expect(resolveTower(base)).toBe(base);
    expect(TOWER_PALETTE).toHaveLength(10);
    for (const item of TOWER_PALETTE) {
      const edited = accept(
        prepared,
        validTowerCommand(prepared, 8, (target) => ({
          kind: 'add',
          propKind: item.kind,
          target,
          floor: 8,
        })),
      );
      expect(edited.objectEdits?.added[0]?.prop.y).toBeGreaterThan(30);
      expect(parseTowerEdits(base, edited.objectEdits)).toEqual(edited);
      expect(accept(edited, { kind: 'reset' })).toEqual(base);
    }
    expect(base).toEqual(before);
    expectTypeOf<AuthoredTower>().not.toExtend<Tower>();
    expectTypeOf<ResolvedTower>().not.toExtend<GeneratedMap>();
  },
);

test('base objects and new objects stay on their own floor; third-column coordinates and explicit insertion floors are validated', () => {
  const base = towerEditorFixture(),
    prepared = clearTower(base),
    added = accept(
      prepared,
      validTowerCommand(prepared, 3, (target) => ({
        kind: 'add',
        propKind: 'crate',
        target,
        floor: 3,
      })),
    ),
    item = towerInstances(added).find((i) => i.id === 'added-1');
  if (!item) throw Error('Missing crate');
  const other = validTowerCommand(prepared, 8, (target) => ({
    kind: 'add',
    propKind: 'crate',
    target,
  }));
  if (other.kind !== 'add') throw Error('Missing target');
  expect(
    applyTowerCommand(added, { kind: 'move', id: item.id, target: other.target }),
  ).toMatchObject({
    ok: false,
    error: 'Keep this object on floor 3. Cross-floor moves are not available.',
  });
  expect(applyTowerCommand(prepared, { ...other, floor: 3 }).ok).toBe(false);
  const moved = accept(
    added,
    validTowerCommand(added, 3, (target) => ({ kind: 'move', id: item.id, target }), item.prop),
  );
  expect(parseTowerEdits(base, moved.objectEdits)).toEqual(moved);
  const original = towerInstances(base).find((i) => towerFloorAt(base, i.prop)?.number === 8);
  if (!original) throw Error('Missing base object');
  const third = validTowerCommand(prepared, 3, (target) => ({
    kind: 'add',
    propKind: 'crate',
    target,
  }));
  if (third.kind !== 'add') throw Error('Missing target');
  expect(applyTowerCommand(base, { kind: 'move', id: original.id, target: third.target }).ok).toBe(
    false,
  );
  expect(isUsableTower(moved)).toBe(false);
});

test.each(['laboratory', 'observatory'] as const)(
  '%s keeps every component, floor ownership, occupied cells and variations through four turns',
  (id) => {
    const { base, prepared, group, floor, target } = towerGroupFixture(id),
      original = towerInstances(prepared).filter((i) => group.members.includes(i.id));
    for (const rotation of QUARTER_TURNS) {
      const moved = accept(prepared, { kind: 'move-group', id, target, rotation });
      for (const item of original) {
        const prop = towerInstances(moved).find((i) => i.id === item.id)?.prop;
        if (!prop) throw Error('Missing member');
        const expected = propCells(item.prop).map((p) => {
          const x = p.x - group.area.x,
            y = p.y - group.area.y;
          const q =
            rotation === 0
              ? { x, y }
              : rotation === 1
                ? { x: group.area.height - 1 - y, y: x }
                : rotation === 2
                  ? { x: group.area.width - 1 - x, y: group.area.height - 1 - y }
                  : { x: y, y: group.area.width - 1 - x };
          return { x: target.x + q.x, y: target.y + q.y };
        });
        expect(propCells(prop)).toEqual(expected);
        expect(prop.variation).toBe(item.prop.variation);
        expect(towerFloorAt(moved, prop)?.number).toBe(floor.number);
      }
      expect(parseTowerEdits(base, moved.objectEdits)).toEqual(moved);
      expect(accept(moved, { kind: 'move-group', id, target: group.area, rotation: 0 })).toEqual(
        prepared,
      );
      expect(currentTowerGroups(moved).find((g) => g.id === id)?.area.width).toBe(
        rotation % 2 ? group.area.height : group.area.width,
      );
    }
    const other = base.layout.floors.find((f) => f.number !== floor.number);
    if (!other) throw Error('Missing other floor');
    expect(
      applyTowerCommand(prepared, {
        kind: 'move-group',
        id,
        target: { x: other.x + 5, y: other.y + 5 },
      }).ok,
    ).toBe(false);
    for (const member of group.members) {
      expect(applyTowerCommand(base, { kind: 'remove', id: member }).ok).toBe(false);
      expect(applyTowerCommand(base, { kind: 'move', id: member, target }).ok).toBe(false);
    }
    const independent = towerInstances(base).find(
      (i) =>
        ['desk', 'bookshelf'].includes(i.prop.kind) &&
        !towerGroups(base).some((g) => g.members.includes(i.id)),
    );
    if (!independent) throw Error('Missing independent desk/shelf');
    expect(applyTowerCommand(base, { kind: 'remove', id: independent.id }).ok).toBe(true);
  },
);

test('actual connections stay clear, central encounter art remains usable, and surfaces overlap symmetrically', () => {
  const base = towerEditorFixture(),
    prepared = clearTower(base),
    link = base.layout.connections[0];
  if (!link) throw Error('Missing connection');
  const mossOnConnection = accept(prepared, {
    kind: 'add',
    propKind: 'moss',
    target: link.departure,
  });
  expect(parseTowerEdits(base, mossOnConnection.objectEdits)).toEqual(mossOnConnection);
  for (const propKind of ['bedroll', 'crate'] as const)
    expect(applyTowerCommand(prepared, { kind: 'add', propKind, target: link.departure }).ok).toBe(
      false,
    );
  const command = validTowerCommand(prepared, 1, (target) => ({
    kind: 'add',
    propKind: 'crate',
    target,
  }));
  if (command.kind !== 'add') throw Error('Missing add');
  const box = accept(prepared, command),
    covered = accept(box, { kind: 'add', propKind: 'bedroll', target: command.target });
  expect(parseTowerEdits(base, covered.objectEdits)).toEqual(covered);
  expect(
    applyTowerCommand(covered, { kind: 'add', propKind: 'barrel', target: command.target }).ok,
  ).toBe(false);
  expect(
    applyTowerCommand(covered, { kind: 'add', propKind: 'bedroll', target: command.target }).ok,
  ).toBe(false);
  const floor = base.layout.floors[0];
  if (!floor) throw Error('Missing floor');
  const center = { x: floor.x + 6, y: floor.y + 6 };
  expect(applyTowerCommand(prepared, { kind: 'add', propKind: 'moss', target: center }).ok).toBe(
    true,
  );
});

test('hidden-floor objects, groups and overlaps are excluded from every player-view discovery list', () => {
  const base = towerEditorFixture(),
    secret = base.layout.floors.find((f) => f.secret);
  if (!secret) throw Error('Missing secret floor');
  const prepared = clearTower(base),
    command = validTowerCommand(prepared, secret.number, (target) => ({
      kind: 'add',
      propKind: 'crate',
      target,
    }));
  if (command.kind !== 'add') throw Error('Missing add');
  const box = accept(prepared, command),
    cover = accept(box, { kind: 'add', propKind: 'moss', target: command.target }),
    edited = accept(cover, { kind: 'order', id: 'added-2', direction: 'forward' });
  expect(editorVisibleObjects(edited).some((i) => i.id.startsWith('added-'))).toBe(false);
  expect(
    editorVisibleSelections(edited).some((i) => towerFloorAt(edited, i.position)?.secret),
  ).toBe(false);
  expect(editorOverlaps(edited)).toEqual([]);
  expect(editorOverlaps(edited, true).some((o) => o.id === 'added-2')).toBe(true);
  expect(editorVisibleObjects(edited, true)).toHaveLength(towerInstances(edited).length);
  expect(parseTowerEdits(base, edited.objectEdits)).toEqual(edited);
});

test('per-floor placement checks accept the original generator arrangements across counts, styles and densities', () => {
  for (const floorCount of [3, 8])
    for (const stairStyle of ['separate', 'spiral'] as const)
      for (const density of ['Sparse', 'Balanced', 'Cluttered'] as const) {
        const base = towerEditorFixture({ floorCount, stairStyle, density });
        expect(towerPlacementError(base), `${floorCount}/${stairStyle}/${density}`).toBeUndefined();
      }
});

test('blocking limits are per floor, preserve accepted objects on rejection, and allow removal and retry', () => {
  const base = towerEditorFixture({ density: 'Sparse' });
  let map = clearTower(base);
  const floor = base.layout.floors.find((f) => f.number === 8);
  if (!floor) throw Error('Missing floor');
  let refused: { x: number; y: number } | undefined;
  outer: for (let y = floor.y; y < floor.y + floor.height; y++)
    for (let x = floor.x; x < floor.x + floor.width; x++) {
      const before = structuredClone(map),
        r = applyTowerCommand(map, { kind: 'add', propKind: 'crate', target: { x, y } });
      if (r.ok) map = r.document;
      else if (r.error.includes('blocking limit')) {
        refused = { x, y };
        expect(map).toEqual(before);
        break outer;
      }
    }
  if (!refused) throw Error('Did not reach per-floor budget');
  const last = map.objectEdits?.added.at(-1);
  if (!last) throw Error('Missing blocker');
  const recovered = accept(map, { kind: 'remove', id: last.id });
  expect(applyTowerCommand(recovered, { kind: 'add', propKind: 'crate', target: refused }).ok).toBe(
    true,
  );
  const elsewhere = validTowerCommand(map, 1, (target) => ({
    kind: 'add',
    propKind: 'crate',
    target,
  }));
  expect(applyTowerCommand(map, elsewhere).ok).toBe(true);
});

// Historical snapshots carry no editing metadata and keep their positions until
// an explicit command adopts the new contract.

test('a real same-floor barrier is refused and removing a blocker permits correction', () => {
  const base = towerEditorFixture({
      portalFloor: null,
      laboratoryFloor: null,
      observatoryFloor: null,
      density: 'Cluttered',
    }),
    prepared = clearTower(base),
    floor = base.layout.floors[0];
  if (!floor) throw Error('Missing floor');
  let exercised = false;
  for (let y = floor.y; y < floor.y + floor.height && !exercised; y++) {
    let map = prepared;
    for (let x = floor.x; x < floor.x + floor.width; x++) {
      const before = structuredClone(map),
        target = { x, y },
        result = applyTowerCommand(map, { kind: 'add', propKind: 'crate', target });
      if (result.ok) map = result.document;
      else if (result.error.includes('reachable')) {
        expect(map).toEqual(before);
        const last = map.objectEdits?.added.at(-1);
        if (!last) throw Error('Missing barrier');
        const recovered = accept(map, { kind: 'remove', id: last.id });
        expect(applyTowerCommand(recovered, { kind: 'add', propKind: 'crate', target }).ok).toBe(
          true,
        );
        exercised = true;
        break;
      }
    }
  }
  expect(exercised).toBe(true);
});
