import { describe, expect, test } from 'vitest';
import { HEIGHT, WIDTH, indexOf } from './model';
import type { Point, Room } from './model';
import { findThresholds } from './topology';

const room: Room = { id: 0, x: 5, y: 5, width: 8, height: 6 };

function tilesWith(openPoints: readonly Point[]): boolean[] {
  const tiles = Array<boolean>(WIDTH * HEIGHT).fill(false);
  for (const point of openPoints) tiles[indexOf(point.x, point.y)] = true;
  return tiles;
}

const northRow = (offsets: readonly number[]): Point[] =>
  offsets.map((offset) => ({ x: room.x + offset, y: room.y - 1 }));

describe('findThresholds', () => {
  test('marks an unambiguous mid-wall two-tile opening as a threshold', () => {
    expect(findThresholds(tilesWith(northRow([3, 4])), [room])).toEqual([
      { x: 8, y: 5, axis: 'horizontal', span: 2, roomId: 0 },
    ]);
    const westColumn = [
      { x: room.x - 1, y: room.y + 2 },
      { x: room.x - 1, y: room.y + 3 },
    ];
    expect(findThresholds(tilesWith(westColumn), [room])).toEqual([
      { x: 5, y: 7, axis: 'vertical', span: 2, roomId: 0 },
    ]);
  });

  test('omits thresholds for ambiguous or broad openings', () => {
    const cases: readonly (readonly number[])[] = [[], [4], [3, 4, 5], [0, 1], [6, 7]];
    for (const offsets of cases)
      expect(findThresholds(tilesWith(northRow(offsets)), [room]), JSON.stringify(offsets)).toEqual(
        [],
      );
  });

  test('omits openings that belong to another room', () => {
    const neighbor: Room = { id: 1, x: 8, y: 2, width: 4, height: 3 };
    const tiles = tilesWith(northRow([4, 5]));
    expect(findThresholds(tiles, [room])).toEqual([
      { x: 9, y: 5, axis: 'horizontal', span: 2, roomId: 0 },
    ]);
    expect(findThresholds(tiles, [room, neighbor])).toEqual([]);
  });
});
