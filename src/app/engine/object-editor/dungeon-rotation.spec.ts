import { rotationFixture, validCommand } from '../../../../scripts/editor-test-support';
import { expect, test } from 'vitest';
import type { DungeonDocument, QuarterTurn } from '../model';
import { propBounds, propCells, QUARTER_TURNS } from '../prop-footprint';
import { applyObjectCommand } from './commands';
import { dungeonBase, dungeonInstances, resolveDungeon } from './document';
import { dungeonSelections } from './dungeon-selection';
import { parseDungeonEdits } from './parse-edits';
import { makeSavedMap, parseSavedMap, parseBundle, serializeBundle } from '../../save/save-format';

test.each(['study', 'statue', 'table', 'ritual'] as const)(
  '%s rotates every occupied cell and preserves artwork choices, reset, serialization and four-turn identity',
  (id) => {
    const { base, prepared, group, target } = rotationFixture(id),
      before = JSON.stringify(base);
    const original = dungeonInstances(prepared).filter((i) => group.members.includes(i.id));
    let last: DungeonDocument = prepared;
    for (const rotation of QUARTER_TURNS) {
      const result = applyObjectCommand(prepared, { kind: 'move-group', id, target, rotation });
      if (!result.ok) throw Error(result.error);
      last = result.document;
      const selection = dungeonSelections(last).find((i) => i.groupId === id);
      expect(selection?.rotation).toBe(rotation);
      expect(selection?.area).toMatchObject({
        ...target,
        width: rotation % 2 ? group.area.height : group.area.width,
        height: rotation % 2 ? group.area.width : group.area.height,
      });
      for (const item of original) {
        const actual = dungeonInstances(last).find((i) => i.id === item.id)?.prop;
        if (!actual) throw Error('Missing member');
        expect(actual.variation).toBe(item.prop.variation);
        let cells = propCells(item.prop).map((p) => ({
          x: p.x - group.area.x,
          y: p.y - group.area.y,
        }));
        let width = group.area.width,
          height = group.area.height;
        for (let turn = 0; turn < rotation; turn++) {
          cells = cells.map((p) => ({ x: height - 1 - p.y, y: p.x }));
          [width, height] = [height, width];
        }
        expect(
          propCells(actual)
            .map((p) => `${p.x - target.x},${p.y - target.y}`)
            .sort(),
        ).toEqual(cells.map((p) => `${p.x},${p.y}`).sort());
        if (item.prop.footprint)
          expect(propBounds(actual).width * propBounds(actual).height).toBe(2);
      }
      expect(parseDungeonEdits(base, last.objectEdits)).toEqual(last);
      const saved = makeSavedMap(
        last,
        'Rotated',
        'data:image/png;base64,AAAA',
        'rotation',
        '2026-11-03T12:00:00Z',
      );
      expect(parseSavedMap(saved)?.map).toEqual(last);
      expect(parseBundle(serializeBundle([saved]))).toMatchObject({
        ok: true,
        maps: [saved],
        skipped: 0,
      });
      expect(parseSavedMap({ ...saved, saveFormatVersion: '21.0.0' })).toBeUndefined();
    }
    const restored = applyObjectCommand(last, {
      kind: 'move-group',
      id,
      target: group.area,
      rotation: 0,
    });
    expect(restored.ok && restored.document).toEqual(prepared);
    const reset = applyObjectCommand(last, { kind: 'reset' });
    expect(reset.ok && reset.document).toEqual(base);
    expect(dungeonBase(last)).toEqual(base);
    expect(JSON.stringify(base)).toBe(before);
  },
);

test('bad turns, collisions, stale group identities and boundary failures preserve the document and permit corrected placement', () => {
  const { base, prepared, target } = rotationFixture('table');
  const valid = applyObjectCommand(prepared, {
    kind: 'move-group',
    id: 'table',
    target,
    rotation: 1,
  });
  if (!valid.ok) throw Error(valid.error);
  const doc = valid.document,
    edits = doc.objectEdits;
  if (edits?.version !== 4) throw Error('Missing rotation');
  for (const rotation of [-1, 0.5, 4, NaN, Infinity]) {
    expect(
      applyObjectCommand(doc, {
        kind: 'move-group',
        id: 'table',
        target,
        rotation: rotation as QuarterTurn,
      }).ok,
    ).toBe(false);
    expect(
      parseDungeonEdits(base, { ...edits, groups: [{ id: 'table', ...target, rotation }] }),
    ).toBeUndefined();
  }
  expect(
    parseDungeonEdits(base, { ...edits, groups: [{ id: 'table', ...target }] }),
  ).toBeUndefined();
  expect(parseDungeonEdits(base, { ...edits, version: 3 })).toBeUndefined();
  expect(
    applyObjectCommand(doc, {
      kind: 'move-group',
      id: 'table',
      target: { x: 39, y: 29 },
      rotation: 2,
    }).ok,
  ).toBe(false);
  expect(
    applyObjectCommand(doc, { kind: 'move-group', id: 'unknown', target, rotation: 2 }).ok,
  ).toBe(false);
  const moved = applyObjectCommand(
    doc,
    validCommand(
      doc,
      (destination) => ({
        kind: 'move-group',
        id: 'table',
        target: destination,
      }),
      target,
    ),
  );
  if (!moved.ok) throw Error(moved.error);
  expect(dungeonSelections(moved.document).find((g) => g.groupId === 'table')?.rotation).toBe(1);
  expect(applyObjectCommand(doc, { kind: 'move-group', id: 'table', target, rotation: 2 }).ok).toBe(
    true,
  );
});

