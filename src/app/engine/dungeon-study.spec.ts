import { expect, test } from 'vitest';
import { ALL_DENSITIES, ALL_PRESETS, contains, DENSITY_BUDGETS, indexOf } from './model';
import type { Dungeon, DungeonSettings } from './model';
import { generateDungeon } from './generate';
import { changeDungeonAppearance, shuffleDetails } from './decoration';
import { hasClearSquare, reservedTiles, validateDungeon } from './validation';
import { createLayout } from './topology';

function generated(settings: DungeonSettings): Dungeon {
  const result = generateDungeon(settings);
  if (!result.ok) throw new Error(`${settings.seed}: ${result.error}`);
  return result.map;
}

test('study settings preserve the map until applied and can be removed exactly', () => {
  const original = generated({
    seed: 'mosslit-sanctum',
    roomCount: 6,
    preset: 'Mosslit',
    density: 'Balanced',
  });
  const snapshot = structuredClone(original);
  const study = changeDungeonAppearance(original, {
    ...original.decoration,
    scene: 'Forgotten study',
  });
  expect(study.decoration.scene).toBe('Forgotten study');
  expect(study.layout).toBe(original.layout);
  expect(study.surfaceSeed).toBe(original.surfaceSeed);
  expect(study.decoration.revision).toBe(0);
  expect(changeDungeonAppearance(study, { ...study.decoration, scene: 'None' })).toEqual(original);
  expect(original).toEqual(snapshot);
  const shuffled = shuffleDetails(study);
  expect(shuffled.decoration.scene).toBe('Forgotten study');
  expect(shuffled.decoration.revision).toBe(1);
  expect(shuffled.decoration.props).not.toEqual(study.decoration.props);
  expect(shuffled.layout).toBe(original.layout);
});

test.each(ALL_PRESETS)(
  '%s studies are deterministic, coherent and within room budgets',
  (preset) => {
    for (const density of ALL_DENSITIES)
      for (const roomCount of [4, 6, 8])
        for (let seed = 0; seed < 3; seed++) {
          const settings: DungeonSettings = {
            seed: `study-${seed}`,
            roomCount,
            preset,
            density,
            scene: 'Forgotten study',
          };
          const map = generated(settings);
          expect(generated(settings)).toEqual(map);
          const shuffled = shuffleDetails(map);
          expect(shuffled.decoration.revision).toBe(1);
          for (const current of [map, shuffled]) {
            expect(validateDungeon(current)).toBeUndefined();
            const objects = current.decoration.props.filter(
              (p) => p.kind === 'desk' || p.kind === 'bookshelf' || p.kind === 'scroll_case',
            );
            expect(objects.map((p) => p.kind).sort()).toEqual(['bookshelf', 'desk', 'scroll_case']);
            const desk = objects.find((p) => p.kind === 'desk');
            if (!desk) throw new Error('Missing desk');
            const room = current.layout.rooms.find((room) => contains(room, desk));
            if (!room) throw new Error('Missing study room');
            const reserved = reservedTiles(current.layout);
            for (const object of objects) {
              expect(contains(room, object)).toBe(true);
              expect(reserved.has(indexOf(object.x, object.y))).toBe(false);
              expect(
                current.decoration.props.filter((p) => p.x === object.x && p.y === object.y),
              ).toHaveLength(1);
            }
            const blocked = new Set(
              current.decoration.props.filter((p) => p.blocking).map((p) => indexOf(p.x, p.y)),
            );
            for (const room of current.layout.rooms) {
              expect(
                current.decoration.props.filter((p) => p.blocking && contains(room, p)).length,
              ).toBeLessThanOrEqual(
                Math.floor(room.width * room.height * DENSITY_BUDGETS[density]),
              );
              expect(hasClearSquare(room, blocked)).toBe(true);
            }
          }
        }
  },
);

test('a study rejects insufficient space without mutating the original map', () => {
  const map = generated({
    seed: 'mosslit-sanctum',
    roomCount: 6,
    preset: 'Mosslit',
    density: 'Balanced',
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
    decoration: { ...map.decoration, density: 'Sparse', props: [] },
  };
  expect(validateDungeon(tiny)).toBeUndefined();
  const snapshot = structuredClone(tiny);
  expect(
    changeDungeonAppearance(tiny, {
      density: 'Sparse',
      preset: 'Mosslit',
      scene: 'Forgotten study',
    }),
  ).toBe(tiny);
  expect(tiny).toEqual(snapshot);
});
