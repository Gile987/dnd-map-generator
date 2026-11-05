import { expect, expectTypeOf, test } from 'vitest';
import {
  forestEditorFixture,
  clearForest,
  acceptForest as accept,
  validForestCommand,
  forestGroupFixture,
} from '../../../../scripts/forest-editor-test-support';
import { ALL_FOREST_CHARACTERS, indexOf, isBlockingProp } from '../model';
import type { ForestClearing, GeneratedMap } from '../model';
import { QUARTER_TURNS, propCells } from '../prop-footprint';
import { applyForestCommand, proposeForestCommand } from './forest-commands';
import {
  forestInstances,
  forestBase,
  forestGroups,
  currentForestGroups,
  resolveForest,
} from './forest-document';
import type { AuthoredForest, ResolvedForest } from './forest-document';
import { FOREST_PALETTE } from './forest-catalog';
import { forestPlacementError, forestObjectLock } from './forest-rules';
import { parseForestEdits } from './parse-forest-edits';
import { editorOverlaps, editorOrderedObjects } from './editor-view';

test.each(ALL_FOREST_CHARACTERS)(
  '%s canonical forests and all seven catalog kinds retain their frozen base and artwork',
  (character) => {
    const base = forestEditorFixture(character),
      before = structuredClone(base),
      prepared = clearForest(base);
    expect(forestPlacementError(base)).toBeUndefined();
    expect(FOREST_PALETTE.map((item) => item.kind)).toEqual([
      'boulder',
      'log',
      'stump',
      'bush',
      'fern',
      'mushroom',
      'flower',
    ]);
    expect(forestBase(base)).toBe(base);
    expect(resolveForest(base)).toBe(base);
    expect(applyForestCommand(base, { kind: 'reset' })).toEqual({ ok: true, document: base });
    for (const entry of FOREST_PALETTE) {
      const edited = accept(
        prepared,
        validForestCommand(prepared, (target) => ({ kind: 'add', propKind: entry.kind, target })),
      );
      expect(parseForestEdits(base, edited.objectEdits)).toEqual(edited);
      expect(edited.objectEdits?.added[0]?.prop).toMatchObject({
        kind: entry.kind,
        variation: 0.5,
        blocking: isBlockingProp(entry.kind),
      });
      expect(accept(edited, { kind: 'reset' })).toEqual(base);
    }
    expect(base).toEqual(before);
    expectTypeOf<AuthoredForest>().not.toExtend<ForestClearing>();
    expectTypeOf<ResolvedForest>().not.toExtend<GeneratedMap>();
  },
);

test('plants can grow beneath objects and outside the clearing, while solids respect real ground and entrances', () => {
  const base = forestEditorFixture(),
    prepared = clearForest(base),
    tree = forestInstances(base).find((item) => item.prop.kind === 'tree');
  if (!tree) throw Error('Missing tree');
  const planted = accept(prepared, { kind: 'add', propKind: 'fern', target: tree.prop });
  expect(parseForestEdits(base, planted.objectEdits)).toEqual(planted);
  expect(applyForestCommand(planted, { kind: 'add', propKind: 'fern', target: tree.prop }).ok).toBe(
    false,
  );
  expect(
    applyForestCommand(prepared, { kind: 'add', propKind: 'boulder', target: tree.prop }).ok,
  ).toBe(false);
  for (const target of [base.layout.pathStart, base.layout.pathEnd])
    expect(
      applyForestCommand(prepared, { kind: 'add', propKind: 'boulder', target }),
    ).toMatchObject({ ok: false, error: 'Keep both map-edge path entrances open.' });
  const boulder = accept(
    prepared,
    validForestCommand(prepared, (target) => ({ kind: 'add', propKind: 'boulder', target })),
  );
  const prop = forestInstances(boulder).find((item) => item.id === 'added-1')?.prop;
  if (!prop) throw Error('Missing boulder');
  const stacked = accept(boulder, { kind: 'add', propKind: 'bush', target: prop });
  const covered = accept(stacked, { kind: 'order', id: 'added-2', direction: 'forward' });
  expect(editorOrderedObjects(covered).at(-1)?.id).toBe('added-2');
  expect(editorOverlaps(covered).find((item) => item.id === 'added-2')?.underneath).toContain(
    'added-1',
  );
  expect(parseForestEdits(base, covered.objectEdits)).toEqual(covered);
  expect(applyForestCommand(covered, { kind: 'add', propKind: 'log', target: prop }).ok).toBe(
    false,
  );
});

test('manual path placement uses connected floor rather than the generator route reservation', () => {
  const base = forestEditorFixture(),
    prepared = clearForest(base);
  const target = base.layout.route
    .map((tile) => ({ x: tile % 40, y: Math.floor(tile / 40) }))
    .find(
      (target) => applyForestCommand(prepared, { kind: 'add', propKind: 'boulder', target }).ok,
    );
  if (!target) throw Error('No editable interior route tile');
  expect(target).not.toEqual(base.layout.pathStart);
  expect(target).not.toEqual(base.layout.pathEnd);
  const edited = accept(prepared, { kind: 'add', propKind: 'boulder', target });
  expect(parseForestEdits(base, edited.objectEdits)).toEqual(edited);
});

