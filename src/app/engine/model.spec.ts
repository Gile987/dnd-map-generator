import { describe, expect, test } from 'vitest';
import {
  ALL_DENSITIES,
  ALL_FOREST_CHARACTERS,
  ALL_PRESETS,
  ALL_PROP_KINDS,
  DENSITY_BUDGETS,
} from './model';

describe('production option constants', () => {
  test('density options match the supported vocabulary', () => {
    expect(ALL_DENSITIES).toEqual(['Sparse', 'Balanced', 'Cluttered']);
  });

  test('density budgets match the shared product policy', () => {
    expect(DENSITY_BUDGETS).toEqual({ Sparse: 0.05, Balanced: 0.1, Cluttered: 0.15 });
  });

  test('dungeon presets match the supported vocabulary', () => {
    expect(ALL_PRESETS).toEqual(['Mosslit', 'Crypt', 'Storehouse', 'Sanctuary']);
  });

  test('forest characters match the supported vocabulary', () => {
    expect(ALL_FOREST_CHARACTERS).toEqual(['Verdant', 'Autumn', 'Pines', 'Fey']);
  });

  test('prop kinds match the supported vocabulary', () => {
    expect(ALL_PROP_KINDS).toEqual([
      'crate',
      'barrel',
      'rubble',
      'rug',
      'sconce',
      'moss',
      'sarcophagus',
      'vine',
      'broken_column',
      'desk',
      'bookshelf',
      'scroll_case',
      'tree',
      'boulder',
      'fern',
      'mushroom',
      'bush',
      'log',
      'stump',
      'flower',
      'tent',
      'bedroll',
      'fire_ring',
      'supply_bundle',
      'standing_stone',
    ]);
  });
});
