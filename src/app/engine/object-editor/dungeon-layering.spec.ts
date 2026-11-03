import { expect, test } from 'vitest';
import { editorFixture, validCommand } from '../../../../scripts/editor-test-support';
import { generateDungeon } from '../generate';
import type { Dungeon, DungeonDocument, Point } from '../model';
import { applyObjectCommand } from './commands';
import type { ObjectCommand } from './commands';
import { dungeonBase, dungeonInstances } from './document';
import { dungeonGroups } from './dungeon-groups';
import { individualObjectLock } from './dungeon-authoring-rules';
import { parseDungeonEdits } from './parse-edits';
import { makeSavedMap, parseSavedMap } from '../../save/save-format';

function accept(document: DungeonDocument, command: ObjectCommand): DungeonDocument {
  const result = applyObjectCommand(document, command);
  if (!result.ok) throw Error(result.error);
  return result.document;
}
function clear(base: Dungeon, keep?: string): DungeonDocument {
  let doc: DungeonDocument = base;
  for (const item of dungeonInstances(base))
    if (item.id !== keep && !individualObjectLock(base, item.id, item.prop))
      doc = accept(doc, { kind: 'remove', id: item.id });
  return doc;
}

test('a barrel can cover a rug, and moving the rug away never carries the barrel', () => {
  const base = editorFixture(),
    rug = dungeonInstances(base).find((i) => i.prop.kind === 'rug');
  if (!rug) throw Error('Missing rug');
  const prepared = clear(base, rug.id),
    before = structuredClone(base);
  const layered = accept(prepared, { kind: 'add', propKind: 'barrel', target: rug.prop });
  const barrel = dungeonInstances(layered).find((i) => i.id.startsWith('added-'));
  if (!barrel) throw Error('Missing barrel');
  expect(parseDungeonEdits(base, layered.objectEdits)).toEqual(layered);
  expect(parseDungeonEdits(base, { ...layered.objectEdits, version: 2 })).toBeUndefined();
  const move = validCommand(layered, (target) => ({ kind: 'move', id: rug.id, target }), rug.prop);
  const moved = accept(layered, move);
  expect(dungeonInstances(moved).find((i) => i.id === barrel.id)?.prop).toEqual(barrel.prop);
  expect(base).toEqual(before);
  expect(dungeonBase(moved)).toEqual(base);
});

test('old v2 documents retain their frozen rules and only adopt layering after a real change', () => {
  const base = editorFixture(),
    rug = dungeonInstances(base).find((i) => i.prop.kind === 'rug');
  if (!rug) throw Error('Missing rug');
  const prepared = clear(base, rug.id);
  const old = parseDungeonEdits(base, { ...prepared.objectEdits, version: 2 });
  if (!old) throw Error('Missing v2 document');
  const saved = makeSavedMap(
    old,
    'Old edits',
    'data:image/png;base64,AAAA',
    'old-edits',
    '2026-11-02T12:00:00Z',
  );
  expect(parseSavedMap({ ...saved, saveFormatVersion: '20.0.0' })?.map).toEqual(old);
  const noop = applyObjectCommand(old, { kind: 'move', id: rug.id, target: rug.prop });
  expect(noop.ok && noop.document).toBe(old);
  const edited = accept(old, { kind: 'add', propKind: 'barrel', target: rug.prop });
  expect(edited.objectEdits?.version).toBe(4);
  expect(parseDungeonEdits(base, { ...edited.objectEdits, version: 2 })).toBeUndefined();
});

test('addition access cannot be closed by surrounding its solid object, and removal permits recovery', () => {
  const generated = generateDungeon({
    seed: 'mosslit-sanctum',
    roomCount: 6,
    density: 'Balanced',
    preset: 'Mosslit',
    landmark: 'weathered-statue',
  });
  if (!generated.ok) throw Error(generated.error);
  const statue = dungeonInstances(generated.map).find((i) => i.prop.kind === 'weathered_statue');
  if (!statue) throw Error('Missing statue');
  let doc = clear(generated.map);
  const points = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const;
  for (const [dx, dy] of points.slice(0, 3))
    doc = accept(doc, {
      kind: 'add',
      propKind: 'barrel',
      target: { x: statue.prop.x + dx, y: statue.prop.y + dy },
    });
  const before = structuredClone(doc),
    final = { x: statue.prop.x, y: statue.prop.y + 1 };
  expect(applyObjectCommand(doc, { kind: 'add', propKind: 'barrel', target: final })).toMatchObject(
    { ok: false, error: 'Keep a usable approach to each addition’s solid objects.' },
  );
  expect(doc).toEqual(before);
  doc = accept(doc, { kind: 'remove', id: 'added-1' });
  expect(accept(doc, { kind: 'add', propKind: 'barrel', target: final }).objectEdits).toBeTruthy();
});

