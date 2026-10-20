import { describe, expect, test, vi } from 'vitest';
import { Random, shuffleInPlace } from './random';

describe('seeded in-place shuffling', () => {
  test.each([
    { seed: 0, order: ['f', 'c', 'd', 'e', 'a', 'b'], next: 0.5450490827206522 },
    { seed: 1, order: ['e', 'b', 'f', 'c', 'a', 'd'], next: 0.281103502959013 },
    { seed: 123456, order: ['b', 'f', 'a', 'e', 'd', 'c'], next: 0.23283709771931171 },
  ])(
    'preserves the pre-extraction order and next random draw for seed $seed',
    ({ seed, order, next }) => {
      const items = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }));
      const originals = [...items];
      const random = new Random(seed);
      shuffleInPlace(items, random);
      expect(items.map((item) => item.id)).toEqual(order);
      expect(random.next()).toBe(next);
      for (const item of originals) expect(items).toContain(item);
      expect(new Set(items).size).toBe(originals.length);
    },
  );

  test.each([
    { name: 'empty', input: [] },
    { name: 'singleton', input: [{ id: 'only' }] },
  ])('$name input consumes no randomness', ({ input }) => {
    const items = [...input];
    const snapshot = [...items];
    const int = vi.fn(() => 0);
    shuffleInPlace(items, { int });
    expect(items).toEqual(snapshot);
    expect(int).not.toHaveBeenCalled();
  });

  test('draws once per descending index with inclusive zero-to-index bounds', () => {
    const items = ['a', 'b', 'c', 'd'];
    const int = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(1).mockReturnValueOnce(0);
    shuffleInPlace(items, { int });
    expect(int.mock.calls).toEqual([
      [0, 3],
      [0, 2],
      [0, 1],
    ]);
    expect(items).toEqual(['c', 'd', 'b', 'a']);
  });

  test('a self-swap still consumes its draw and preserves element identity', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const snapshot = [...items];
    const int = vi.fn((_min: number, max: number) => max);
    shuffleInPlace(items, { int });
    expect(items).toEqual(snapshot);
    expect(int.mock.calls).toEqual([
      [0, 2],
      [0, 1],
    ]);
    for (const [index, item] of snapshot.entries()) expect(items[index]).toBe(item);
  });

  test('handles defined falsy values without skipping their swaps', () => {
    const items: (string | number | boolean)[] = [0, false, ''];
    shuffleInPlace(items, { int: () => 0 });
    expect(items).toEqual([false, '', 0]);
  });
});
