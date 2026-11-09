import { expect, test } from 'vitest';
import {
  courtyardEditorFixture,
  clearCourtyard,
  acceptCourtyard as accept,
  validCourtyardCommand,
  courtyardGroupFixture,
} from '../../../../scripts/courtyard-editor-test-support';
import { applyCourtyardCommand } from './courtyard-commands';
import {
  courtyardInstances,
  courtyardBase,
  currentCourtyardGroups,
  resolveCourtyard,
} from './courtyard-document';
import {
  courtyardObjectsCollide,
  courtyardPlacementError,
  courtyardSelections,
} from './courtyard-rules';
import { COURTYARD_PALETTE, courtyardCapability } from './courtyard-catalog';
import { courtyardProtectedCells } from '../courtyard-validation';
import { propCells } from '../prop-footprint';
import { indexOf } from '../model';
import { editorOrderedObjects, editorOverlaps } from './editor-view';
import { QUARTER_TURNS } from '../prop-footprint';
import { parseCourtyardEdits } from './parse-courtyard-edits';

test.each(['Sparse', 'Balanced', 'Cluttered'] as const)(
  '%s canonical courtyards retain a valid unedited arrangement and immutable base',
  (density) => {
    const base = courtyardEditorFixture(density),
      before = structuredClone(base);
    expect(courtyardPlacementError(base)).toBeUndefined();
    expect(courtyardBase(base)).toBe(base);
    expect(resolveCourtyard(base)).toBe(base);
    expect(applyCourtyardCommand(base, { kind: 'reset' })).toEqual({ ok: true, document: base });
    for (const item of COURTYARD_PALETTE) {
      const prepared = clearCourtyard(base),
        command = validCourtyardCommand(prepared, (target) => ({
          kind: 'add',
          propKind: item.kind,
          target,
        }));
      const edited = accept(prepared, command);
      expect(parseCourtyardEdits(base, edited.objectEdits)).toEqual(edited);
      expect(accept(edited, { kind: 'reset' })).toEqual(base);
    }
    expect(base).toEqual(before);
  },
);

test('independent movement reaches grass outside the ruin, keeps stable artwork, and rejects real obstacles', () => {
  const base = courtyardEditorFixture(),
    item = courtyardInstances(base).find((item) => item.prop.kind === 'broken_column');
  if (!item) throw Error('Missing column');
  const changed = accept(base, { kind: 'move', id: item.id, target: { x: 1, y: 1 } });
  expect(courtyardInstances(changed).find((p) => p.id === item.id)?.prop).toEqual({
    ...item.prop,
    x: 1,
    y: 1,
  });
  const wall = base.layout.tiles.findIndex((tile) => !tile);
  expect(
    applyCourtyardCommand(changed, {
      kind: 'move',
      id: item.id,
      target: { x: wall % 40, y: Math.floor(wall / 40) },
    }).ok,
  ).toBe(false);
  const unchanged = applyCourtyardCommand(changed, {
    kind: 'move',
    id: item.id,
    target: { x: 1, y: 1 },
  });
  expect(unchanged.ok && unchanged.document).toBe(changed);
  const recovered = accept(changed, { kind: 'move', id: item.id, target: item.prop });
  expect(recovered).toEqual(base);
});