test('a whole ritual can move around an independent barrel on its markings without taking ownership', () => {
  const generated = generateDungeon({
    seed: 'mosslit-sanctum',
    roomCount: 6,
    density: 'Balanced',
    preset: 'Mosslit',
    ritual: true,
  });
  if (!generated.ok) throw Error(generated.error);
  const base = generated.map,
    group = dungeonGroups(base).find((g) => g.id === 'ritual');
  if (!group) throw Error('Missing ritual');
  const point = { x: group.area.x + 2, y: group.area.y + 2 };
  const document = accept(clear(base), { kind: 'add', propKind: 'barrel', target: point });
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const result = applyObjectCommand(document, {
        kind: 'move-group',
        id: 'ritual',
        target: { x: group.area.x + dx, y: group.area.y + dy },
      });
      if (!result.ok) continue;
      expect(dungeonInstances(result.document).find((i) => i.id === 'added-1')?.prop).toMatchObject(
        point,
      );
      expect(parseDungeonEdits(base, result.document.objectEdits)).toEqual(result.document);
      return;
    }
  throw Error('Empty ritual floor should be able to slide beneath the barrel');
});

test('a rug can be placed underneath a barrel, but two physical objects or two rugs cannot occupy the same area', () => {
  const base = editorFixture(),
    prepared = clear(base),
    target = { x: 18, y: 25 };
  const barrel = accept(prepared, { kind: 'add', propKind: 'barrel', target });
  const rug = accept(barrel, { kind: 'add', propKind: 'rug', target });
  expect(applyObjectCommand(rug, { kind: 'add', propKind: 'crate', target }).ok).toBe(false);
  expect(applyObjectCommand(rug, { kind: 'add', propKind: 'rug', target }).ok).toBe(false);
  expect(accept(rug, { kind: 'add', propKind: 'moss', target }).objectEdits).toBeTruthy();
  expect(parseDungeonEdits(base, rug.objectEdits)).toEqual(rug);
});

test('a barrel can enter empty ritual floor but cannot cover the altar, candles or offerings; moving the site leaves it behind', () => {
  const generated = generateDungeon({
    seed: 'mosslit-sanctum',
    roomCount: 6,
    density: 'Balanced',
    preset: 'Mosslit',
    ritual: true,
  });
  if (!generated.ok) throw Error(generated.error);
  const base = generated.map,
    prepared = clear(base),
    group = dungeonGroups(base).find((g) => g.id === 'ritual');
  if (!group) throw Error('Missing ritual');
  let layered: DungeonDocument | undefined, point: Point | undefined;
  for (let y = group.area.y; y < group.area.y + group.area.height && !layered; y++)
    for (let x = group.area.x; x < group.area.x + group.area.width && !layered; x++) {
      const result = applyObjectCommand(prepared, {
        kind: 'add',
        propKind: 'barrel',
        target: { x, y },
      });
      if (result.ok) {
        layered = result.document;
        point = { x, y };
      }
    }
  if (!layered || !point) throw Error('An empty ritual tile should accept a barrel');
  for (const item of dungeonInstances(prepared).filter((i) => group.members.includes(i.id)))
    expect(
      applyObjectCommand(prepared, { kind: 'add', propKind: 'barrel', target: item.prop }).ok,
    ).toBe(false);
  const command = validCommand(
    layered,
    (target) => ({ kind: 'move-group', id: 'ritual', target }),
    group.area,
  );
  const moved = accept(layered, command);
  expect(dungeonInstances(moved).find((i) => i.id.startsWith('added-'))?.prop).toMatchObject(point);
  expect(parseDungeonEdits(base, moved.objectEdits)).toEqual(moved);
});
