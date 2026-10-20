import { HEIGHT, WIDTH, indexOf } from './model';
import type { Point } from './model';

export const NEIGHBORS_4: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

export function gridDistances(
  tiles: readonly boolean[],
  start: Point,
  blocked: ReadonlySet<number> = new Set(),
): Map<number, number> {
  const first = indexOf(start.x, start.y);
  const result = new Map<number, number>();
  if (!tiles[first] || blocked.has(first)) return result;
  result.set(first, 0);
  const queue = [first];
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (current === undefined) continue;
    const x = current % WIDTH;
    const y = Math.floor(current / WIDTH);
    for (const [nx, ny] of NEIGHBORS_4) {
      const nnx = nx + x;
      const nny = ny + y;
      if (nnx < 0 || nny < 0 || nnx >= WIDTH || nny >= HEIGHT) continue;
      const next = indexOf(nnx, nny);
      if (tiles[next] && !blocked.has(next) && !result.has(next)) {
        result.set(next, (result.get(current) ?? 0) + 1);
        queue.push(next);
      }
    }
  }
  return result;
}
