import { describe, expect, test } from 'vitest';
import { HEIGHT, WIDTH, indexOf } from '../engine/model';
import type { Point } from '../engine/model';
import { boundaryLoops, traceBoundaries } from './boundaries';

function field(points: readonly (readonly [number, number])[]): {
  readonly tiles: readonly boolean[];
} {
  const tiles = Array<boolean>(WIDTH * HEIGHT).fill(false);
  for (const [x, y] of points) tiles[indexOf(x, y)] = true;
  return { tiles: Object.freeze(tiles) };
}

function vertices(loop: ReturnType<typeof boundaryLoops>[number]): Point[] {
  const first = loop[0];
  if (!first) throw new Error('Expected a nonempty contour');
  for (let i = 0; i < loop.length; i++) {
    const edge = loop[i];
    const next = loop[(i + 1) % loop.length];
    expect(edge?.b).toEqual(next?.a);
  }
  return [first.a, ...loop.map((edge) => edge.b)];
}

function signedArea(loop: ReturnType<typeof boundaryLoops>[number]): number {
  vertices(loop);
  return loop.reduce((area, { a, b }) => area + a.x * b.y - b.x * a.y, 0) / 2;
}

describe('tile boundary contours', () => {
  test('an empty field has no contours', () => {
    expect(boundaryLoops(field([]))).toEqual([]);
  });

  test.each([
    [0, 0],
    [WIDTH - 1, 0],
    [0, HEIGHT - 1],
    [WIDTH - 1, HEIGHT - 1],
  ] as const)('closes a single tile at map corner (%i, %i) without wrapping neighbors', (x, y) => {
    const loops = boundaryLoops(field([[x, y]]));
    expect(loops).toHaveLength(1);
    for (const loop of loops) {
      expect(vertices(loop)).toEqual([
        { x, y },
        { x: x + 1, y },
        { x: x + 1, y: y + 1 },
        { x, y: y + 1 },
        { x, y },
      ]);
      expect(signedArea(loop)).toBe(1);
    }
  });

  test('traces a concave corner in stable order and omits shared floor edges', () => {
    const layout = field([
      [1, 1],
      [2, 1],
      [1, 2],
    ]);
    const snapshot = [...layout.tiles];
    const loops = boundaryLoops(layout);
    expect(loops).toHaveLength(1);
    for (const loop of loops) {
      expect(vertices(loop)).toEqual([
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: 3 },
        { x: 1, y: 3 },
        { x: 1, y: 2 },
        { x: 1, y: 1 },
      ]);
      expect(signedArea(loop)).toBe(3);
    }
    expect(layout.tiles).toEqual(snapshot);
  });

  test('keeps the outer contour and a hole separate with opposite winding', () => {
    const loops = boundaryLoops(
      field([
        [1, 1],
        [2, 1],
        [3, 1],
        [1, 2],
        [3, 2],
        [1, 3],
        [2, 3],
        [3, 3],
      ]),
    );
    expect(loops.map((loop) => loop.length)).toEqual([12, 4]);
    expect(loops.map(signedArea)).toEqual([9, -1]);
  });

  test.each([
    [
      [1, 1],
      [2, 2],
    ],
    [
      [2, 1],
      [1, 2],
    ],
  ] as const)('diagonal contact %j preserves two closed contours', (first, second) => {
    const loops = boundaryLoops(field([first, second]));
    expect(loops.map((loop) => loop.length)).toEqual([4, 4]);
    expect(loops.map(signedArea)).toEqual([1, 1]);
  });

  test('a fully walkable field traces only the outer map border', () => {
    const loops = boundaryLoops({ tiles: Array<boolean>(WIDTH * HEIGHT).fill(true) });
    expect(loops).toHaveLength(1);
    for (const loop of loops) {
      expect(loop).toHaveLength(2 * (WIDTH + HEIGHT));
      expect(signedArea(loop)).toBe(WIDTH * HEIGHT);
    }
  });

  test('drawing closes each contour separately in one path and skips empty contours', () => {
    const calls: (string | number)[][] = [];
    const ctx = {
      beginPath: () => {
        calls.push(['begin']);
      },
      moveTo: (x: number, y: number) => {
        calls.push(['move', x, y]);
      },
      lineTo: (x: number, y: number) => {
        calls.push(['line', x, y]);
      },
      closePath: () => {
        calls.push(['close']);
      },
    };
    traceBoundaries(ctx, [
      [],
      ...boundaryLoops(
        field([
          [1, 1],
          [3, 1],
        ]),
      ),
    ]);
    expect(calls).toEqual([
      ['begin'],
      ['move', 1, 1],
      ['line', 2, 1],
      ['line', 2, 2],
      ['line', 1, 2],
      ['line', 1, 1],
      ['close'],
      ['move', 3, 1],
      ['line', 4, 1],
      ['line', 4, 2],
      ['line', 3, 2],
      ['line', 3, 1],
      ['close'],
    ]);
  });
});
