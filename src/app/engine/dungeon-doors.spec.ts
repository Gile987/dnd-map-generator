import { expect, test } from 'vitest';
import { editorFixture, rotationFixture, validCommand } from '../../../scripts/editor-test-support';
import oldEdits from '../save/fixtures/dungeon-editor-v1.json';
import {
  dungeonDoorAt,
  dungeonDoorId,
  dungeonDoors,
  doorIsOpen,
  parseDoorStates,
  toggleDungeonDoor,
} from './dungeon-doors';
import { dungeonBase } from './object-editor/document';
import { applyObjectCommand } from './object-editor/commands';
import {
  makeSavedMap,
  parseSavedMap,
  parseBundle,
  serializeBundle,
  SAVE_FORMAT_VERSION,
} from '../save/save-format';
import { isUsableMap } from '../save/map-schema';

test('door identity follows geometry, coalesces duplicate thresholds and hit tests both axes', () => {
  const base = editorFixture(),
    doors = dungeonDoors(base.layout);
  expect(doors.length).toBeGreaterThan(0);
  expect(new Set(doors.map((d) => d.id)).size).toBe(doors.length);
  const first = doors[0];
  if (!first) throw Error('Missing door');
  expect(
    dungeonDoors({ ...base.layout, thresholds: [...base.layout.thresholds, first.threshold] }),
  ).toEqual(doors);
  expect(
    dungeonDoors({ ...base.layout, thresholds: [...base.layout.thresholds].reverse() })
      .map((d) => d.id)
      .sort(),
  ).toEqual(doors.map((d) => d.id).sort());
  for (const { id, threshold: d } of doors) {
    const point = d.axis === 'horizontal' ? { x: d.x + 1, y: d.y } : { x: d.x, y: d.y + 1 };
    expect(dungeonDoorAt(base.layout, point)).toBe(id);
    expect(dungeonDoorId(d)).toBe(id);
  }
  expect(dungeonDoorAt(base.layout, { x: NaN, y: 0 })).toBeUndefined();
  expect(dungeonDoorAt(base.layout, { x: -10, y: -10 })).toBeUndefined();
});

test('opening and closing is immutable, independent of topology and object edits, and restores absent metadata exactly', () => {
  const base = editorFixture(),
    before = JSON.stringify(base),
    door = dungeonDoors(base.layout)[0];
  if (!door) throw Error('Missing door');
  const open = toggleDungeonDoor(base, door.id);
  if (!open.ok) throw Error(open.error);
  expect(doorIsOpen(open.document, door.id)).toBe(true);
  expect(open.document.layout).toBe(base.layout);
  expect(open.document.decoration).toBe(base.decoration);
  expect(open.document.objectEdits).toBeUndefined();
  const noop = applyObjectCommand(open.document, { kind: 'reset' });
  expect(noop.ok && noop.document).toBe(open.document);
  expect(isUsableMap(open.document)).toBe(false);
  expect(dungeonBase(open.document)).toEqual(base);
  const edited = applyObjectCommand(
    open.document,
    validCommand(open.document, (target) => ({ kind: 'add', propKind: 'moss', target })),
  );
  if (!edited.ok) throw Error(edited.error);
  expect(edited.document.doorStates).toBe(open.document.doorStates);
  const reset = applyObjectCommand(edited.document, { kind: 'reset' });
  expect(reset.ok && reset.document).toEqual(open.document);
  const closed = toggleDungeonDoor(edited.document, door.id);
  if (!closed.ok) throw Error(closed.error);
  expect(closed.document.objectEdits).toBe(edited.document.objectEdits);
  const restored = toggleDungeonDoor(open.document, door.id);
  expect(restored.ok && restored.document).toEqual(base);
  expect(JSON.stringify(base)).toBe(before);
  expect(toggleDungeonDoor(base, 'unknown')).toMatchObject({ ok: false });
});

test('bounded door state rejects malformed, unknown, duplicate and future data; current saves roundtrip with old records protected', () => {
  const base = editorFixture(),
    first = dungeonDoors(base.layout)[0];
  if (!first) throw Error('Missing door');
  const state = { version: 1, open: [first.id] };
  for (const bad of [
    null,
    {},
    undefined,
    { ...state, version: 2 },
    { ...state, open: [] },
    { ...state, open: [first.id, first.id] },
    { ...state, open: ['unknown'] },
    { ...state, open: [1] },
    { ...state, extra: true },
    { ...state, open: Array(2401).fill(first.id) },
  ])
    expect(parseDoorStates(base.layout, bad)).toBeUndefined();
  const result = toggleDungeonDoor(base, first.id);
  if (!result.ok) throw Error(result.error);
  const saved = makeSavedMap(
    result.document,
    'Open door',
    'data:image/png;base64,AAAA',
    'open-door',
    '2026-11-03T12:00:00Z',
  );
  expect(saved.saveFormatVersion).toBe(SAVE_FORMAT_VERSION);
  expect(parseSavedMap(saved)).toEqual(saved);
  expect(parseBundle(serializeBundle([saved]))).toEqual({ ok: true, maps: [saved], skipped: 0 });
  expect(parseSavedMap({ ...saved, saveFormatVersion: '22.0.0' })).toBeUndefined();
  expect(
    parseSavedMap({
      ...saved,
      map: { ...saved.map, doorStates: { version: 2, open: [first.id] } },
    }),
  ).toBeUndefined();
  const old = {
    ...makeSavedMap(base, 'Old', 'data:image/png;base64,AAAA', 'old', '2026-11-03T12:00:00Z'),
    saveFormatVersion: '22.0.0',
  };
  expect(parseSavedMap(old)?.map).toEqual(base);
  expect(parseSavedMap(old)?.map).not.toHaveProperty('doorStates');
});

test('door states coexist with frozen v1 object edits and rotated additions without upgrading or losing either sidecar', () => {
  const legacy = parseBundle(JSON.stringify(oldEdits));
  if (!legacy.ok) throw Error(legacy.error);
  const { prepared, target } = rotationFixture('ritual');
  const rotated = applyObjectCommand(prepared, {
    kind: 'move-group',
    id: 'ritual',
    target,
    rotation: 1,
  });
  if (!rotated.ok) throw Error(rotated.error);
  for (const map of [...legacy.maps.map((saved) => saved.map), rotated.document]) {
    if (map.type !== 'dungeon') throw Error('Missing dungeon');
    const door = dungeonDoors(map.layout)[0];
    if (!door) throw Error('Missing door');
    const opened = toggleDungeonDoor(map, door.id);
    if (!opened.ok) throw Error(opened.error);
    expect(opened.document.objectEdits).toBe(map.objectEdits);
    const saved = makeSavedMap(
      opened.document,
      'Both edits',
      'data:image/png;base64,AAAA',
      'both',
      '2026-11-03T12:00:00Z',
    );
    expect(parseSavedMap(saved)?.map).toEqual(opened.document);
    const closed = toggleDungeonDoor(opened.document, door.id);
    expect(closed.ok && closed.document).toEqual(map);
  }
});
