import { describe, expect, test } from 'vitest';
import { generateDungeon } from '../engine/generate';
import { generateForestClearing } from '../engine/forest-generate';
import { dungeonDraftForMap, forestDraftForMap, parseDraft } from './settings-draft';
import type { DungeonDraft, ForestDraft } from './settings-draft';

const dungeon: DungeonDraft = {
  type: 'dungeon',
  seed: '  draft-crypt  ',
  rooms: '6',
  density: 'Cluttered',
  preset: 'Crypt',
};
const forest: ForestDraft = {
  type: 'forest',
  seed: '  draft-grove  ',
  density: 'Sparse',
  character: 'Autumn',
};

describe('draft conversion', () => {
  test('converts only dungeon fields without normalizing or mutating raw input', () => {
    const draft = Object.freeze({ ...dungeon, rooms: '04' });
    expect(parseDraft(draft)).toEqual({
      ok: true,
      type: 'dungeon',
      settings: { seed: '  draft-crypt  ', roomCount: 4, density: 'Cluttered', preset: 'Crypt' },
    });
    expect(draft).toEqual({ ...dungeon, rooms: '04' });
  });

  test('converts only forest fields without requiring dungeon controls or changing the seed', () => {
    const draft = Object.freeze({ ...forest });
    expect(parseDraft(draft)).toEqual({
      ok: true,
      type: 'forest',
      settings: { seed: '  draft-grove  ', density: 'Sparse', character: 'Autumn' },
    });
    expect(draft).toEqual(forest);
  });

  test.each(['', ' ', '4.5', '4.0', '4e0', '+4', ' 4 ', '3', '9', 'NaN', 'Infinity'])(
    'rejects raw room input %j rather than silently normalizing it',
    (rooms) => {
      const draft = Object.freeze({ ...dungeon, rooms });
      expect(parseDraft(draft)).toEqual({
        ok: false,
        error: 'Choose a whole number of rooms from 4 to 8.',
      });
      expect(draft.rooms).toBe(rooms);
    },
  );

  test.each(['4', '6', '8'])('accepts an integer room draft %s', (rooms) => {
    expect(parseDraft({ ...dungeon, rooms })).toMatchObject({
      ok: true,
      type: 'dungeon',
      settings: { roomCount: Number(rooms) },
    });
  });

  test.each([dungeon, forest])(
    '$type seed validation permits correction without changing the draft',
    (base) => {
      for (const seed of ['', '   ', 'x'.repeat(65)]) {
        const draft = Object.freeze({ ...base, seed });
        expect(parseDraft(draft)).toEqual({
          ok: false,
          error: 'Enter a seed between 1 and 64 characters.',
        });
        expect(draft.seed).toBe(seed);
        expect(parseDraft({ ...draft, seed: 'x'.repeat(64) }).ok).toBe(true);
      }
    },
  );

  test('keeps seed errors ahead of room errors when both controls are invalid', () => {
    expect(parseDraft({ ...dungeon, seed: '', rooms: '4.5' })).toEqual({
      ok: false,
      error: 'Enter a seed between 1 and 64 characters.',
    });
  });

  test('restores only the relevant controls from accepted maps', () => {
    const dungeonResult = generateDungeon({
      seed: 'accepted-crypt',
      roomCount: 4,
      density: 'Sparse',
      preset: 'Crypt',
    });
    const forestResult = generateForestClearing({
      seed: 'accepted-grove',
      density: 'Cluttered',
      character: 'Fey',
    });
    if (!dungeonResult.ok) throw new Error(dungeonResult.error);
    if (!forestResult.ok) throw new Error(forestResult.error);
    expect(dungeonDraftForMap(dungeonResult.map)).toEqual({
      type: 'dungeon',
      seed: 'accepted-crypt',
      rooms: '4',
      density: 'Sparse',
      preset: 'Crypt',
    });
    expect(forestDraftForMap(forestResult.map)).toEqual({
      type: 'forest',
      seed: 'accepted-grove',
      density: 'Cluttered',
      character: 'Fey',
    });
  });
});
