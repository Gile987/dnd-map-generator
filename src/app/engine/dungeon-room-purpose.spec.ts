import { dungeonObjectsCollide } from './object-editor/dungeon-occupancy';
import { expect, test } from 'vitest';
import { generateDungeon } from './generate';
import { changeDungeonAppearance, shuffleDetails } from './decoration';
import { contains, indexOf, ALL_DENSITIES } from './model';
import type { Dungeon, DungeonSettings, Point } from './model';
import { propCells } from './prop-footprint';
import { validateDungeon, reservedTiles } from './validation';
import { makeSavedMap, parseSavedMap, serializeBundle, parseBundle } from '../save/save-format';
import { applyObjectCommand } from './object-editor/commands';
import { dungeonInstances } from './object-editor/document';
import { objectRotation } from './object-editor/object-rotation';

function generate(settings: Partial<DungeonSettings> = {}): Dungeon {
  const result = generateDungeon({
    seed: 'watch-house',
    roomCount: 8,
    density: 'Balanced',
    preset: 'Mosslit',
    ...settings,
  });
  if (!result.ok) throw Error(result.error);
  return result.map;
}
for (const roomTheme of ['Mixed rooms', 'Barracks', 'Storerooms'] as const)
  for (const density of ALL_DENSITIES)
    test(`${roomTheme} at ${density}: deterministic, room-sized furnishing preserves routes and budgets`, () => {
      const map = generate({ roomTheme, density });
      expect(generate({ roomTheme, density })).toEqual(map);
      const general = generate({ density });
      expect(map.layout).toEqual(general.layout);
      expect(map.surfaceSeed).toBe(general.surfaceSeed);
      expect(validateDungeon(map)).toBeUndefined();
      for (const prop of map.decoration.props.filter((prop) =>
        ['wooden_bed', 'bedroll', 'weapon_rack', 'supply_sacks'].includes(prop.kind),
      ))
        expect(
          map.decoration.props.some(
            (other) => other !== prop && dungeonObjectsCollide(prop, other),
          ),
        ).toBe(false);
      const assignments = map.decoration.roomPurposes;
      expect(assignments?.length).toBeGreaterThan(0);
      if (roomTheme === 'Mixed rooms')
        expect(new Set(assignments?.map((entry) => entry.purpose))).toEqual(
          new Set(['Barracks', 'Storeroom']),
        );
      const reserved = reservedTiles(map.layout),
        blocked = new Set(
          map.decoration.props
            .filter((p) => p.blocking)
            .flatMap(propCells)
            .map((p) => indexOf(p.x, p.y)),
        );
      expect([...blocked].some((tile) => reserved.has(tile))).toBe(false);
      // Independent flood fill proves every remaining floor square is reachable.
      const queue: Point[] = [map.layout.entrance];
      const reached = new Set<number>();
      for (let i = 0; i < queue.length; i++) {
        const p = queue[i];
        if (!p || p.x < 0 || p.x >= 40 || p.y < 0 || p.y >= 30) continue;
        const tile = indexOf(p.x, p.y);
        if (reached.has(tile) || blocked.has(tile) || !map.layout.tiles[tile]) continue;
        reached.add(tile);
        queue.push(
          { x: p.x - 1, y: p.y },
          { x: p.x + 1, y: p.y },
          { x: p.x, y: p.y - 1 },
          { x: p.x, y: p.y + 1 },
        );
      }
      expect(reached.size).toBe(map.layout.tiles.filter(Boolean).length - blocked.size);
      for (const assignment of assignments ?? []) {
        const room = map.layout.rooms.find((r) => r.id === assignment.roomId);
        if (!room) throw Error('Missing room');
        expect(contains(room, map.layout.entrance) || contains(room, map.layout.objective)).toBe(
          false,
        );
        const props = map.decoration.props.filter((p) => contains(room, p));
        expect(
          props.some((p) =>
            assignment.purpose === 'Barracks'
              ? p.kind === 'wooden_bed' || p.kind === 'bedroll'
              : p.kind === 'crate',
          ),
        ).toBe(true);
      }
      const record = makeSavedMap(
        map,
        'Purpose',
        'data:image/png;base64,AAAA',
        'purpose',
        '2026-11-27T12:00:00Z',
      );
      expect(parseSavedMap(record)?.map).toEqual(map);
      expect(parseBundle(serializeBundle([record]))).toEqual({
        ok: true,
        maps: [record],
        skipped: 0,
      });
      expect(shuffleDetails(map).decoration.roomTheme).toBe(roomTheme);
    });

