import { HEIGHT, WIDTH, contains, indexOf, isFloor } from './model';
import type { Layout, Point, Room } from './model';
import { distances } from './topology';

export function reservedTiles(layout: Layout): Set<number> {
  const reserved = new Set<number>();
  const reserve = (point: Point, radius: number): void => {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (isFloor(layout, point.x + dx, point.y + dy))
          reserved.add(indexOf(point.x + dx, point.y + dy));
      }
    }
  };
  reserve(layout.entrance, 1);
  reserve(layout.objective, 1);
  for (const door of layout.thresholds) {
    for (let i = 0; i < door.span; i++) {
      const point = {
        x: door.x + (door.axis === 'horizontal' ? i : 0),
        y: door.y + (door.axis === 'vertical' ? i : 0),
      };
      reserve(point, 1);
    }
  }
  for (let y = 1; y < HEIGHT - 1; y++) {
    for (let x = 1; x < WIDTH - 1; x++) {
      if (!isFloor(layout, x, y)) continue;
      if (!layout.rooms.some((room) => contains(room, { x, y }))) {
        reserve({ x, y }, 1);
      }
    }
  }
  return reserved;
}

export function hasClearSquare(room: Room, blocked: ReadonlySet<number>): boolean {
  for (let y = room.y; y < room.y + room.height - 1; y++) {
    for (let x = room.x; x < room.x + room.width - 1; x++) {
      if (
        [indexOf(x, y), indexOf(x + 1, y), indexOf(x, y + 1), indexOf(x + 1, y + 1)].every(
          (tile) => !blocked.has(tile),
        )
      )
        return true;
    }
  }
  return false;
}

export function isTraversable(layout: Layout, blocked: ReadonlySet<number>): boolean {
  const floorCount = layout.tiles.filter(Boolean).length;
  return (
    distances(layout.tiles, layout.entrance, blocked).size === floorCount - blocked.size &&
    layout.rooms.every((room) => hasClearSquare(room, blocked))
  );
}