test.each(['fountain', 'wagon'] as const)(
  '%s moves as a complete group without reserving empty space around its objects',
  (id) => {
    const { base, prepared, group, target } = courtyardGroupFixture(id);
    const changed = accept(prepared, { kind: 'move-group', id, target, rotation: 0 });
    const dx = target.x - group.area.x,
      dy = target.y - group.area.y;
    for (const original of courtyardInstances(prepared).filter((item) =>
      group.members.includes(item.id),
    ))
      expect(courtyardInstances(changed).find((item) => item.id === original.id)?.prop).toEqual({
        ...original.prop,
        x: original.prop.x + dx,
        y: original.prop.y + dy,
      });
    const body = courtyardInstances(changed).find(
      (item) =>
        group.members.includes(item.id) &&
        (item.prop.kind === 'dry_fountain' || item.prop.kind === 'collapsed_wagon'),
    );
    if (!body) throw Error('Missing body');
    const ring = { x: body.prop.x - 1, y: body.prop.y };
    const beside = accept(changed, { kind: 'add', propKind: 'broken_column', target: ring });
    expect(parseCourtyardEdits(base, beside.objectEdits)).toEqual(beside);
    expect(
      applyCourtyardCommand(changed, {
        kind: 'add',
        propKind: 'broken_column',
        target: body.prop,
      }).ok,
    ).toBe(false);
    const decorated = accept(changed, { kind: 'add', propKind: 'moss', target: ring });
    expect(courtyardInstances(decorated).find((item) => item.id === 'added-1')?.prop.kind).toBe(
      'moss',
    );
    const reset = accept(decorated, { kind: 'move-group', id, target: group.area, rotation: 0 });
    expect(courtyardInstances(reset).find((item) => item.id === 'added-1')?.prop).toEqual(
      courtyardInstances(decorated).find((item) => item.id === 'added-1')?.prop,
    );
    expect(courtyardBase(reset)).toEqual(base);
    expect(parseCourtyardEdits(base, decorated.objectEdits)).toEqual(decorated);
  },
);

test.each(['fountain', 'wagon'] as const)(
  '%s can move into the generator gathering space and saved edits reopen unchanged',
  (id) => {
    const base = courtyardEditorFixture(),
      prepared = clearCourtyard(base);
    const encounter = base.layout.encounter;
    const target =
      id === 'fountain'
        ? { x: encounter.x - 1, y: encounter.y - 1 }
        : { x: encounter.x, y: encounter.y };
    const before = structuredClone(prepared);
    const moved = accept(prepared, { kind: 'move-group', id, target, rotation: 0 });
    expect(currentCourtyardGroups(moved).find((group) => group.id === id)?.area).toMatchObject(
      target,
    );
    expect(parseCourtyardEdits(base, moved.objectEdits)).toEqual(moved);
    expect(prepared).toEqual(before);
  },
);

test('independent objects can be added to approach lanes and moved into gathering space', () => {
  const base = courtyardEditorFixture(),
    prepared = clearCourtyard(base);
  const encounterTiles = new Set(
    Array.from({ length: 36 }, (_, i) =>
      indexOf(base.layout.encounter.x + (i % 6), base.layout.encounter.y + Math.floor(i / 6)),
    ),
  );
  const approach = [...courtyardProtectedCells(base.layout)].find(
    (tile) => !encounterTiles.has(tile),
  );
  if (approach === undefined) throw Error('Missing approach');
  const target = { x: approach % 40, y: Math.floor(approach / 40) };
  const edited = accept(prepared, { kind: 'add', propKind: 'broken_column', target });
  expect(parseCourtyardEdits(base, edited.objectEdits)).toEqual(edited);
  const moved = accept(edited, { kind: 'move', id: 'added-1', target: base.layout.encounter });
  expect(courtyardInstances(moved).find((item) => item.id === 'added-1')?.prop).toMatchObject({
    x: base.layout.encounter.x,
    y: base.layout.encounter.y,
  });
  expect(parseCourtyardEdits(base, moved.objectEdits)).toEqual(moved);
});

test('an empty fountain margin may overlap standing masonry when its actual body fits on grass', () => {
  const base = courtyardEditorFixture(),
    prepared = clearCourtyard(base);
  const target = { x: base.layout.bounds.x - 4, y: base.layout.bounds.y };
  const moved = accept(prepared, { kind: 'move-group', id: 'fountain', target, rotation: 0 });
  expect(parseCourtyardEdits(base, moved.objectEdits)).toEqual(moved);
});

