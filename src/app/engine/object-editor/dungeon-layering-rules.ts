import { DENSITY_BUDGETS, indexOf, isFloor, isTilePosition } from '../model';
import type { Dungeon } from '../model';
import { propCells } from '../prop-footprint';
import { isTraversable } from '../dungeon-space';
import { currentDungeonGroups, dungeonArchitectureCells } from './dungeon-authoring-rules';
import { authoredObjectArea } from './object-geometry';
import { dungeonObjectsCollide } from './dungeon-occupancy';
import type { AddedObject, DungeonDocument } from './document';

/** Authored v3 allows floor layering and usable additions, rather than reserving
 * every empty square from their generation-time arrangements.
 */
export function layeredDungeonError(
  base: Dungeon,
  document: DungeonDocument,
  items: readonly AddedObject[],
): string | undefined {
  const edits = document.objectEdits;
  if (edits?.version !== 3 && edits?.version !== 4 && edits?.version !== 5) return undefined;
  const groups = currentDungeonGroups(base, document),
    architecture = dungeonArchitectureCells(base);
  const changed = new Set(edits.moves.map((move) => move.id));
  for (const group of groups) {
    if (!edits.groups.some((move) => move.id === group.id)) continue;
    for (const id of group.members) changed.add(id);
    for (let y = group.area.y; y < group.area.y + group.area.height; y++)
      for (let x = group.area.x; x < group.area.x + group.area.width; x++)
        if (!isTilePosition(x, y) || !isFloor(base.layout, x, y))
          return 'The complete addition must stay on floor, outside walls.';
  }
  for (const item of items) {
    if (!changed.has(item.id) && !item.id.startsWith('added-')) continue;
    const area = authoredObjectArea(item.prop);
    for (let y = area.y; y < area.y + area.height; y++)
      for (let x = area.x; x < area.x + area.width; x++) {
        if (!isTilePosition(x, y) || !isFloor(base.layout, x, y))
          return 'An object cannot overlap solid walls.';
        if (architecture.has(indexOf(x, y)))
          return 'Keep the doorway, entrance stairs and objective clear.';
      }
    if (items.some((other) => other.id !== item.id && dungeonObjectsCollide(item.prop, other.prop)))
      return 'Those objects cannot overlap. Rugs and moss can go beneath objects.';
  }
  const blocked = new Set(
    items
      .filter((item) => item.prop.blocking)
      .flatMap((item) => propCells(item.prop))
      .map((point) => indexOf(point.x, point.y)),
  );
  if (
    blocked.size >
    Math.floor(base.layout.tiles.filter(Boolean).length * DENSITY_BUDGETS[base.decoration.density])
  )
    return 'This dungeon has reached its blocking limit. Remove an object or choose a passable item.';
  if (!isTraversable(base.layout, blocked))
    return 'Keep every floor area reachable and a clear 2 × 2 space in each room.';
  for (const group of groups)
    for (const item of items.filter(
      (item) => group.members.includes(item.id) && item.prop.blocking,
    )) {
      const accessible = propCells(item.prop).some((cell) =>
        (
          [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ] as const
        ).some(([dx, dy]) => {
          const x = cell.x + dx,
            y = cell.y + dy;
          return isFloor(base.layout, x, y) && !blocked.has(indexOf(x, y));
        }),
      );
      if (!accessible) return 'Keep a usable approach to each addition’s solid objects.';
    }
  return undefined;
}