test('old v3 group transforms remain translation-only until a real new edit upgrades them', () => {
  const { base, prepared, target } = rotationFixture('ritual');
  const moved = applyObjectCommand(prepared, { kind: 'move-group', id: 'ritual', target });
  if (!moved.ok || !moved.document.objectEdits) throw Error('Missing move');
  const oldEdits = {
    ...moved.document.objectEdits,
    version: 3,
    groups: [{ id: 'ritual', ...target }],
  };
  const old = parseDungeonEdits(base, oldEdits);
  if (!old) throw Error('Missing v3 map');
  expect(resolveDungeon(old).decoration.props).toEqual(
    dungeonInstances(moved.document).map((i) => i.prop),
  );
  const noop = applyObjectCommand(old, { kind: 'move-group', id: 'ritual', target });
  expect(noop.ok && noop.document).toBe(old);
  const rotated = applyObjectCommand(old, {
    kind: 'move-group',
    id: 'ritual',
    target,
    rotation: 1,
  });
  expect(rotated.ok && rotated.document.objectEdits?.version).toBe(4);
});

test('table rotation refuses a newly occupied square and can turn the other way without moving loose objects', () => {
  const { prepared, target } = rotationFixture('table');
  const zero = applyObjectCommand(prepared, {
    kind: 'move-group',
    id: 'table',
    target,
    rotation: 0,
  });
  const one = applyObjectCommand(prepared, {
    kind: 'move-group',
    id: 'table',
    target,
    rotation: 1,
  });
  if (!zero.ok || !one.ok) throw Error('Missing table orientations');
  const before = dungeonInstances(zero.document).find((i) => i.prop.kind === 'dining_table');
  const after = dungeonInstances(one.document).find((i) => i.prop.kind === 'dining_table');
  if (!before || !after) throw Error('Missing table');
  const cells = propCells(before.prop);
  const point = propCells(after.prop).find((p) => !cells.some((c) => c.x === p.x && c.y === p.y));
  if (!point) throw Error('Turning the table should occupy a different square');
  const added = applyObjectCommand(zero.document, {
    kind: 'add',
    propKind: 'barrel',
    target: point,
  });
  if (!added.ok) throw Error(added.error);
  expect(
    applyObjectCommand(added.document, { kind: 'move-group', id: 'table', target, rotation: 1 }),
  ).toMatchObject({
    ok: false,
    error: 'Those objects cannot overlap. Rugs and moss can go beneath objects.',
  });
  const corrected = applyObjectCommand(added.document, {
    kind: 'move-group',
    id: 'table',
    target,
    rotation: 2,
  });
  if (!corrected.ok) throw Error(corrected.error);
  expect(dungeonInstances(corrected.document).find((i) => i.id === 'added-1')?.prop).toMatchObject(
    point,
  );
});

test('rotating a ritual site over an independent barrel on its markings retains surface layering and ownership', () => {
  const { prepared, target } = rotationFixture('ritual');
  const moved = applyObjectCommand(prepared, { kind: 'move-group', id: 'ritual', target });
  if (!moved.ok) throw Error(moved.error);
  const point = { x: target.x + 2, y: target.y + 2 };
  const added = applyObjectCommand(moved.document, {
    kind: 'add',
    propKind: 'barrel',
    target: point,
  });
  if (!added.ok) throw Error(added.error);
  for (const rotation of QUARTER_TURNS) {
    const result = applyObjectCommand(added.document, {
      kind: 'move-group',
      id: 'ritual',
      target,
      rotation,
    });
    if (!result.ok) throw Error(result.error);
    expect(dungeonInstances(result.document).find((i) => i.id === 'added-1')?.prop).toMatchObject(
      point,
    );
  }
});
