import { expect, test } from 'vitest';
import { characterSample } from './character-sample';
import { CHARACTER_OPTIONS } from '../workbench/character-picker/character-options';
import { validateDungeon } from '../engine/validation';
import { validateForest } from '../engine/forest-validation';

test.each([...CHARACTER_OPTIONS.dungeon, ...CHARACTER_OPTIONS.forest])(
  '$label samples are valid deterministic examples with an undistorted crop',
  (choice) => {
    const before = structuredClone(choice);
    const sample = characterSample(choice);
    expect(characterSample(choice)).toEqual(sample);
    expect(sample.map.seed).toBe('character-showcase');
    expect(sample.map.type).toBe(choice.type);
    if (sample.map.type === 'dungeon') {
      expect(sample.map.decoration.preset).toBe(choice.id);
      expect(validateDungeon(sample.map)).toBeUndefined();
    } else if (sample.map.type === 'forest') {
      expect(sample.map.decoration.character).toBe(choice.id);
      expect(validateForest(sample.map)).toBeUndefined();
    } else throw new Error('Unexpected sample type');
    expect(sample.region.x).toBeGreaterThanOrEqual(0);
    expect(sample.region.y).toBeGreaterThanOrEqual(0);
    expect(sample.region.x + sample.region.width).toBeLessThanOrEqual(40);
    expect(sample.region.y + sample.region.height).toBeLessThanOrEqual(30);
    expect(sample.region.width / sample.region.height).toBeCloseTo(1.6);
    expect(sample.region.width).toBeLessThan(16);
    expect(sample.region.height).toBeLessThan(10);
    expect(choice).toEqual(before);
  },
);
