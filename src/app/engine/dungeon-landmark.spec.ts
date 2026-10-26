import { expect, test } from 'vitest';
import {
  ALL_DENSITIES,
  ALL_PRESETS,
  contains,
  DENSITY_BUDGETS,
  indexOf,
  WIDTH,
  HEIGHT,
} from './model';
import type { Dungeon, DungeonSettings } from './model';
import { generateDungeon } from './generate';
import { changeDungeonAppearance, changeDensity, changePreset, shuffleDetails } from './decoration';
import { reservedTiles, validateDungeon, validateSettings } from './validation';
import { statueArea } from './dungeon-landmark';
import { areaContains, areasOverlap } from './feature-reservation';
import { studyReservations } from './dungeon-study';
import { createLayout } from './topology';

function generated(settings: DungeonSettings): Dungeon {
  const result = generateDungeon(settings);
  if (!result.ok) throw new Error(`${JSON.stringify(settings)}: ${result.error}`);
  return result.map;
}

test('statues apply and remove exactly, preserve layouts, and survive appearance changes', () => {
  const settings: DungeonSettings = {
    seed: 'mosslit-sanctum',
    preset: 'Mosslit',
    density: 'Balanced',
    roomCount: 6,
  };
  const original = generated(settings);
  const before = structuredClone(original);
  expect(generated({ ...settings, landmark: 'None' })).toEqual(original);
  const marked = changeDungeonAppearance(original, { ...settings, landmark: 'weathered-statue' });
  expect(marked.decoration.landmark).toBe('weathered-statue');
  expect(marked.layout).toBe(original.layout);
  expect(marked.surfaceSeed).toBe(original.surfaceSeed);
  expect(marked.decoration.revision).toBe(0);
  expect(changeDungeonAppearance(marked, { ...settings, landmark: 'None' })).toEqual(original);
  expect(original).toEqual(before);
  const shuffled = shuffleDetails(marked);
  expect(shuffled.decoration).toMatchObject({ landmark: 'weathered-statue', revision: 1 });
  expect(shuffled.layout).toBe(original.layout);
  expect(changeDensity(marked, 'Sparse').decoration).toMatchObject({
    landmark: 'weathered-statue',
    density: 'Sparse',
  });
  expect(changePreset(marked, 'Crypt').decoration).toMatchObject({
    landmark: 'weathered-statue',
    preset: 'Crypt',
  });
});

test.each(ALL_PRESETS)('%s statues generate safely with and without study scenes', (preset) => {
  for (const density of ALL_DENSITIES)
    for (const roomCount of [4, 6, 8])
      for (const scene of ['None', 'Forgotten study'] as const)
        for (let seed = 0; seed < 2; seed++) {
          const settings: DungeonSettings = {
            seed: `statue-${seed}`,
            preset,
            density,
            roomCount,
            scene,
            landmark: 'weathered-statue',
          };
          const map = generated(settings);
          expect(generated(settings)).toEqual(map);
          const before = structuredClone(map);
          const shuffled = shuffleDetails(map);
          expect(map).toEqual(before);
          for (const current of [map, shuffled]) {
            expect(validateDungeon(current)).toBeUndefined();
            const statues = current.decoration.props.filter((p) => p.kind === 'weathered_statue');
            expect(statues).toHaveLength(1);
            const statue = statues[0];
            if (!statue) throw new Error('Expected statue');
            expect(statue.blocking).toBe(true);
            expect(reservedTiles(current.layout).has(indexOf(statue.x, statue.y))).toBe(false);
            const area = statueArea(statue);
            expect(current.decoration.props.filter((p) => areaContains(area, p))).toEqual([statue]);
            for (const reservation of studyReservations(current.layout, current.decoration.props))
              expect(areasOverlap(area, reservation.area)).toBe(false);
            const blocked = new Set(
              current.decoration.props.filter((p) => p.blocking).map((p) => indexOf(p.x, p.y)),
            );
            // Independent flood fill verifies every free tile remains reachable.
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
                current.decoration.props.filter((p) => p.blocking && contains(room, p)).length,
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
});

test('insufficient statue space rejects immutably and invalid settings are rejected', () => {
  const base = generated({
    seed: 'statue-reject',
    roomCount: 4,
    preset: 'Mosslit',
    density: 'Sparse',
  });
  const rooms = [
    { x: 4, y: 4 },
    { x: 20, y: 4 },
    { x: 20, y: 18 },
    { x: 4, y: 18 },
  ].map((p, id) => ({ ...p, id, width: 5, height: 4 }));
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
  expect(changeDungeonAppearance(tiny, { ...tiny.decoration, landmark: 'weathered-statue' })).toBe(
    tiny,
  );
  expect(tiny).toEqual(before);
  expect(
    validateSettings({
      seed: 'x',
      roomCount: 4,
      preset: 'Mosslit',
      density: 'Sparse',
      landmark: 'standing-stone-circle' as never,
    }),
  ).toContain('landmark');
});