test.each(['camp', 'stone-circle', 'fallen-tree'] as const)(
  '%s transforms every occupied cell through all four turns without changing member artwork or owning empty ground',
  (id) => {
    const { base, prepared, group, target } = forestGroupFixture(id);
    const originals = forestInstances(prepared).filter((item) => group.members.includes(item.id));
    for (const rotation of QUARTER_TURNS) {
      const edited = accept(prepared, { kind: 'move-group', id, target, rotation });
      for (const item of originals) {
        const moved = forestInstances(edited).find((other) => other.id === item.id)?.prop;
        if (!moved) throw Error('Missing member');
        const expected = propCells(item.prop)
          .map((p) => {
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
            return indexOf(target.x + q.x, target.y + q.y);
          })
          .sort((a, b) => a - b);
        expect(
          propCells(moved)
            .map((p) => indexOf(p.x, p.y))
            .sort((a, b) => a - b),
        ).toEqual(expected);
        expect(moved.variation).toBe(item.prop.variation);
        expect(moved.kind).toBe(item.prop.kind);
      }
      expect(parseForestEdits(base, edited.objectEdits)).toEqual(edited);
      expect(accept(edited, { kind: 'move-group', id, target: group.area, rotation: 0 })).toEqual(
        prepared,
      );
      expect(currentForestGroups(edited).find((item) => item.id === id)?.area.width).toBe(
        rotation % 2 ? group.area.height : group.area.width,
      );
      const body = forestInstances(edited).find(
        (item) => group.members.includes(item.id) && item.prop.blocking,
      )?.prop;
      if (!body) throw Error('Missing group body');
      const covered = accept(edited, { kind: 'add', propKind: 'flower', target: body });
      expect(parseForestEdits(base, covered.objectEdits)).toEqual(covered);
    }
  },
);

test('tree and addition components reject individual edits; no-op and rejected commands retain the source', () => {
  const base = forestEditorFixture(),
    before = structuredClone(base),
    group = forestGroups(base)[0];
  const tree = forestInstances(base).find((item) => item.prop.kind === 'tree');
  if (!tree || !group) throw Error('Missing protected instances');
  for (const id of [tree.id, ...group.members]) {
    expect(applyForestCommand(base, { kind: 'move', id, target: { x: 1, y: 1 } }).ok).toBe(false);
    expect(applyForestCommand(base, { kind: 'remove', id }).ok).toBe(false);
    expect(applyForestCommand(base, { kind: 'order', id, direction: 'forward' }).ok).toBe(false);
  }
  for (const propKind of ['tree', 'tent', 'fallen_trunk', 'standing_stone', 'crate'] as const)
    expect(applyForestCommand(base, { kind: 'add', propKind, target: { x: 1, y: 1 } }).ok).toBe(
      false,
    );
  expect(
    applyForestCommand(base, { kind: 'move-group', id: group.id, target: group.area, rotation: 0 }),
  ).toEqual({ ok: true, document: base });
  expect(
    applyForestCommand(base, { kind: 'move-group', id: group.id, target: { x: 39, y: 29 } }).ok,
  ).toBe(false);
  expect(base).toEqual(before);
  const proposed = proposeForestCommand(base, {
    kind: 'move-group',
    id: group.id,
    target: { x: 39, y: 29 },
  });
  expect(proposed.ok).toBe(true);
  expect(forestObjectLock(base, tree.id, tree.prop)).toContain('fixed');
});

test('the stone circle center accepts loose objects and grouping never drags them along', () => {
  const { prepared, group, target } = forestGroupFixture('stone-circle'),
    center = { x: group.area.x + 2, y: group.area.y + 2 };
  const furnished = accept(prepared, { kind: 'add', propKind: 'stump', target: center });
  const moved = accept(furnished, { kind: 'move-group', id: 'stone-circle', target });
  expect(forestInstances(moved).find((item) => item.id === 'added-1')?.prop).toEqual(
    forestInstances(furnished).find((item) => item.id === 'added-1')?.prop,
  );
});

test('blocking budgets reject excess solids and permit removal followed by a safe retry', () => {
  let map = clearForest(
    forestEditorFixture('Verdant', {
      density: 'Sparse',
      scene: 'None',
      landmark: 'None',
      fallenTree: false,
    }),
  );
  let target: { x: number; y: number } | undefined;
  outer: for (let y = 0; y < 30; y++)
    for (let x = 0; x < 40; x++) {
      const result = applyForestCommand(map, { kind: 'add', propKind: 'stump', target: { x, y } });
      if (result.ok) map = result.document;
      else if (result.error.includes('blocking limit')) {
        target = { x, y };
        break outer;
      }
    }
  if (!target) throw Error('Did not reach blocking budget');
  const last = map.objectEdits?.added.at(-1);
  if (!last) throw Error('Missing last blocker');
  const recovered = accept(map, { kind: 'remove', id: last.id });
  expect(applyForestCommand(recovered, { kind: 'add', propKind: 'stump', target }).ok).toBe(true);
});

test('a real barrier is rejected without mutation and a gap permits correction', () => {
  const base = forestEditorFixture('Verdant', {
    density: 'Cluttered',
    scene: 'None',
    landmark: 'None',
    fallenTree: false,
  });
  let map = clearForest(base);
  const a = base.layout.pathStart,
    b = base.layout.pathEnd;
  const vertical = a.x !== b.x,
    line = Math.floor(vertical ? (a.x + b.x) / 2 : (a.y + b.y) / 2);
  let refused: { x: number; y: number } | undefined;
  for (let p = 0; p < (vertical ? 30 : 40); p++) {
    const target = vertical ? { x: line, y: p } : { x: p, y: line },
      before = structuredClone(map);
    const result = applyForestCommand(map, { kind: 'add', propKind: 'stump', target });
    if (result.ok) map = result.document;
    else if (result.error.includes('reachable')) {
      refused = target;
      expect(map).toEqual(before);
      break;
    }
  }
  if (!refused) throw Error('Did not exercise disconnected floor');
  const last = map.objectEdits?.added.at(-1);
  if (!last) throw Error('Missing barrier');
  const recovered = accept(map, { kind: 'remove', id: last.id });
  expect(
    applyForestCommand(recovered, { kind: 'add', propKind: 'stump', target: refused }).ok,
  ).toBe(true);
});
