import { describe, expect, test } from 'vitest';
import { HEIGHT, WIDTH, indexOf } from './model';
import { gridDistances } from './grid-traversal';

function tilesWith(points: readonly (readonly [number, number])[]): readonly boolean[] {
  const tiles = Array<boolean>(WIDTH * HEIGHT).fill(false);
  for (const [x, y] of points) tiles[indexOf(x, y)] = true;
  return Object.freeze(tiles);
}

describe('four-neighbor grid distances', () => {
  test('preserves shortest distances and left/right/up/down discovery order', () => {
    const tiles = tilesWith([
      [1, 1],
      [2, 1],
      [3, 1],
      [1, 2],
      [2, 2],
      [3, 2],
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
    expect([...gridDistances(tiles, { x: 2, y: 2 })]).toEqual([
      [indexOf(2, 2), 0],
      [indexOf(1, 2), 1],
      [indexOf(3, 2), 1],
      [indexOf(2, 1), 1],
      [indexOf(2, 3), 1],
      [indexOf(1, 1), 2],
      [indexOf(1, 3), 2],
      [indexOf(3, 1), 2],
      [indexOf(3, 3), 2],
    ]);
  });

  test('excludes disconnected floor and diagonal-only neighbors', () => {
    const tiles = tilesWith([
      [1, 1],
      [2, 1],
      [3, 2],
      [8, 8],
    ]);
    expect([...gridDistances(tiles, { x: 1, y: 1 })]).toEqual([
      [indexOf(1, 1), 0],
      [indexOf(2, 1), 1],
    ]);
  });

  test('a blocked start produces no reachable tiles', () => {
    const tiles = tilesWith([
      [1, 1],
      [2, 1],
    ]);
    const blocked = new Set([indexOf(1, 1)]);
    expect([...gridDistances(tiles, { x: 1, y: 1 }, blocked)]).toEqual([]);
    expect([...blocked]).toEqual([indexOf(1, 1)]);
  });

  test('a solid start produces no reachable tiles', () => {
    expect([...gridDistances(tilesWith([[2, 1]]), { x: 1, y: 1 })]).toEqual([]);
  });

  test('blocked corridors exclude the floor beyond them without mutating inputs', () => {
    const tiles = tilesWith([
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 1],
    ]);
    const snapshot = [...tiles];
    const blocked = new Set([indexOf(3, 1)]);
    expect([...gridDistances(tiles, { x: 1, y: 1 }, blocked)]).toEqual([
      [indexOf(1, 1), 0],
      [indexOf(2, 1), 1],
    ]);
    expect(tiles).toEqual(snapshot);
    expect([...blocked]).toEqual([indexOf(3, 1)]);
  });

  test('finds the shortest available detour around a blocked tile', () => {
    const tiles = tilesWith([
      [1, 1],
      [2, 1],
      [3, 1],
      [1, 2],
      [2, 2],
      [3, 2],
    ]);
    const reached = gridDistances(tiles, { x: 1, y: 1 }, new Set([indexOf(2, 1)]));
    expect(reached.get(indexOf(3, 1))).toBe(4);
    expect(reached.has(indexOf(2, 1))).toBe(false);
    expect(reached.size).toBe(5);
  });

  test('never wraps across a row boundary', () => {
    const tiles = tilesWith([
      [WIDTH - 1, 0],
      [0, 1],
    ]);
    expect([...gridDistances(tiles, { x: WIDTH - 1, y: 0 })]).toEqual([[indexOf(WIDTH - 1, 0), 0]]);
  });

  test('reaches all map corners in a full field with Manhattan distances', () => {
    const reached = gridDistances(Object.freeze(Array<boolean>(WIDTH * HEIGHT).fill(true)), {
      x: 0,
      y: 0,
    });
    expect(reached.size).toBe(WIDTH * HEIGHT);
    expect(reached.get(indexOf(WIDTH - 1, 0))).toBe(WIDTH - 1);
    expect(reached.get(indexOf(0, HEIGHT - 1))).toBe(HEIGHT - 1);
    expect(reached.get(indexOf(WIDTH - 1, HEIGHT - 1))).toBe(WIDTH + HEIGHT - 2);
  });
});
