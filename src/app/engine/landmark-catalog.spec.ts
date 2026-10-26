import { expect, test } from 'vitest';
import { LANDMARK_CATALOG, landmarkIdsFor } from './landmark-catalog';
import { ALL_FOREST_LANDMARKS } from './model';
import { FOREST_LANDMARK_RULES } from './forest-landmark';

test('catalog choices respect map support and each forest choice has placement and validation rules', () => {
  expect(landmarkIdsFor('dungeon')).toEqual([]);
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