test('the stone well moves as one complete addition and rejects editorial rotation', () => {
  const { base, prepared, target } = courtyardGroupFixture('well');
  expect(base.decoration.well).toBe(true);
  const moved = accept(prepared, { kind: 'move-group', id: 'well', target, rotation: 0 });
  expect(currentCourtyardGroups(moved).find((group) => group.id === 'well')?.area).toMatchObject(
    target,
  );
  expect(parseCourtyardEdits(base, moved.objectEdits)).toEqual(moved);
  const rotated = applyCourtyardCommand(moved, {
    kind: 'move-group',
    id: 'well',
    target,
    rotation: 1,
  });
  expect(rotated.ok).toBe(false);
  if (!rotated.ok)
    expect(rotated.error).toBe('Only the complete wagon supports quarter-turn rotation.');
  expect(courtyardCapability('stone_well')?.editable).toBe(false);
});

test('all wagon turns rotate every occupied square as one arrangement without changing artwork choices', () => {
  const { base, prepared, group, target } = courtyardGroupFixture('wagon');
  const original = courtyardInstances(prepared).filter((item) => group.members.includes(item.id));
  for (const rotation of QUARTER_TURNS) {
    const changed = accept(prepared, { kind: 'move-group', id: 'wagon', target, rotation });
    for (const item of original) {
      const moved = courtyardInstances(changed).find((other) => other.id === item.id);
      if (!moved) throw Error('Missing group member');
      const cells = propCells(item.prop)
        .map((cell) => {
          const x = cell.x - group.area.x,
            y = cell.y - group.area.y;
          const q =
            rotation === 0
              ? { x, y }
              : rotation === 1
                ? { x: group.area.height - 1 - y, y: x }
                : rotation === 2
                  ? { x: group.area.width - 1 - x, y: group.area.height - 1 - y }
                  : { x: y, y: group.area.width - 1 - x };
          return indexOf(target.x + q.x, target.y + q.y);
        })
        .sort((a, b) => a - b);
      expect(
        propCells(moved.prop)
          .map((p) => indexOf(p.x, p.y))
          .sort((a, b) => a - b),
      ).toEqual(cells);
      expect(moved.prop.variation).toBe(item.prop.variation);
    }
    expect(parseCourtyardEdits(base, changed.objectEdits)).toEqual(changed);
    expect(
      accept(changed, { kind: 'move-group', id: 'wagon', target: group.area, rotation: 0 }),
    ).toEqual(prepared);
    expect(currentCourtyardGroups(changed).find((g) => g.id === 'wagon')?.area.width).toBe(
      rotation % 2 ? group.area.height : group.area.width,
    );
  }
});

test('surface stacking, topmost order, deletion and insertion retain exact objects and blocking', () => {
  const prepared = clearCourtyard(courtyardEditorFixture());
  const withMoss = accept(prepared, { kind: 'add', propKind: 'moss', target: { x: 1, y: 1 } });
  const withColumn = accept(withMoss, {
    kind: 'add',
    propKind: 'broken_column',
    target: { x: 1, y: 1 },
  });
  const covered = accept(withColumn, { kind: 'order', id: 'added-1', direction: 'forward' });
  expect(courtyardInstances(covered)).toEqual(courtyardInstances(withColumn));
  expect(editorOrderedObjects(covered).at(-1)?.id).toBe('added-1');
  expect(editorOverlaps(covered).find((i) => i.id === 'added-1')?.underneath).toEqual(['added-2']);
  expect(
    applyCourtyardCommand(covered, {
      kind: 'add',
      propKind: 'broken_column',
      target: { x: 1, y: 1 },
    }).ok,
  ).toBe(false);
  expect(
    applyCourtyardCommand(covered, { kind: 'add', propKind: 'moss', target: { x: 1, y: 1 } }).ok,
  ).toBe(false);
  const rubble = accept(covered, { kind: 'add', propKind: 'low_rubble', target: { x: 1, y: 1 } });
  expect(editorOrderedObjects(rubble)[0]?.id).toBe('added-3');
  const removed = accept(rubble, { kind: 'remove', id: 'added-2' });
  expect(removed.objectEdits?.order).not.toContain('added-2');
  expect(parseCourtyardEdits(courtyardBase(removed), removed.objectEdits)).toEqual(removed);
});

