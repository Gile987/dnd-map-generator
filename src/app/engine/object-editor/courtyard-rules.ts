import { DENSITY_BUDGETS, WIDTH, indexOf, isTilePosition } from '../model';
import type { Prop } from '../model';
import { gridDistances } from '../grid-traversal';
import { areasOverlap } from '../feature-reservation';
import { propBounds, propCells } from '../prop-footprint';
import { courtyardInstances, currentCourtyardGroups } from './courtyard-document';
import type { CourtyardDocument, CourtyardGroupId } from './courtyard-document';
import { courtyardCapability, isCourtyardGroundCover } from './courtyard-catalog';
import type { ObjectSelection } from './object-selection';

export interface CourtyardSelection extends ObjectSelection {
  readonly groupId?: CourtyardGroupId;
}
export function courtyardObjectLock(
  map: CourtyardDocument,
  id: string,
  prop: Prop,
): string | undefined {
  if (currentCourtyardGroups(map).some((group) => group.members.includes(id)))
    return 'Select the complete addition.';
  const capability = courtyardCapability(prop.kind);
  return capability?.editable ? undefined : (capability?.reason ?? 'This object is protected.');
}
export function courtyardSelections(map: CourtyardDocument): readonly CourtyardSelection[] {
  const items = courtyardInstances(map),
    groups = currentCourtyardGroups(map);
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
        const lock = courtyardObjectLock(map, item.id, item.prop);
        return {
          id: item.id,
          label: courtyardCapability(item.prop.kind)?.label ?? item.prop.kind,
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

export function courtyardObjectsCollide(a: Prop, b: Prop): boolean {
  if (!areasOverlap(propBounds(a), propBounds(b))) return false;
  const coverA = isCourtyardGroundCover(a.kind),
    coverB = isCourtyardGroundCover(b.kind);
  return (!coverA && !coverB) || (coverA && coverB && a.kind === b.kind);
}

/** Manual placement uses actual objects, walls and reachability. Generator-only
 * gathering/approach reservations and empty group margins do not constrain edits.
 */
export function courtyardPlacementError(map: CourtyardDocument): string | undefined {
  const items = courtyardInstances(map);
  for (const item of items) {
    if (
      propCells(item.prop).some(
        (p) => !isTilePosition(p.x, p.y) || !map.layout.tiles[indexOf(p.x, p.y)],
      )
    )
      return 'Keep every object inside the map and off standing walls.';
    const obstruction = items.find(
      (other) => other.id !== item.id && courtyardObjectsCollide(item.prop, other.prop),
    );
    if (obstruction) {
      const a = propBounds(item.prop),
        b = propBounds(obstruction.prop);
      const label = (prop: Prop) => courtyardCapability(prop.kind)?.label ?? prop.kind;
      return `${label(item.prop)} overlaps ${label(obstruction.prop)} at column ${Math.max(a.x, b.x) + 1}, row ${Math.max(a.y, b.y) + 1}. Move one of the objects.`;
    }
  }
  const blocked = new Set(
    items
      .filter((item) => item.prop.blocking)
      .flatMap((item) => propCells(item.prop))
      .map((p) => indexOf(p.x, p.y)),
  );
  const open = map.layout.tiles.filter(Boolean).length;
  if (blocked.size > Math.floor(open * DENSITY_BUDGETS[map.decoration.density]))
    return 'The courtyard has reached its blocking limit. Remove a column or choose a passable object.';
  const firstFree = map.layout.tiles.findIndex((floor, tile) => floor && !blocked.has(tile));
  if (
    firstFree < 0 ||
    gridDistances(
      map.layout.tiles,
      { x: firstFree % WIDTH, y: Math.floor(firstFree / WIDTH) },
      blocked,
    ).size !==
      open - blocked.size
  )
    return 'Keep every open part of the courtyard reachable.';
  return undefined;
}
