import { DENSITY_BUDGETS, indexOf, isTilePosition } from '../model';
import type { Prop } from '../model';
import { gridDistances } from '../grid-traversal';
import { areasOverlap } from '../feature-reservation';
import { propBounds, propCells } from '../prop-footprint';
import { forestInstances, currentForestGroups } from './forest-document';
import type { ForestDocument } from './forest-document';
import { forestCapability, isForestGroundCover } from './forest-catalog';
import type { ObjectSelection } from './object-selection';

export function forestObjectLock(map: ForestDocument, id: string, prop: Prop): string | undefined {
  if (currentForestGroups(map).some((group) => group.members.includes(id)))
    return 'Select the complete addition.';
  const capability = forestCapability(prop.kind);
  return capability?.editable ? undefined : (capability?.reason ?? 'This object is protected.');
}
export function forestSelections(map: ForestDocument): readonly ObjectSelection[] {
  const items = forestInstances(map),
    groups = currentForestGroups(map);
  return [
    ...groups.map((group) => ({
      id: `group-${group.id}`,
      groupId: group.id,
      label: group.label,
      rotation: map.objectEdits?.groups.find((move) => move.id === group.id)?.rotation ?? 0,
      position: group.area,
      area: group.area,
      members: group.members,
      props: items.filter((item) => group.members.includes(item.id)).map((item) => item.prop),
      removable: false,
    })),
    ...items
      .filter((item) => !groups.some((group) => group.members.includes(item.id)))
      .map((item) => {
        const lock = forestObjectLock(map, item.id, item.prop);
        return {
          id: item.id,
          label: forestCapability(item.prop.kind)?.label ?? item.prop.kind,
          position: item.prop,
          area: propBounds(item.prop),
          members: [item.id],
          props: [item.prop],
          removable: !lock,
          lock,
        };
      }),
  ];
}
export function forestObjectsCollide(a: Prop, b: Prop): boolean {
  if (!areasOverlap(propBounds(a), propBounds(b))) return false;
  const coverA = isForestGroundCover(a.kind),
    coverB = isForestGroundCover(b.kind);
  return (!coverA && !coverB) || (coverA && coverB && a.kind === b.kind);
}
export function forestPlacementError(map: ForestDocument): string | undefined {
  const items = forestInstances(map);
  for (const item of items) {
    if (propCells(item.prop).some((p) => !isTilePosition(p.x, p.y)))
      return 'Keep every object inside the map.';
    if (item.prop.kind === 'tree') continue;
    if (
      !isForestGroundCover(item.prop.kind) &&
      propCells(item.prop).some((p) => !map.layout.tiles[indexOf(p.x, p.y)])
    )
      return 'Place solid objects on the walkable clearing or path, outside the fixed forest boundary.';
    const obstruction = items.find(
      (other) => other.id !== item.id && forestObjectsCollide(item.prop, other.prop),
    );
    if (obstruction) {
      const a = propBounds(item.prop),
        b = propBounds(obstruction.prop),
        label = (prop: Prop) => forestCapability(prop.kind)?.label ?? prop.kind;
      return `${label(item.prop)} overlaps ${label(obstruction.prop)} at column ${Math.max(a.x, b.x) + 1}, row ${Math.max(a.y, b.y) + 1}. Move one of the objects.`;
    }
  }
  const blocked = new Set(
    items
      .filter((item) => item.prop.blocking)
      .flatMap((item) => propCells(item.prop))
      .map((p) => indexOf(p.x, p.y)),
  );
  const start = indexOf(map.layout.pathStart.x, map.layout.pathStart.y),
    end = indexOf(map.layout.pathEnd.x, map.layout.pathEnd.y);
  if (blocked.has(start) || blocked.has(end)) return 'Keep both map-edge path entrances open.';
  const open = map.layout.tiles.filter(Boolean).length;
  if (blocked.size > Math.floor(open * DENSITY_BUDGETS[map.decoration.density]))
    return 'The clearing has reached its blocking limit. Remove a solid object or choose ground cover.';
  const reached = gridDistances(map.layout.tiles, map.layout.pathStart, blocked);
  if (!reached.has(end) || reached.size !== open - blocked.size)
    return 'Keep both path entrances connected and every open part of the clearing reachable.';
  return undefined;
}
