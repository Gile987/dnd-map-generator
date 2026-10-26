import { DUNGEON_LANDMARK_RULES } from './dungeon-landmark';
import { expect, test } from 'vitest';
import { LANDMARK_CATALOG, landmarkIdsFor } from './landmark-catalog';
import { ALL_FOREST_LANDMARKS } from './model';
import { FOREST_LANDMARK_RULES } from './forest-landmark';

test('catalog choices respect map support and each map choice has placement and validation rules', () => {
  const dungeon = landmarkIdsFor('dungeon');
  expect(dungeon).toEqual(['weathered-statue']);
  for (const id of dungeon) {
    expect(LANDMARK_CATALOG[id].label).toBe('Weathered statue');
    expect(DUNGEON_LANDMARK_RULES[id].place).toBeTypeOf('function');
    expect(DUNGEON_LANDMARK_RULES[id].validate).toBeTypeOf('function');
  }
  const forest = landmarkIdsFor('forest');
  expect(forest).toEqual(['standing-stone-circle']);
  expect(ALL_FOREST_LANDMARKS).toEqual(['None', ...forest]);
  for (const id of forest) {
    expect(LANDMARK_CATALOG[id].label).toBe('Standing-stone circle');
    expect(LANDMARK_CATALOG[id].description).toContain('blocks one tile');
    expect(FOREST_LANDMARK_RULES[id].place).toBeTypeOf('function');
    expect(FOREST_LANDMARK_RULES[id].validate).toBeTypeOf('function');
  }
});
