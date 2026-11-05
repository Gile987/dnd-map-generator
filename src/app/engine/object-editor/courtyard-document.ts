import { isCourtyardSurface } from './courtyard-catalog';
import { orderedObjects } from './drawing-order';
import { WAGON_PROP_KINDS } from '../model';
import type { RuinedCourtyard, Prop, QuarterTurn } from '../model';
import { propBounds } from '../prop-footprint';
import { transformedGroup, transformedGroupProp } from './group-rotation';
import type { ObjectGroup, ObjectGroupTransform } from './object-group';
import type { AddedObject, ObjectMove } from './document';

export const COURTYARD_GROUP_IDS = ['fountain', 'wagon'] as const;
export type CourtyardGroupId = (typeof COURTYARD_GROUP_IDS)[number];
export interface CourtyardEditsV1 {
  readonly version: 1;
  readonly nextId: number;
  readonly moves: readonly ObjectMove[];
  readonly removed: readonly string[];
  readonly added: readonly AddedObject[];
  readonly groups: readonly ObjectGroupTransform<CourtyardGroupId>[];
  readonly order: readonly string[];
}
export interface AuthoredCourtyard extends Omit<RuinedCourtyard, 'objectEdits'> {
  readonly objectEdits: CourtyardEditsV1;
}
export type CourtyardDocument = RuinedCourtyard | AuthoredCourtyard;
export interface ResolvedCourtyard extends Omit<RuinedCourtyard, 'objectEdits'> {
  readonly objectEdits: 'resolved';
  readonly instances: readonly AddedObject[];
  readonly order: readonly string[];
  readonly artTurns: ReadonlyMap<Prop, QuarterTurn>;
}
export type CourtyardDrawing = RuinedCourtyard | ResolvedCourtyard;

export function courtyardBase(map: CourtyardDocument): RuinedCourtyard {
  if (!map.objectEdits) return map;
  const { objectEdits: _edits, ...base } = map;
  return base;
}
export function courtyardGroups(base: RuinedCourtyard): readonly ObjectGroup<CourtyardGroupId>[] {
  const items = base.decoration.props.map((prop, i) => ({ id: `base-${i}`, prop }));
  const groups: ObjectGroup<CourtyardGroupId>[] = [];
  const fountain = items.find((item) => item.prop.kind === 'dry_fountain');
  if (fountain)
    groups.push({
      id: 'fountain',
      label: 'Dry fountain',
      members: [fountain.id],
      area: { x: fountain.prop.x - 1, y: fountain.prop.y - 1, width: 5, height: 5 },
    });
  const wagon = items.filter((item) => WAGON_PROP_KINDS.some((kind) => kind === item.prop.kind));
  if (wagon.length) {
    const bounds = wagon.map((item) => propBounds(item.prop));
    const x = Math.min(...bounds.map((b) => b.x)),
      y = Math.min(...bounds.map((b) => b.y));
    groups.push({
      id: 'wagon',
      label: 'Collapsed wagon',
      members: wagon.map((item) => item.id),
      area: {
        x,
        y,
        width: Math.max(...bounds.map((b) => b.x + b.width)) - x,
        height: Math.max(...bounds.map((b) => b.y + b.height)) - y,
      },
    });
  }
  return groups;
}
export function currentCourtyardGroups(
  map: CourtyardDocument,
): readonly ObjectGroup<CourtyardGroupId>[] {
  return courtyardGroups(courtyardBase(map)).map((group) =>
    transformedGroup(
      group,
      map.objectEdits?.groups.find((move) => move.id === group.id),
    ),
  );
}
export function courtyardInstances(map: CourtyardDocument): readonly AddedObject[] {
  const groups = courtyardGroups(courtyardBase(map));
  const removed = new Set(map.objectEdits?.removed);
  const moves = new Map(map.objectEdits?.moves.map((move) => [move.id, move]));
  return [
    ...map.decoration.props.map((prop, i) => {
      const id = `base-${i}`,
        move = moves.get(id);
      const group = groups.find((group) => group.members.includes(id));
      const transform = group && map.objectEdits?.groups.find((move) => move.id === group.id);
      return {
        id,
        prop:
          group && transform
            ? transformedGroupProp(prop, group, transform)
            : move
              ? { ...prop, x: move.x, y: move.y }
              : prop,
      };
    }),
    ...(map.objectEdits?.added ?? []),
  ].filter((item) => !removed.has(item.id));
}
export function resolveCourtyard(map: CourtyardDocument): CourtyardDrawing {
  if (!map.objectEdits) return map;
  const items = courtyardInstances(map),
    groups = courtyardGroups(courtyardBase(map));
  const artTurns = new Map<Prop, QuarterTurn>();
  for (const move of map.objectEdits.groups) {
    const group = groups.find((group) => group.id === move.id);
    for (const item of items)
      if (group?.members.includes(item.id) && !item.prop.footprint)
        artTurns.set(item.prop, move.rotation);
  }
  return {
    ...courtyardBase(map),
    objectEdits: 'resolved',
    instances: items,
    order: orderedCourtyardObjects(map, items).map((item) => item.id),
    artTurns,
    decoration: { ...map.decoration, props: items.map((item) => item.prop) },
  };
}

/** Keep generated drawing order. New surfaces start beneath original passable
 * objects as well as blockers; existing/moved objects retain their priority.
 */
export function orderedCourtyardObjects(
  map: CourtyardDocument,
  items: readonly AddedObject[] = courtyardInstances(map),
) {
  const surfaces = items.filter(
    (item) => item.id.startsWith('added-') && isCourtyardSurface(item.prop.kind),
  );
  const surfaceIds = new Set(surfaces.map((item) => item.id));
  const defaults = [
    ...surfaces,
    ...items.filter((item) => !item.prop.blocking && !surfaceIds.has(item.id)),
    ...items.filter((item) => item.prop.blocking),
  ];
  return orderedObjects(defaults, map.objectEdits?.order ?? []);
}