test('protected attachments and individual group members cannot move, disappear, rotate or enter the palette', () => {
  const base = courtyardEditorFixture(),
    fountain = courtyardInstances(base).find((i) => i.prop.kind === 'dry_fountain'),
    vine = courtyardInstances(base).find((i) => i.prop.kind === 'vine');
  if (!fountain || !vine) throw Error('Missing protected objects');
  for (const id of [fountain.id, vine.id, 'unknown']) {
    expect(applyCourtyardCommand(base, { kind: 'move', id, target: { x: 1, y: 1 } }).ok).toBe(
      false,
    );
    expect(applyCourtyardCommand(base, { kind: 'remove', id }).ok).toBe(false);
    expect(applyCourtyardCommand(base, { kind: 'order', id, direction: 'forward' }).ok).toBe(false);
  }
  for (const propKind of [
    'crate',
    'dry_fountain',
    'collapsed_wagon',
    'spilled_crate',
    'vine',
  ] as const)
    expect(applyCourtyardCommand(base, { kind: 'add', propKind, target: { x: 1, y: 1 } }).ok).toBe(
      false,
    );
  expect(
    applyCourtyardCommand(base, {
      kind: 'move-group',
      id: 'fountain',
      target: { x: 1, y: 1 },
      rotation: 1,
    }).ok,
  ).toBe(false);
  expect(
    courtyardSelections(base)
      .filter((item) => item.groupId)
      .map((item) => item.id),
  ).toEqual(['group-fountain', 'group-wagon']);
});

test('all free ground must stay reachable; removing a blocker allows correction', () => {
  const prepared = clearCourtyard(courtyardEditorFixture());
  const corner = accept(prepared, {
    kind: 'add',
    propKind: 'broken_column',
    target: { x: 1, y: 0 },
  });
  const before = structuredClone(corner),
    command = { kind: 'add', propKind: 'broken_column', target: { x: 0, y: 1 } } as const;
  expect(applyCourtyardCommand(corner, command)).toMatchObject({
    ok: false,
    error: 'Keep every open part of the courtyard reachable.',
  });
  expect(corner).toEqual(before);
  const corrected = accept(corner, { kind: 'remove', id: 'added-1' });
  expect(accept(corrected, command).objectEdits?.added).toHaveLength(1);
});

