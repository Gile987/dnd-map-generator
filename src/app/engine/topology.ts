import { HEIGHT, WIDTH, center, contains, indexOf, isFloor } from './model';
import type { Connection, Landmark, Layout, Point, Room, Threshold } from './model';

export function carveLayout(rooms: readonly Room[], connections: readonly Connection[]): boolean[] {
  const tiles = Array<boolean>(WIDTH * HEIGHT).fill(false);
  for (const room of rooms) {
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) tiles[indexOf(x, y)] = true;
    }
  }
  const carve = (point: Point): void => {
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const x = point.x + dx;
        const y = point.y + dy;
        if (x > 0 && x < WIDTH - 1 && y > 0 && y < HEIGHT - 1) tiles[indexOf(x, y)] = true;
      }
    }
  };
  for (const link of connections) {
    const from = rooms.find((room) => room.id === link.from);
    const to = rooms.find((room) => room.id === link.to);
    if (!from || !to) continue;
    const a = center(from);
    const b = center(to);
    const bend = link.bend === 'horizontal' ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
    for (const [start, end] of [
      [a, bend],
      [bend, b],
    ] as const) {
      let { x, y } = start;
      carve({ x, y });
      while (x !== end.x || y !== end.y) {
        x += Math.sign(end.x - x);
        y += Math.sign(end.y - y);
        carve({ x, y });
      }
    }
  }
  return tiles;
}

export function distances(
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
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx === undefined || ny === undefined || nx < 0 || ny < 0 || nx >= WIDTH || ny >= HEIGHT)
        continue;
      const next = indexOf(nx, ny);
      if (tiles[next] && !blocked.has(next) && !result.has(next)) {
        result.set(next, (result.get(current) ?? 0) + 1);
        queue.push(next);
      }
    }
  }
  return result;
}

export function findThresholds(tiles: readonly boolean[], rooms: readonly Room[]): Threshold[] {
  const thresholds: Threshold[] = [];
  for (const room of rooms) {
    for (const side of ['north', 'south', 'west', 'east'] as const) {
      const horizontal = side === 'north' || side === 'south';
      const length = horizontal ? room.width : room.height;
      const outside = (offset: number): Point =>
        horizontal
          ? { x: room.x + offset, y: side === 'north' ? room.y - 1 : room.y + room.height }
          : { x: side === 'west' ? room.x - 1 : room.x + room.width, y: room.y + offset };
      let run = 0;
      for (let offset = 0; offset <= length; offset++) {
        const point = outside(offset);
        const open =
          offset < length &&
          isFloor({ tiles }, point.x, point.y) &&
          !rooms.some((other) => other.id !== room.id && contains(other, point));
        if (open) {
          run++;
        } else {
          if (run === 2 && offset - run > 0 && offset < length) {
            const start = outside(offset - run);
            thresholds.push({
              x: horizontal ? start.x : side === 'west' ? room.x : room.x + room.width,
              y: horizontal ? (side === 'north' ? room.y : room.y + room.height) : start.y,
              axis: horizontal ? 'horizontal' : 'vertical',
              span: 2,
              roomId: room.id,
            });
          }
          run = 0;
        }
      }
    }
  }
  return thresholds;
}

export function chooseLandmarks(
  tiles: readonly boolean[],
  rooms: readonly Room[],
): { entrance: Landmark; objective: Landmark } | undefined {
  let best = -1;
  let result: { entrance: Landmark; objective: Landmark } | undefined;
  for (const room of rooms) {
    const a = center(room);
    const travel = distances(tiles, a);
    for (const other of rooms) {
      if (room.id >= other.id) continue;
      const b = center(other);
      const distance = travel.get(indexOf(b.x, b.y));
      if (distance !== undefined && distance > best) {
        best = distance;
        result = { entrance: { ...a, roomId: room.id }, objective: { ...b, roomId: other.id } };
      }
    }
  }
  return result;
}

export function createLayout(rooms: readonly Room[], connections: readonly Connection[]): Layout {
  const tiles = carveLayout(rooms, connections);
  const landmarks = chooseLandmarks(tiles, rooms);
  if (!landmarks) throw new Error('The layout needs two connected rooms.');
  return { tiles, rooms, connections, thresholds: findThresholds(tiles, rooms), ...landmarks };
}
