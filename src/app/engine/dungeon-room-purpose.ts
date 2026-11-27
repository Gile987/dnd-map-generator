import { contains, center, DENSITY_BUDGETS, indexOf, isFloor } from './model';
import type {
  Decoration,
  Dungeon,
  DungeonRoomTheme,
  Layout,
  Point,
  Prop,
  Room,
  RoomPurpose,
} from './model';
import { propCells, propBounds } from './prop-footprint';
import { reservedTiles, isTraversable } from './dungeon-space';
import { Random, shuffleInPlace, streamSeed } from './random';

export const ROOM_FURNISHING_KINDS = [
  'wooden_bed',
  'bedroll',
  'weapon_rack',
  'supply_sacks',
] as const;
export function isRoomFurnishing(kind: Prop['kind']): boolean {
  return ROOM_FURNISHING_KINDS.some((candidate) => candidate === kind);
}
function eligibleRoom(layout: Layout, props: readonly Prop[], room: Room): boolean {
  return (
    !contains(room, layout.entrance) &&
    !contains(room, layout.objective) &&
    !props.some(
      (p) =>
        contains(room, p) &&
        ['desk', 'weathered_statue', 'dining_table', 'ritual_altar'].includes(p.kind),
    )
  );
}
function blockedCells(props: readonly Prop[]): Set<number> {
  return new Set(
    props
      .filter((p) => p.blocking)
      .flatMap(propCells)
      .map((p) => indexOf(p.x, p.y)),
  );
}

/** Purpose is independent of character. Only suitable ordinary rooms are refurnished. */
export function furnishRooms(
  layout: Layout,
  seed: string,
  base: Decoration,
  theme: DungeonRoomTheme,
): Decoration {
  if (theme === 'General rooms') return base;
  let props = [...base.props];
  const purposes: RoomPurpose[] = [],
    rooms = layout.rooms.filter((room) => eligibleRoom(layout, base.props, room));
  const random = new Random(streamSeed(seed, 'room-purpose', theme, base.density, base.revision));
  shuffleInPlace(rooms, random);
  const reserved = reservedTiles(layout);
  for (const [ordinal, room] of rooms.entries()) {
    const purpose =
      theme === 'Mixed rooms'
        ? ordinal % 2 === 0
          ? 'Barracks'
          : 'Storeroom'
        : theme === 'Barracks'
          ? 'Barracks'
          : 'Storeroom';
    const previous = props;
    // Keep wall attachments and floor cover; the purpose replaces generic physical clutter.
    props = props.filter(
      (p) => !contains(room, p) || (!p.blocking && !(purpose === 'Storeroom' && p.kind === 'rug')),
    );
    const budget = Math.floor(room.width * room.height * DENSITY_BUDGETS[base.density]);
    let used = 0;
    const points: Point[] = [];
    for (let y = room.y; y < room.y + room.height; y++)
      for (let x = room.x; x < room.x + room.width; x++)
        if (
          x === room.x ||
          y === room.y ||
          x === room.x + room.width - 1 ||
          y === room.y + room.height - 1
        )
          points.push({ x, y });
    const corner =
      [
        { x: room.x, y: room.y },
        { x: room.x + room.width - 1, y: room.y },
        { x: room.x, y: room.y + room.height - 1 },
        { x: room.x + room.width - 1, y: room.y + room.height - 1 },
      ][random.int(0, 3)] ?? center(room);
    points.sort(
      (a, b) =>
        Math.abs(a.x - corner.x) +
        Math.abs(a.y - corner.y) -
        (Math.abs(b.x - corner.x) + Math.abs(b.y - corner.y)),
    );
    let cluster = corner;
    const place = (kind: Prop['kind'], blocking: boolean): boolean => {
      const candidates =
        purpose === 'Storeroom'
          ? [...points].sort(
              (a, b) =>
                Math.abs(a.x - cluster.x) +
                Math.abs(a.y - cluster.y) -
                (Math.abs(b.x - cluster.x) + Math.abs(b.y - cluster.y)),
            )
          : points;
      for (const point of candidates) {
        for (const rotation of kind === 'wooden_bed' ? ([0, 1] as const) : ([0] as const)) {
          const prop: Prop = {
            ...point,
            kind,
            blocking,
            variation: random.next(),
            ...(kind === 'wooden_bed' ? { footprint: { width: 2, height: 1 }, rotation } : {}),
          };
          const cells = propCells(prop),
            occupied = new Set(
              props
                .filter(
                  (p) =>
                    p.kind !== 'moss' &&
                    p.kind !== 'rug' &&
                    p.kind !== 'sconce' &&
                    p.kind !== 'vine',
                )
                .flatMap(propCells)
                .map((p) => indexOf(p.x, p.y)),
            );
          if (
            (blocking && used + cells.length > budget) ||
            cells.some(
              (cell) =>
                !contains(room, cell) ||
                !isFloor(layout, cell.x, cell.y) ||
                reserved.has(indexOf(cell.x, cell.y)) ||
                occupied.has(indexOf(cell.x, cell.y)),
            )
          )
            continue;
          // Beds follow a solid room wall; they never jut across a doorway.
          const bounds = propBounds(prop);
          if (
            kind === 'wooden_bed' &&
            !cells.every((cell) =>
              rotation === 0
                ? !isFloor(layout, cell.x, bounds.y - 1) ||
                  !isFloor(layout, cell.x, bounds.y + bounds.height)
                : !isFloor(layout, bounds.x - 1, cell.y) ||
                  !isFloor(layout, bounds.x + bounds.width, cell.y),
            )
          )
            continue;
          const proposed = [...props, prop];
          if (!isTraversable(layout, blockedCells(proposed))) continue;
          // Furniture replaces a wall accent at its occupied tile, rather than creating an overlap.
          props = proposed.filter(
            (other) =>
              !['sconce', 'vine'].includes(other.kind) ||
              !cells.some((cell) => cell.x === other.x && cell.y === other.y),
          );
          used += blocking ? cells.length : 0;
          cluster = point;
          return true;
        }
      }
      return false;
    };
    if (purpose === 'Barracks') {
      if (!place('wooden_bed', true) && !place('bedroll', false)) {
        props = previous;
        continue;
      }
      place('weapon_rack', true);
      if (used + 2 <= budget) place('wooden_bed', true);
    } else {
      if (!place('crate', true)) {
        props = previous;
        continue;
      }
      for (const kind of ['barrel', 'supply_sacks', 'crate', 'barrel'] as const) {
        if (used >= budget) break;
        place(kind, true);
      }
    }
    purposes.push({ roomId: room.id, purpose });
  }
  return { ...base, props, roomTheme: theme, roomPurposes: purposes };
}

