import { HEIGHT, WIDTH, indexOf } from './model';
import type { Point } from './model';
import { Random } from './random';
import { gridDistances as forestDistances } from './grid-traversal';

export { forestDistances };
export { NEIGHBORS_4 } from './grid-traversal';

export type Edge = 'north' | 'south' | 'east' | 'west';

interface ClearingCircle {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

export function createClearing(random: Random): { tiles: boolean[]; center: Point } {
  const cx = random.int(13, 27);
  const cy = random.int(9, 21);
  const baseR = random.int(7, 10);

  const circles: ClearingCircle[] = [{ cx, cy, r: baseR }];
  const offsets = [
    { dx: random.int(-3, 3), dy: random.int(-3, 3) },
    { dx: random.int(-4, 4), dy: random.int(-2, 2) },
    { dx: random.int(-2, 2), dy: random.int(-4, 4) },
  ];
  for (const off of offsets) {
    const ncx = Math.max(6, Math.min(WIDTH - 7, cx + off.dx));
    const ncy = Math.max(5, Math.min(HEIGHT - 6, cy + off.dy));
    circles.push({ cx: ncx, cy: ncy, r: baseR + random.int(-2, 1) });
  }

  const tiles = Array<boolean>(WIDTH * HEIGHT).fill(false);
  for (let y = 1; y < HEIGHT - 1; y++) {
    for (let x = 1; x < WIDTH - 1; x++) {
      for (const circle of circles) {
        const dx = x - circle.cx;
        const dy = y - circle.cy;
        if (dx * dx + dy * dy <= circle.r * circle.r) {
          tiles[indexOf(x, y)] = true;
          break;
        }
      }
    }
  }
  return { tiles, center: { x: cx, y: cy } };
}

export function pointOnEdge(edge: Edge, random: Random): Point {
  switch (edge) {
    case 'north':
      return { x: random.int(4, WIDTH - 5), y: 0 };
    case 'south':
      return { x: random.int(4, WIDTH - 5), y: HEIGHT - 1 };
    case 'east':
      return { x: WIDTH - 1, y: random.int(4, HEIGHT - 5) };
    case 'west':
      return { x: 0, y: random.int(4, HEIGHT - 5) };
  }
}

export function oppositeEdge(edge: Edge): Edge {
  switch (edge) {
    case 'north':
      return 'south';
    case 'south':
      return 'north';
    case 'east':
      return 'west';
    case 'west':
      return 'east';
  }
}

function carve(
  tiles: boolean[],
  from: Point,
  to: Point,
  bend: 'horizontal-first' | 'vertical-first',
): number[] {
  const route: number[] = [];
  const step = (x: number, y: number): void => {
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        if (tx >= 0 && tx < WIDTH && ty >= 0 && ty < HEIGHT) {
          const idx = indexOf(tx, ty);
          tiles[idx] = true;
          route.push(idx);
        }
      }
    }
  };
  const corner = bend === 'horizontal-first' ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
  let { x, y } = from;
  step(x, y);
  while (x !== corner.x || y !== corner.y) {
    x += Math.sign(corner.x - x);
    y += Math.sign(corner.y - y);
    step(x, y);
  }
  while (x !== to.x || y !== to.y) {
    x += Math.sign(to.x - x);
    y += Math.sign(to.y - y);
    step(x, y);
  }
  return route;
}

export function carvePath(
  tiles: boolean[],
  pathStart: Point,
  pathEnd: Point,
  center: Point,
  random: Random,
): number[] {
  const bend1 = random.next() < 0.5 ? 'horizontal-first' : 'vertical-first';
  const bend2 = random.next() < 0.5 ? 'horizontal-first' : 'vertical-first';
  const route1 = carve(tiles, pathStart, center, bend1);
  const route2 = carve(tiles, center, pathEnd, bend2);
  return [...new Set([...route1, ...route2])];
}

export function isConnected(tiles: readonly boolean[]): boolean {
  let start = -1;
  let floorCount = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i]) {
      floorCount++;
      if (start === -1) start = i;
    }
  }
  if (start === -1 || floorCount === 0) return false;
  const sx = start % WIDTH;
  const sy = Math.floor(start / WIDTH);
  const reached = forestDistances(tiles, { x: sx, y: sy });
  return reached.size === floorCount;
}