test('the top-left grass tile can hold an object without acting as an artificial entrance', () => {
  const prepared = clearCourtyard(courtyardEditorFixture());
  const result = applyCourtyardCommand(prepared, {
    kind: 'add',
    propKind: 'broken_column',
    target: { x: 0, y: 0 },
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw Error(result.error);
  expect(parseCourtyardEdits(courtyardBase(prepared), result.document.objectEdits)).toEqual(
    result.document,
  );
});

test('blocking budgets reject excess columns and removal permits a safe retry', () => {
  let map = clearCourtyard(courtyardEditorFixture('Sparse'));
  let rejected: { x: number; y: number } | undefined;
  outer: for (let y = 0; y < 30; y++)
    for (let x = 0; x < 40; x++) {
      const result = applyCourtyardCommand(map, {
        kind: 'add',
        propKind: 'broken_column',
        target: { x, y },
      });
      if (result.ok) map = result.document;
      else if (result.error.includes('blocking limit')) {
        rejected = { x, y };
        break outer;
      }
    }
  if (!rejected) throw Error('Did not exercise the blocking budget');
  const added = map.objectEdits?.added.filter((item) => item.prop.kind === 'broken_column').at(-1);
  if (!added) throw Error('Missing removable blocker');
  map = accept(map, { kind: 'remove', id: added.id });
  expect(
    applyCourtyardCommand(map, { kind: 'add', propKind: 'broken_column', target: rejected }).ok,
  ).toBe(true);
});

test('new surfaces start beneath nonblocking plants without changing generated drawing priorities', () => {
  const prepared = clearCourtyard(courtyardEditorFixture());
  const plant = accept(prepared, { kind: 'add', propKind: 'fern', target: { x: 1, y: 1 } });
  const moss = accept(plant, { kind: 'add', propKind: 'moss', target: { x: 1, y: 1 } });
  expect(editorOverlaps(moss).find((item) => item.id === 'added-1')?.underneath).toEqual([
    'added-2',
  ]);
  expect(resolveCourtyard(moss)).toMatchObject({
    order: editorOrderedObjects(moss).map((item) => item.id),
  });
});

test('fountain placement over any part of a fern preserves it as named ground cover in either insertion order', () => {
  const base = courtyardEditorFixture(),
    prepared = clearCourtyard(base);
  for (let y = 1; y <= 3; y++)
    for (let x = 1; x <= 3; x++) {
      const planted = accept(prepared, { kind: 'add', propKind: 'fern', target: { x, y } });
      const moved = accept(planted, { kind: 'move-group', id: 'fountain', target: { x: 0, y: 0 } });
      const fern = courtyardInstances(planted).find((item) => item.id === 'added-1');
      expect(courtyardInstances(moved).find((item) => item.id === 'added-1')).toEqual(fern);
      const fountain = courtyardInstances(moved).find((item) => item.prop.kind === 'dry_fountain');
      if (!fountain) throw Error('Missing fountain');
      expect(editorOverlaps(moved).find((item) => item.id === fountain.id)?.underneath).toContain(
        'added-1',
      );
      expect(parseCourtyardEdits(base, moved.objectEdits)).toEqual(moved);
    }
  const movedFirst = accept(prepared, {
    kind: 'move-group',
    id: 'fountain',
    target: { x: 0, y: 0 },
  });
  const plantedAfter = accept(movedFirst, {
    kind: 'add',
    propKind: 'fern',
    target: { x: 2, y: 2 },
  });
  expect(parseCourtyardEdits(base, plantedAfter.objectEdits)).toEqual(plantedAfter);
});

test('moving the fountain over a fixed vine keeps its position, identity and saved artwork data', () => {
  const base = courtyardEditorFixture(),
    prepared = clearCourtyard(base);
  const vine = courtyardInstances(prepared).find(
    (item) => item.prop.kind === 'vine' && item.prop.x === 13 && item.prop.y === 9,
  );
  if (!vine) throw Error('Missing vine fixture');
  const moved = accept(prepared, { kind: 'move-group', id: 'fountain', target: { x: 12, y: 8 } });
  expect(courtyardInstances(moved).find((item) => item.id === vine.id)).toEqual(vine);
  expect(parseCourtyardEdits(base, moved.objectEdits)).toEqual(moved);
});

test('nonblocking wagon pieces remain physical obstacles rather than being mistaken for ground cover', () => {
  const fountain = courtyardEditorFixture().decoration.props.find(
    (prop) => prop.kind === 'dry_fountain',
  );
  if (!fountain) throw Error('Missing fountain');
  for (const kind of ['wagon_wheel', 'spilled_goods', 'spilled_crate', 'broken_column'] as const) {
    const prop = {
      kind,
      x: fountain.x,
      y: fountain.y,
      blocking: kind === 'spilled_crate' || kind === 'broken_column',
      variation: 0.5,
    };
    expect(courtyardObjectsCollide(fountain, prop)).toBe(true);
    expect(courtyardObjectsCollide(prop, fountain)).toBe(true);
  }
});

test('a refused fountain move identifies the physical obstruction and its occupied tile, then allows correction', () => {
  const base = courtyardEditorFixture(),
    prepared = clearCourtyard(base);
  const withColumn = accept(prepared, {
    kind: 'add',
    propKind: 'broken_column',
    target: { x: 1, y: 1 },
  });
  const command = { kind: 'move-group', id: 'fountain', target: { x: 0, y: 0 } } as const;
  const before = structuredClone(withColumn);
  expect(applyCourtyardCommand(withColumn, command)).toEqual({
    ok: false,
    error: 'Dry fountain overlaps Broken column at column 2, row 2. Move one of the objects.',
  });
  expect(withColumn).toEqual(before);
  const corrected = accept(withColumn, { kind: 'remove', id: 'added-1' });
  expect(applyCourtyardCommand(corrected, command).ok).toBe(true);
});
