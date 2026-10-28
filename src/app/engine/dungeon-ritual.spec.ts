import { expect, test } from 'vitest';
import { generateDungeon } from './generate';
import { changeDungeonAppearance, shuffleDetails } from './decoration';
import { ALL_PRESETS, ALL_DENSITIES, DENSITY_BUDGETS, contains, indexOf } from './model';
import type { Dungeon, DungeonSettings } from './model';
import { ritualCenter } from './dungeon-ritual';
import { validateDungeon, reservedTiles } from './validation';
import { distances, createLayout } from './topology';
import { propCells } from './prop-footprint';
import { studyReservations } from './dungeon-study';
import { statueArea } from './dungeon-landmark';
import { furnitureArea } from './dungeon-furniture';
import { areaAround, areasOverlap } from './feature-reservation';

function generated(settings: DungeonSettings): Dungeon {
  const result = generateDungeon(settings);
  if (!result.ok) throw new Error(`${settings.seed}: ${result.error}`);
  return result.map;
}

function check(map: Dungeon) {
  expect(validateDungeon(map)).toBeUndefined();
  const objects = map.decoration.props.filter((p) => p.kind.startsWith('ritual_'));
  expect(objects.filter((p) => p.kind === 'ritual_altar')).toHaveLength(1);
  expect(objects.filter((p) => p.kind === 'ritual_candles')).toHaveLength(2);
  expect(objects.filter((p) => p.kind === 'ritual_offering')).toHaveLength(2);
  expect(objects.filter((p) => p.blocking)).toHaveLength(1);
  const altar = objects.find((p) => p.kind === 'ritual_altar');
  if (!altar) throw new Error('Missing altar');
  const center = ritualCenter(altar),
    area = areaAround(center, 2, 2);
  const room = map.layout.rooms.find((room) => contains(room, center));
  if (!room) throw new Error('Missing room');
  expect([map.layout.entrance.roomId, map.layout.objective.roomId]).not.toContain(room.id);
  expect(center.x - 2).toBeGreaterThanOrEqual(room.x);
  expect(center.x + 2).toBeLessThan(room.x + room.width);
  expect(center.y - 2).toBeGreaterThanOrEqual(room.y);
  expect(center.y + 2).toBeLessThan(room.y + room.height);
  for (const prop of objects)
    expect(reservedTiles(map.layout).has(indexOf(prop.x, prop.y))).toBe(false);
  const blocked = new Set(
    map.decoration.props
      .filter((p) => p.blocking)
      .flatMap(propCells)
      .map((p) => indexOf(p.x, p.y)),
  );
  expect(distances(map.layout.tiles, map.layout.entrance, blocked).size).toBe(
    map.layout.tiles.filter(Boolean).length - blocked.size,
  );
  for (const room of map.layout.rooms) {
    expect(
      map.decoration.props.filter((p) => p.blocking && contains(room, p)).flatMap(propCells).length,
    ).toBeLessThanOrEqual(
      Math.floor(room.width * room.height * DENSITY_BUDGETS[map.decoration.density]),
    );
    let clearSquare = false;
    for (let y = room.y; y < room.y + room.height - 1; y++)
      for (let x = room.x; x < room.x + room.width - 1; x++) {
        if (
          [
            [x, y],
            [x + 1, y],
            [x, y + 1],
            [x + 1, y + 1],
          ].every(
            ([px, py]) => px !== undefined && py !== undefined && !blocked.has(indexOf(px, py)),
          )
        )
          clearSquare = true;
      }
    expect(clearSquare).toBe(true);
  }
  for (const reservation of studyReservations(map.layout, map.decoration.props))
    expect(areasOverlap(area, reservation.area)).toBe(false);
  for (const prop of map.decoration.props) {
    if (prop.kind === 'weathered_statue') expect(areasOverlap(area, statueArea(prop))).toBe(false);
    if (prop.kind === 'dining_table') expect(areasOverlap(area, furnitureArea(prop))).toBe(false);
  }
}