test('selected additions keep their room roles and changing purpose preserves the accepted map', () => {
  const general = generate({
    scene: 'Forgotten study',
    landmark: 'weathered-statue',
    furniture: 'dining-table',
    ritual: true,
    density: 'Cluttered',
  });
  const snapshot = structuredClone(general);
  const furnished = changeDungeonAppearance(general, {
    ...general.decoration,
    roomTheme: 'Mixed rooms',
  });
  expect(furnished.decoration.roomTheme).toBe('Mixed rooms');
  expect(validateDungeon(furnished)).toBeUndefined();
  for (const p of general.decoration.props.filter((p) =>
    [
      'desk',
      'bookshelf',
      'scroll_case',
      'weathered_statue',
      'dining_table',
      'ritual_altar',
      'ritual_candles',
      'ritual_offering',
    ].includes(p.kind),
  ))
    expect(furnished.decoration.props).toContainEqual(p);
  expect(general).toEqual(snapshot);
  expect(
    changeDungeonAppearance(furnished, { ...furnished.decoration, roomTheme: 'General rooms' }),
  ).toEqual(general);
});

test('generated bed footprint rotations survive movement, reset and save/reopen', () => {
  const base = generate({ roomTheme: 'Barracks', density: 'Cluttered' });
  const item = dungeonInstances(base).find((item) => item.prop.kind === 'wooden_bed');
  if (!item) throw Error('Missing generated bed');
  let edited;
  for (let y = 0; y < 30 && !edited; y++)
    for (let x = 0; x < 40; x++) {
      const result = applyObjectCommand(base, {
        kind: 'move',
        id: item.id,
        target: { x, y },
        rotation: ((objectRotation(item.prop) + 1) % 4) as 0 | 1 | 2 | 3,
      });
      if (result.ok && result.document !== base) {
        edited = result.document;
        break;
      }
    }
  if (!edited) throw Error('Missing bed destination');
  const moved = dungeonInstances(edited).find((other) => other.id === item.id)?.prop;
  expect(moved?.rotation).toBe((objectRotation(item.prop) + 1) % 4);
  expect(moved?.artRotation).toBeUndefined();
  const saved = makeSavedMap(
    edited,
    'Turned bed',
    'data:image/png;base64,AAAA',
    'bed',
    '2026-11-27T12:00:00Z',
  );
  expect(parseSavedMap(saved)?.map).toEqual(edited);
  expect(
    applyObjectCommand(edited, {
      kind: 'move',
      id: item.id,
      target: item.prop,
      rotation: item.prop.rotation,
    }),
  ).toEqual({ ok: true, document: base });
  for (const badRotation of [4, -1, null]) {
    const bad = structuredClone(saved),
      move = bad.map.objectEdits?.moves[0];
    if (!move) throw Error('Missing move');
    Object.assign(move, { rotation: badRotation });
    expect(parseSavedMap(bad)).toBeUndefined();
  }
});

test('malformed room themes and assignments are rejected at the save boundary', () => {
  const base = generate({ roomTheme: 'Mixed rooms' });
  const saved = makeSavedMap(
    base,
    'Rooms',
    'data:image/png;base64,AAAA',
    'rooms',
    '2026-11-27T12:00:00Z',
  );
  for (const fields of [
    { roomTheme: 'Banana' },
    { roomPurposes: null },
    { roomPurposes: [null] },
    { roomPurposes: [{ roomId: 99, purpose: 'Barracks' }] },
    { roomPurposes: [base.decoration.roomPurposes?.[0], base.decoration.roomPurposes?.[0]] },
    { roomTheme: 'General rooms' },
  ]) {
    const bad = structuredClone(saved);
    Object.assign(bad.map.decoration, fields);
    expect(parseSavedMap(bad)).toBeUndefined();
  }
  expect(
    generateDungeon({
      seed: 'x',
      roomCount: 6,
      density: 'Balanced',
      preset: 'Mosslit',
      roomTheme: 'bad' as 'Barracks',
    }).ok,
  ).toBe(false);
});

test('room purpose and furniture arrangement are independent of the visual character', () => {
  const moss = generate({ roomTheme: 'Mixed rooms' }),
    crypt = generate({ roomTheme: 'Mixed rooms', preset: 'Crypt' });
  expect(crypt.decoration.roomPurposes).toEqual(moss.decoration.roomPurposes);
  const furniture = (map: Dungeon) =>
    map.decoration.props.filter((prop) =>
      ['wooden_bed', 'bedroll', 'weapon_rack', 'supply_sacks'].includes(prop.kind),
    );
  expect(furniture(crypt)).toEqual(furniture(moss));
});
