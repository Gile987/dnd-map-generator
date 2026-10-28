import { propCells, propFootprintError } from './prop-footprint';
import { ritualError } from './dungeon-ritual';
import { furnitureArea, furnitureError } from './dungeon-furniture';
import { DUNGEON_LANDMARK_RULES, statueReservations } from './dungeon-landmark';
import { studyReservations } from './dungeon-study';
import {
  ALL_DENSITIES,
  ALL_DUNGEON_SCENES,
  ALL_DUNGEON_FURNITURE,
  ALL_DUNGEON_LANDMARKS,
  ALL_PRESETS,
  DENSITY_BUDGETS,
  HEIGHT,
  ROOM_MAX,
  ROOM_MIN,
  WIDTH,
  contains,
  indexOf,
  isBlockingProp,
  isDungeonPropKind,
  isTilePosition,
  isFloor,
} from './model';
import type { Dungeon, DungeonSettings, Layout } from './model';
import { reservedTiles, isTraversable } from './dungeon-space';
export { reservedTiles, isTraversable, hasClearSquare } from './dungeon-space';
import { isDetailRevision } from './decoration-revision';

export function validateSettings(settings: DungeonSettings): string | undefined {
  if (!settings.seed.trim() || settings.seed.trim().length > 64)
    return 'Enter a seed between 1 and 64 characters.';
  if (
    !Number.isInteger(settings.roomCount) ||
    settings.roomCount < ROOM_MIN ||
    settings.roomCount > ROOM_MAX
  )
    return `Choose a whole number of rooms from ${ROOM_MIN} to ${ROOM_MAX}.`;
  if (settings.ritual !== undefined && typeof settings.ritual !== 'boolean')
    return 'Choose a valid ritual site option.';
  if (!ALL_DUNGEON_LANDMARKS.includes(settings.landmark ?? 'None'))
    return 'Choose a valid dungeon landmark.';
  if (!ALL_DUNGEON_FURNITURE.includes(settings.furniture ?? 'None'))
    return 'Choose valid dungeon furniture.';
  if (!ALL_DENSITIES.includes(settings.density)) return 'Choose a valid decoration density.';
  if (!ALL_PRESETS.includes(settings.preset)) return 'Choose a valid decoration preset.';
  if (!ALL_DUNGEON_SCENES.includes(settings.scene ?? 'None'))
    return 'Choose a valid dungeon scene.';
  return undefined;
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
  if (!ALL_DUNGEON_SCENES.includes(map.decoration.scene ?? 'None'))
    return 'Choose a valid dungeon scene.';
  if (
    map.decoration.studySurface !== undefined &&
    (map.decoration.studySurface !== 1 || map.decoration.scene !== 'Forgotten study')
  )
    return 'Choose supported study surface artwork for a Forgotten study.';
  if (map.decoration.ritual !== undefined && typeof map.decoration.ritual !== 'boolean')
    return 'Choose a valid ritual site option.';
  if (map.decoration.ritual) {
    const error = ritualError(map.layout, map.decoration.props, [
      ...studyReservations(map.layout, map.decoration.props),
      ...statueReservations(map.decoration.props),
      ...map.decoration.props
        .filter((p) => p.kind === 'dining_table')
        .map((p) => ({ area: furnitureArea(p), props: [p] })),
    ]);
    if (error) return error;
  } else if (map.decoration.props.some((p) => p.kind.startsWith('ritual_')))
    return 'Ritual objects require the ritual site option.';
  for (const prop of map.decoration.props) {
    const error = propFootprintError(prop);
    if (error) return error;
  }
  if (!ALL_DUNGEON_FURNITURE.includes(map.decoration.furniture ?? 'None'))
    return 'Choose valid dungeon furniture.';
  if (map.decoration.furniture === 'dining-table') {
    const error = furnitureError(map.layout, map.decoration.props, [
      ...studyReservations(map.layout, map.decoration.props),
      ...statueReservations(map.decoration.props),
    ]);
    if (error) return error;
  } else if (map.decoration.props.some((p) => p.kind === 'dining_table'))
    return 'A dining table requires the furniture option.';
  const landmark = map.decoration.landmark ?? 'None';
  if (!ALL_DUNGEON_LANDMARKS.includes(landmark)) return 'Choose a valid dungeon landmark.';
  if (landmark !== 'None') {
    const error = DUNGEON_LANDMARK_RULES[landmark].validate(
      map.layout,
      map.decoration.props,
      studyReservations(map.layout, map.decoration.props),
    );
    if (error) return error;
  } else if (map.decoration.props.some((p) => p.kind === 'weathered_statue'))
    return 'A weathered statue requires a dungeon landmark.';
  const study = map.decoration.props.filter(
    (p) => p.kind === 'desk' || p.kind === 'bookshelf' || p.kind === 'scroll_case',
  );
  if (map.decoration.scene === 'Forgotten study') {
    if (study.length !== 3 || new Set(study.map((p) => p.kind)).size !== 3)
      return 'A complete study could not fit. Try another seed or decoration density.';
    const desk = study.find((p) => p.kind === 'desk');
    const room = desk && map.layout.rooms.find((room) => contains(room, desk));
    const reserved = reservedTiles(map.layout);
    if (
      !room ||
      !map.decoration.props.some((p) => p.kind === 'rug' && contains(room, p)) ||
      study.some(
        (p) =>
          !contains(room, p) ||
          reserved.has(indexOf(p.x, p.y)) ||
          map.decoration.props.some((other) => other !== p && other.x === p.x && other.y === p.y),
      )
    )
      return 'Study objects need a clear room away from doors and landmarks.';
  } else if (study.length) return 'Study objects require a Forgotten study scene.';
  if (!isDetailRevision(map.decoration.revision))
    return 'The detail revision must be a nonnegative safe integer.';
  const reserved = reservedTiles(map.layout);
  const blocked = new Set<number>();
  for (const prop of map.decoration.props) {
    if (!isTilePosition(prop.x, prop.y)) return 'A prop is outside the tile grid.';
    if (!isDungeonPropKind(prop.kind)) return 'A prop is not supported by dungeon maps.';
    const cells = propCells(prop);
    if (
      cells.some((cell) => !isTilePosition(cell.x, cell.y) || !isFloor(map.layout, cell.x, cell.y))
    )
      return 'A prop footprint is outside the floor.';
    if (prop.blocking !== isBlockingProp(prop.kind))
      return 'A prop has an invalid movement classification.';
    if (!prop.blocking) continue;
    const room = map.layout.rooms.find((room) => cells.every((cell) => contains(room, cell)));
    if (!room) return 'A blocking prop footprint is outside a room.';
    for (const cell of cells) {
      const tile = indexOf(cell.x, cell.y);
      if (reserved.has(tile) || blocked.has(tile))
        return 'A blocking prop overlaps reserved space or another prop.';
      blocked.add(tile);
    }
  }
  for (const room of map.layout.rooms) {
    const count = map.decoration.props
      .filter((prop) => prop.blocking && contains(room, prop))
      .flatMap(propCells).length;
    if (count > Math.floor(room.width * room.height * DENSITY_BUDGETS[map.decoration.density]))
      return 'Dungeon decoration exceeds a room blocking budget.';
  }
  if (!isTraversable(map.layout, blocked)) return 'Decoration blocks access through the dungeon.';
  return undefined;
}
