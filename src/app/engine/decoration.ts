import { center, indexOf, isFloor } from './model';
import type { Decoration, Density, Dungeon, Layout, Prop } from './model';
import { Random, streamSeed } from './random';
import { isTraversable, reservedTiles } from './validation';

const budgets: Readonly<Record<Density, number>> = { Sparse: 0.05, Balanced: 0.1, Cluttered: 0.15 };

export function decorate(
  layout: Layout,
  seed: string,
  density: Density,
  revision: number,
): Decoration {
  const random = new Random(streamSeed(seed, 'decoration', density, revision));
  const props: Prop[] = [];
  const blocked = new Set<number>();
  const reserved = reservedTiles(layout);
  for (const room of layout.rooms) {
    const candidates: { x: number; y: number }[] = [];
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        if (
          x === room.x ||
          y === room.y ||
          x === room.x + room.width - 1 ||
          y === room.y + room.height - 1
        )
          candidates.push({ x, y });
      }
    }
    for (let i = candidates.length - 1; i > 0; i--) {
      const swap = random.int(0, i);
      const a = candidates[i];
      const b = candidates[swap];
      if (a && b) {
        candidates[i] = b;
        candidates[swap] = a;
      }
    }
    const budget = Math.floor(room.width * room.height * budgets[density]);
    let placed = 0;
    for (const point of candidates) {
      if (placed >= budget) break;
      const tile = indexOf(point.x, point.y);
      if (reserved.has(tile) || blocked.has(tile)) continue;
      blocked.add(tile);
      if (!isTraversable(layout, blocked)) {
        blocked.delete(tile);
        continue;
      }
      const corner =
        (point.x === room.x || point.x === room.x + room.width - 1) &&
        (point.y === room.y || point.y === room.y + room.height - 1);
      props.push({
        ...point,
        kind: corner && random.next() < 0.7 ? 'rubble' : random.next() < 0.5 ? 'crate' : 'barrel',
        blocking: true,
        variation: random.next(),
      });
      placed++;
    }
    const middle = center(room);
    if (random.next() < 0.55 && room.height >= 5 && !reserved.has(indexOf(middle.x, middle.y))) {
      props.push({ ...middle, kind: 'rug', blocking: false, variation: random.next() });
    }
    const wallTiles = candidates.filter(
      (point) =>
        !blocked.has(indexOf(point.x, point.y)) &&
        !reserved.has(indexOf(point.x, point.y)) &&
        !isFloor(layout, point.x, point.y - 1),
    );
    const torch = wallTiles[0];
    if (torch) props.push({ ...torch, kind: 'sconce', blocking: false, variation: random.next() });
    const mossCount = density === 'Sparse' ? 2 : density === 'Balanced' ? 4 : 6;
    for (const point of wallTiles.slice(1, mossCount + 1)) {
      props.push({ ...point, kind: 'moss', blocking: false, variation: random.next() });
    }
  }
  return { props, density, revision };
}

export function shuffleDetails(map: Dungeon, density: Density = map.decoration.density): Dungeon {
  const revision = map.decoration.revision + 1;
  return { ...map, decoration: decorate(map.layout, map.seed, density, revision) };
}

export function changeDensity(map: Dungeon, density: Density): Dungeon {
  return { ...map, decoration: decorate(map.layout, map.seed, density, map.decoration.revision) };
}
