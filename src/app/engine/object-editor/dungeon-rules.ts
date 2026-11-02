import { WIDTH, contains, indexOf, isFloor, isTilePosition, DENSITY_BUDGETS } from '../model';
import type { Dungeon, Prop } from '../model';
import { areaAround, areaContains } from '../feature-reservation';
import { studyReservations } from '../dungeon-study';
import { statueReservations } from '../dungeon-landmark';
import { furnitureArea } from '../dungeon-furniture';
import { ritualCenter } from '../dungeon-ritual';
import { reservedTiles, isTraversable } from '../dungeon-space';
import { propCells } from '../prop-footprint';
import { dungeonCapability } from './catalog';

export function dungeonEditReservations(base: Dungeon) {
  return [
    ...studyReservations(base.layout, base.decoration.props).map((r) => r.area),
    ...statueReservations(base.decoration.props).map((r) => r.area),
    ...base.decoration.props.filter((p) => p.kind === 'dining_table').map(furnitureArea),
    ...base.decoration.props
      .filter((p) => p.kind === 'ritual_altar')
      .map((p) => areaAround(ritualCenter(p), 2, 2)),
  ];
}

export function dungeonObjectLock(base: Dungeon, prop: Prop): string | undefined {
  const capability = dungeonCapability(prop.kind);
  if (!capability?.editable) return capability?.reason ?? 'This object is protected.';
  if (
    dungeonEditReservations(base).some((area) => propCells(prop).some((p) => areaContains(area, p)))
  )
    return 'This object belongs to protected addition space.';
  return undefined;
}

/** Checks only authored targets; untouched legacy placements/overlaps retain their contract. */
export function dungeonTargetsError(
  base: Dungeon,
  targets: readonly Prop[],
  all: readonly Prop[],
): string | undefined {
  const reserved = reservedTiles(base.layout),
    areas = dungeonEditReservations(base);
  for (const prop of targets) {
    if (dungeonObjectLock(base, prop)) return dungeonObjectLock(base, prop);
    if (!isTilePosition(prop.x, prop.y)) return 'Place the object inside the map.';
    if (!base.layout.rooms.some((room) => contains(room, prop)))
      return 'Place the object inside a room.';
    // Conservative exposed-floor margin: eligible artwork and shadows stay away from wall strokes.
    if (
      [-1, 0, 1].some((dy) =>
        [-1, 0, 1].some((dx) => !isFloor(base.layout, prop.x + dx, prop.y + dy)),
      )
    )
      return 'Leave one square between the object and solid walls.';
    if (reserved.has(indexOf(prop.x, prop.y)))
      return 'Keep doors, passages, entrance and objective clear.';
    if (areas.some((area) => areaContains(area, prop)))
      return 'Keep addition space and circulation clear.';
    if (
      base.decoration.props.some((p) => p.kind === 'rug' && areaContains(areaAround(p, 1, 1), prop))
    )
      return 'Leave room for the rug’s full artwork.';
    if (
      all.some(
        (other) => other !== prop && propCells(other).some((p) => p.x === prop.x && p.y === prop.y),
      )
    )
      return 'That square already contains an object.';
  }
  const blocked = new Set(
    all
      .filter((p) => p.blocking)
      .flatMap(propCells)
      .map((p) => indexOf(p.x, p.y)),
  );
  for (const room of base.layout.rooms) {
    const count = [...blocked].filter((i) =>
      contains(room, { x: i % WIDTH, y: Math.floor(i / WIDTH) }),
    ).length;
    if (count > Math.floor(room.width * room.height * DENSITY_BUDGETS[base.decoration.density]))
      return 'This room has reached its blocking limit. Remove an object or choose a passable item.';
  }
  if (!isTraversable(base.layout, blocked))
    return 'Keep every floor area reachable and a clear 2 × 2 space in each room.';
  return undefined;
}
