import { HEIGHT, WIDTH, contains, indexOf, isFloor } from './model';
import type { Dungeon, Layout, Point, Room, Settings } from './model';
import { distances } from './topology';

export function validateSettings(settings: Settings): string | undefined {
  if (!settings.seed.trim() || settings.seed.trim().length > 64)
    return 'Enter a seed between 1 and 64 characters.';
  if (!Number.isInteger(settings.roomCount) || settings.roomCount < 4 || settings.roomCount > 8)
    return 'Choose a whole number of rooms from 4 to 8.';
  if (!['Sparse', 'Balanced', 'Cluttered'].includes(settings.density))
    return 'Choose a valid decoration density.';
  return undefined;
}

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

export function validateLayout(layout: Layout, roomCount: number): string | undefined {
  if (layout.tiles.length !== WIDTH * HEIGHT) return 'The tile field has incorrect dimensions.';
  if (layout.rooms.length !== roomCount)
    return 'The requested number of rooms could not be placed.';
  if (new Set(layout.rooms.map((room) => room.id)).size !== roomCount)
    return 'Room identifiers must be unique.';
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if ((x === 0 || y === 0 || x === WIDTH - 1 || y === HEIGHT - 1) && isFloor(layout, x, y))
        return 'The outer solid border must stay intact.';
    }
  }
  for (const room of layout.rooms) {
    if (room.x < 1 || room.y < 1 || room.x + room.width >= WIDTH || room.y + room.height >= HEIGHT)
      return 'A room is outside the map bounds.';
    if (room.width < 5 || room.width > 9 || room.height < 4 || room.height > 7)
      return 'A room has invalid dimensions.';
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        if (!isFloor(layout, x, y)) return 'A room contains a solid tile.';
      }
    }
  }
  if (layout.entrance.roomId === layout.objective.roomId)
    return 'Entrance and objective must be in different rooms.';
  for (const landmark of [layout.entrance, layout.objective]) {
    const room = layout.rooms.find((candidate) => candidate.id === landmark.roomId);
    if (!room || !contains(room, landmark) || !isFloor(layout, landmark.x, landmark.y))
      return 'A landmark is outside its room.';
  }
  if (!isTraversable(layout, new Set())) return 'The floor tiles are not connected.';
  for (const door of layout.thresholds) {
    const room = layout.rooms.find((candidate) => candidate.id === door.roomId);
    if (!room || door.span !== 2) return 'A threshold has an invalid room or width.';
    const onBoundary =
      door.axis === 'horizontal'
        ? (door.y === room.y || door.y === room.y + room.height) &&
          door.x > room.x &&
          door.x + 2 < room.x + room.width
        : (door.x === room.x || door.x === room.x + room.width) &&
          door.y > room.y &&
          door.y + 2 < room.y + room.height;
    if (!onBoundary) return 'A threshold is not on a clear room opening.';
    for (let i = 0; i < 2; i++) {
      const x = door.x + (door.axis === 'horizontal' ? i : 0);
      const y = door.y + (door.axis === 'vertical' ? i : 0);
      const neighbor = door.axis === 'horizontal' ? { x, y: y - 1 } : { x: x - 1, y };
      if (!isFloor(layout, x, y) || !isFloor(layout, neighbor.x, neighbor.y))
        return 'A threshold does not span passable floor.';
    }
  }
  return undefined;
}

export function validateDungeon(map: Dungeon): string | undefined {
  const layoutError = validateLayout(map.layout, map.layout.rooms.length);
  if (layoutError) return layoutError;
  const reserved = reservedTiles(map.layout);
  const blocked = new Set<number>();
  for (const prop of map.decoration.props) {
    if (!isFloor(map.layout, prop.x, prop.y)) return 'A prop is outside the floor.';
    if (prop.blocking !== ['crate', 'barrel', 'rubble'].includes(prop.kind))
      return 'A prop has an invalid movement classification.';
    if (!prop.blocking) continue;
    const tile = indexOf(prop.x, prop.y);
    if (reserved.has(tile) || blocked.has(tile))
      return 'A blocking prop overlaps reserved space or another prop.';
    if (!map.layout.rooms.some((room) => contains(room, prop)))
      return 'A blocking prop is outside a room.';
    blocked.add(tile);
  }
  if (!isTraversable(map.layout, blocked)) return 'Decoration blocks access through the dungeon.';
  return undefined;
}