test.each(ALL_PRESETS)(
  '%s ritual sites are deterministic, coherent, clear and within budgets',
  (preset) => {
    const turns = new Set<number>();
    for (const density of ALL_DENSITIES)
      for (const roomCount of [4, 6, 8])
        for (let seed = 0; seed < 2; seed++) {
          const settings: DungeonSettings = {
            seed: `ritual-${seed}`,
            roomCount,
            density,
            preset,
            ritual: true,
          };
          const map = generated(settings),
            snapshot = structuredClone(map);
          expect(generated(settings)).toEqual(map);
          check(map);
          const shuffled = shuffleDetails(map);
          check(shuffled);
          expect(shuffled.layout).toBe(map.layout);
          expect(shuffled.surfaceSeed).toBe(map.surfaceSeed);
          expect(shuffled.decoration.revision).toBe(1);
          const altar = map.decoration.props.find((p) => p.kind === 'ritual_altar');
          if (altar) turns.add(Math.floor(altar.variation * 4));
          expect(map).toEqual(snapshot);
        }
    expect([...turns].sort()).toEqual([0, 1, 2, 3]);
  },
);

test('ritual appearance applies and removes exactly without changing layout, revision, or caller inputs', () => {
  const map = generated({
    seed: 'mosslit-sanctum',
    roomCount: 6,
    density: 'Balanced',
    preset: 'Mosslit',
  });
  const snapshot = structuredClone(map);
  const ritual = changeDungeonAppearance(map, { ...map.decoration, ritual: true });
  expect(ritual.decoration.ritual).toBe(true);
  expect(ritual.layout).toBe(map.layout);
  expect(ritual.surfaceSeed).toBe(map.surfaceSeed);
  expect(ritual.decoration.revision).toBe(0);
  expect(changeDungeonAppearance(ritual, { ...ritual.decoration, ritual: false })).toEqual(map);
  expect(map).toEqual(snapshot);
  expect(generated({ seed: map.seed, roomCount: 6, ...map.decoration, ritual: false })).toEqual(
    map,
  );
});

test('ritual sites compose with each existing addition and all together without displacing protected features', () => {
  for (const additions of [
    { scene: 'Forgotten study' as const },
    { landmark: 'weathered-statue' as const },
    { furniture: 'dining-table' as const },
    {
      scene: 'Forgotten study' as const,
      landmark: 'weathered-statue' as const,
      furniture: 'dining-table' as const,
    },
  ]) {
    const map = generated({
      seed: 'mosslit-sanctum',
      roomCount: 8,
      density: 'Balanced',
      preset: 'Mosslit',
      ...additions,
      ritual: true,
    });
    check(map);
    expect(map.decoration).toMatchObject(additions);
    const base = changeDungeonAppearance(map, { ...map.decoration, ritual: false });
    const restored = changeDungeonAppearance(base, { ...base.decoration, ritual: true });
    expect(restored).toEqual(map);
    const protectedKinds = ['desk', 'bookshelf', 'scroll_case', 'weathered_statue', 'dining_table'];
    expect(restored.decoration.props.filter((p) => protectedKinds.includes(p.kind))).toEqual(
      base.decoration.props.filter((p) => protectedKinds.includes(p.kind)),
    );
    check(shuffleDetails(map));
  }
});

test('an addition that cannot fit preserves the original map, props and inputs', () => {
  const map = generated({
    seed: 'tiny-ritual',
    roomCount: 4,
    density: 'Sparse',
    preset: 'Mosslit',
  });
  const rooms = [
    { x: 4, y: 4 },
    { x: 20, y: 4 },
    { x: 20, y: 18 },
    { x: 4, y: 18 },
  ].map((point, id) => ({ ...point, id, width: 5, height: 4 }));
  const tiny: Dungeon = {
    ...map,
    layout: createLayout(rooms, [
      { from: 0, to: 1, bend: 'horizontal' },
      { from: 1, to: 2, bend: 'vertical' },
      { from: 2, to: 3, bend: 'horizontal' },
    ]),
    decoration: { ...map.decoration, props: [] },
  };
  const before = structuredClone(tiny);
  expect(changeDungeonAppearance(tiny, { ...tiny.decoration, ritual: true })).toBe(tiny);
  expect(tiny).toEqual(before);
});