/** Generated tags describe canonical room use; manual edits may subsequently change the furnishings. */
export function roomPurposeError(map: Dungeon): string | undefined {
  const { roomTheme = 'General rooms', roomPurposes } = map.decoration;
  if (roomTheme === 'General rooms')
    return roomPurposes !== undefined || map.decoration.props.some((p) => isRoomFurnishing(p.kind))
      ? 'Room furnishings require a room-use theme.'
      : undefined;
  if (!Array.isArray(roomPurposes) || roomPurposes.length > map.layout.rooms.length)
    return 'Room-use assignments are invalid.';
  const ids = new Set<number>();
  for (const assignment of roomPurposes) {
    const room = assignment && map.layout.rooms.find((r) => r.id === assignment.roomId);
    if (
      !room ||
      ids.has(room.id) ||
      !eligibleRoom(map.layout, map.decoration.props, room) ||
      !['Barracks', 'Storeroom'].includes(assignment.purpose) ||
      (roomTheme === 'Barracks' && assignment.purpose !== 'Barracks') ||
      (roomTheme === 'Storerooms' && assignment.purpose !== 'Storeroom')
    )
      return 'Room-use assignments are invalid.';
    ids.add(room.id);
    const props = map.decoration.props.filter((p) => contains(room, p));
    if (
      !props.some((p) =>
        assignment.purpose === 'Barracks'
          ? p.kind === 'wooden_bed' || p.kind === 'bedroll'
          : p.kind === 'crate' || p.kind === 'barrel' || p.kind === 'supply_sacks',
      )
    )
      return 'A furnished room is missing its defining objects.';
  }
  if (
    map.decoration.props.some(
      (p) =>
        isRoomFurnishing(p.kind) &&
        !roomPurposes.some((entry) => {
          const room = map.layout.rooms.find((r) => r.id === entry.roomId);
          return (
            room &&
            propCells(p).every((cell) => contains(room, cell)) &&
            (entry.purpose === 'Barracks' ? p.kind !== 'supply_sacks' : p.kind === 'supply_sacks')
          );
        }),
    )
  )
    return 'A furnishing is outside its assigned room.';
  return undefined;
}
