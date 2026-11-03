import { transformedGroup } from './group-rotation';
import { authoredObjectArea } from './object-geometry';
import { DENSITY_BUDGETS, indexOf, isFloor, isTilePosition } from '../model';
import type { Dungeon, Prop } from '../model';
import { areaAround, areasOverlap } from '../feature-reservation';
import { propBounds, propCells } from '../prop-footprint';
import { isTraversable } from '../dungeon-space';
import { dungeonCapability } from './catalog';
import { dungeonGroups, translatedGroup } from './dungeon-groups';
import type { DungeonGroup } from './dungeon-groups';
import type { DungeonDocument } from './document';

/** Authored v2 protects architecture itself, not the generator's corridor sampling buffer. */
export function dungeonArchitectureCells(base: Dungeon): ReadonlySet<number> {
  const cells = new Set<number>();
  for (const marker of [base.layout.entrance, base.layout.objective]) {
    const area = areaAround(marker, 1, 1);
    for (let y = area.y; y < area.y + area.height; y++)
      for (let x = area.x; x < area.x + area.width; x++) cells.add(indexOf(x, y));
  }
  for (const door of base.layout.thresholds)
    for (let i = 0; i < door.span; i++) {
      const x = door.x + (door.axis === 'horizontal' ? i : 0),
        y = door.y + (door.axis === 'vertical' ? i : 0);
      cells.add(indexOf(x, y));
      cells.add(
        indexOf(x - (door.axis === 'vertical' ? 1 : 0), y - (door.axis === 'horizontal' ? 1 : 0)),
      );
    }
  return cells;
}

export function individualObjectLock(base: Dungeon, id: string, prop: Prop): string | undefined {
  const group = dungeonGroups(base).find((g) => g.members.includes(id));
  if (group) return `Move ${group.label} as a complete addition.`;
  const capability = dungeonCapability(prop.kind, 2);
  return capability?.editable ? undefined : (capability?.reason ?? 'This object is protected.');
}

export function currentDungeonGroups(
  base: Dungeon,
  document: DungeonDocument,
): readonly DungeonGroup[] {
  const moves =
    document.objectEdits && document.objectEdits.version !== 1 ? document.objectEdits.groups : [];
  return dungeonGroups(base).map((group) =>
    (document.objectEdits?.version === 4 || document.objectEdits?.version === 5
      ? transformedGroup
      : translatedGroup)(
      group,
      moves.find((move) => move.id === group.id),
    ),
  );
}

/** All sources already passed their frozen base contract. Revalidate actual authored geometry together. */
export function authoredDungeonError(
  base: Dungeon,
  document: DungeonDocument,
  items: readonly { readonly id: string; readonly prop: Prop }[],
): string | undefined {
  const edits = document.objectEdits;
  if (!edits) return undefined;
  const groups = currentDungeonGroups(base, document),
    movedGroups = edits.version === 2 ? edits.groups : [];
  const movedIds = new Set(edits.moves.map((move) => move.id));
  const architecture = dungeonArchitectureCells(base);
  const targets = items.filter((item) => movedIds.has(item.id) || item.id.startsWith('added-'));
  for (const target of targets) {
    const p = target.prop,
      bounds = authoredObjectArea(p);
    if (!isTilePosition(p.x, p.y)) return 'Place the object inside the map.';
    for (let y = bounds.y; y < bounds.y + bounds.height; y++)
      for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
        if (!isTilePosition(x, y) || !isFloor(base.layout, x, y))
          return 'An object cannot overlap solid walls.';
        if (architecture.has(indexOf(x, y)))
          return 'Keep the doorway, entrance stairs and objective clear.';
      }
    if (p.blocking && groups.some((group) => areasOverlap(group.area, bounds)))
      return 'Keep the addition and its circulation space clear.';
    if (
      items.some(
        (other) => other.id !== target.id && areasOverlap(authoredObjectArea(other.prop), bounds),
      )
    )
      return 'That square already contains an object or rug.';
  }
  for (const move of movedGroups) {
    const group = groups.find((g) => g.id === move.id);
    if (!group) return 'That addition is not on this map.';
    const area = group.area;
    for (let y = area.y; y < area.y + area.height; y++)
      for (let x = area.x; x < area.x + area.width; x++) {
        if (!isTilePosition(x, y) || !isFloor(base.layout, x, y))
          return 'The complete addition must stay on floor, outside walls.';
      }
    const members = items.filter((item) => group.members.includes(item.id));
    if (
      members.some((item) => {
        const bounds = authoredObjectArea(item.prop);
        for (let y = bounds.y; y < bounds.y + bounds.height; y++)
          for (let x = bounds.x; x < bounds.x + bounds.width; x++)
            if (architecture.has(indexOf(x, y))) return true;
        return false;
      })
    )
      return 'Keep the addition’s objects clear of doors, entrance and objective.';
    if (
      groups.some(
        (other) =>
          other.id !== group.id &&
          members.some(
            (item) => item.prop.blocking && areasOverlap(propBounds(item.prop), other.area),
          ),
      )
    )
      return 'The addition would block another addition’s circulation space.';
    if (
      items.some((item) => {
        if (group.members.includes(item.id)) return false;
        const otherBounds =
          item.prop.kind === 'rug' ? areaAround(item.prop, 1, 1) : propBounds(item.prop);
        if (item.prop.blocking && areasOverlap(area, otherBounds)) return true;
        return items.some(
          (member) =>
            group.members.includes(member.id) &&
            areasOverlap(authoredObjectArea(member.prop), otherBounds),
        );
      })
    )
      return 'The addition needs clear space; move other objects first.';
  }
  const blocked = new Set(
    items
      .filter(({ prop }) => prop.blocking)
      .flatMap(({ prop }) => propCells(prop))
      .map((p) => indexOf(p.x, p.y)),
  );
  if (
    blocked.size >
    Math.floor(base.layout.tiles.filter(Boolean).length * DENSITY_BUDGETS[base.decoration.density])
  )
    return 'This dungeon has reached its blocking limit. Remove an object or choose a passable item.';
  if (!isTraversable(base.layout, blocked))
    return 'Keep every floor area reachable and a clear 2 × 2 space in each room.';
  return undefined;
}
