import { expect, test } from 'vitest';
import {
  ALL_DENSITIES,
  ALL_PRESETS,
  DENSITY_BUDGETS,
  contains,
  indexOf,
  WIDTH,
  HEIGHT,
} from './model';
import type { Dungeon, DungeonSettings } from './model';
import { generateDungeon } from './generate';
import { changeDungeonAppearance, changeDensity, changePreset, shuffleDetails } from './decoration';
import { validateDungeon, reservedTiles, validateSettings } from './validation';
import { propCells, propBounds } from './prop-footprint';
import { areasOverlap } from './feature-reservation';
import { furnitureArea } from './dungeon-furniture';
import { statueReservations } from './dungeon-landmark';
import { studyReservations } from './dungeon-study';
import { createLayout } from './topology';

function generated(settings: DungeonSettings): Dungeon {
  const result = generateDungeon(settings);
  if (!result.ok) throw new Error(`${JSON.stringify(settings)}: ${result.error}`);
  return result.map;
}

test('furniture adds and removes exactly, preserves accepted models, and follows appearance changes', () => {
  const settings: DungeonSettings = {
    seed: 'mosslit-sanctum',
    roomCount: 6,
    preset: 'Mosslit',
    density: 'Balanced',
  };
  const base = generated(settings),
    before = structuredClone(base);
  expect(generated({ ...settings, furniture: 'None' })).toEqual(base);
  const furnished = changeDungeonAppearance(base, { ...settings, furniture: 'dining-table' });
  expect(furnished.decoration.furniture).toBe('dining-table');
  expect(furnished.layout).toBe(base.layout);
  expect(furnished.surfaceSeed).toBe(base.surfaceSeed);
  expect(furnished.decoration.revision).toBe(0);
  expect(changeDungeonAppearance(furnished, { ...settings, furniture: 'None' })).toEqual(base);
  expect(base).toEqual(before);
  const shuffled = shuffleDetails(furnished);
  expect(shuffled.decoration).toMatchObject({ furniture: 'dining-table', revision: 1 });
  expect(shuffled.layout).toBe(base.layout);
  expect(changeDensity(furnished, 'Sparse').decoration).toMatchObject({
    furniture: 'dining-table',
    density: 'Sparse',
  });
  expect(changePreset(furnished, 'Crypt').decoration).toMatchObject({
    furniture: 'dining-table',
    preset: 'Crypt',
  });
});

test.each(ALL_PRESETS)(
  '%s furniture respects both occupied tiles and all feature reservations',
  (preset) => {
    const rotations = new Set<number>();
    for (const density of ALL_DENSITIES)
      for (const roomCount of [4, 6, 8])
        for (const scene of ['None', 'Forgotten study'] as const)
          for (const landmark of ['None', 'weathered-statue'] as const) {
            const settings: DungeonSettings = {
              seed: 'table-0',
              preset,
              density,
              roomCount,
              scene,
              landmark,
              furniture: 'dining-table',
            };
            const map = generated(settings);
            expect(generated(settings)).toEqual(map);
            const before = structuredClone(map);
            const shuffled = shuffleDetails(map);
            expect(map).toEqual(before);
            for (const current of [map, shuffled]) {
              expect(validateDungeon(current)).toBeUndefined();
              const tables = current.decoration.props.filter((p) => p.kind === 'dining_table');
              expect(tables).toHaveLength(1);
              const table = tables[0];
              if (!table) throw new Error('Missing table');
              expect(propCells(table)).toHaveLength(2);
              rotations.add(table.rotation ?? -1);
              const area = furnitureArea(table);
              for (const other of current.decoration.props)
                if (other !== table) expect(areasOverlap(area, propBounds(other))).toBe(false);
              for (const reservation of [
                ...studyReservations(current.layout, current.decoration.props),
                ...statueReservations(current.decoration.props),
              ])
                expect(areasOverlap(area, reservation.area)).toBe(false);
              for (const tile of propCells(table))
                expect(reservedTiles(current.layout).has(indexOf(tile.x, tile.y))).toBe(false);
              const blocked = new Set(
                current.decoration.props
                  .filter((p) => p.blocking)
                  .flatMap(propCells)
                  .map((p) => indexOf(p.x, p.y)),
              );
              const reached = new Set<number>();
              const queue = [indexOf(current.layout.entrance.x, current.layout.entrance.y)];
              for (let i = 0; i < queue.length; i++) {
                const tile = queue[i];
                if (
                  tile === undefined ||
                  reached.has(tile) ||
                  blocked.has(tile) ||
                  !current.layout.tiles[tile]
                )
                  continue;
                reached.add(tile);
                const x = tile % WIDTH,
                  y = Math.floor(tile / WIDTH);
                for (const [dx, dy] of [
                  [-1, 0],
                  [1, 0],
                  [0, -1],
                  [0, 1],
                ] as const)
                  if (x + dx >= 0 && x + dx < WIDTH && y + dy >= 0 && y + dy < HEIGHT)
                    queue.push(indexOf(x + dx, y + dy));
              }
              expect(reached.size).toBe(current.layout.tiles.filter(Boolean).length - blocked.size);
              for (const room of current.layout.rooms) {
                expect(
                  current.decoration.props
                    .filter((p) => p.blocking && contains(room, p))
                    .flatMap(propCells).length,
                ).toBeLessThanOrEqual(
                  Math.floor(room.width * room.height * DENSITY_BUDGETS[density]),
                );
                let clear = false;
                for (let y = room.y; y < room.y + room.height - 1; y++)
                  for (let x = room.x; x < room.x + room.width - 1; x++)
                    if (
                      [
                        indexOf(x, y),
                        indexOf(x + 1, y),
                        indexOf(x, y + 1),
                        indexOf(x + 1, y + 1),
                      ].every((tile) => !blocked.has(tile))
                    )
                      clear = true;
                expect(clear).toBe(true);
              }
            }
          }
    expect([...rotations].sort()).toEqual([0, 1, 2, 3]);
  },
);

test('a two-tile table cannot consume a one-tile budget and rejection is immutable', () => {
  const base = generated({
    seed: 'tiny-table',
    preset: 'Mosslit',
    density: 'Sparse',
    roomCount: 4,
  });
  const rooms = [
    { x: 4, y: 4 },
    { x: 20, y: 4 },
    { x: 20, y: 18 },
    { x: 4, y: 18 },
  ].map((point, id) => ({ ...point, id, width: 5, height: 4 }));
  const tiny: Dungeon = {
    ...base,
    layout: createLayout(rooms, [
      { from: 0, to: 1, bend: 'horizontal' },
      { from: 1, to: 2, bend: 'vertical' },
      { from: 2, to: 3, bend: 'horizontal' },
    ]),
    decoration: { ...base.decoration, props: [] },
  };
  expect(validateDungeon(tiny)).toBeUndefined();
  const before = structuredClone(tiny);
  expect(changeDungeonAppearance(tiny, { ...tiny.decoration, furniture: 'dining-table' })).toBe(
    tiny,
  );
  expect(tiny).toEqual(before);
  expect(
    validateSettings({
      seed: 'x',
      roomCount: 4,
      preset: 'Mosslit',
      density: 'Sparse',
      furniture: 'Unknown' as never,
    }),
  ).toContain('furniture');
});
