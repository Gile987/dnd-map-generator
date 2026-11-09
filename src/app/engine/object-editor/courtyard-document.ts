import { isCourtyardSurface } from './courtyard-catalog';
import { orderedObjects } from './drawing-order';
import { WAGON_PROP_KINDS } from '../model';
import type { RuinedCourtyard, Prop, QuarterTurn } from '../model';
import { propBounds } from '../prop-footprint';
import { transformedGroup } from './group-rotation';
import type { ObjectGroup } from './object-group';
import type { AddedObject } from './document';
import { arrangementInstances, arrangementArtTurns } from './arrangement';
import type { ArrangementEdits } from './arrangement';

export const COURTYARD_GROUP_IDS = ['fountain', 'wagon', 'well'] as const;
export type CourtyardGroupId = (typeof COURTYARD_GROUP_IDS)[number];
export type CourtyardEditsV1 = ArrangementEdits<CourtyardGroupId>;
export type CourtyardEditsV2 = Omit<CourtyardEditsV1, 'version'> & { readonly version: 2 };
export interface AuthoredCourtyard extends Omit<RuinedCourtyard, 'objectEdits'> {
  readonly objectEdits: CourtyardEditsV1 | CourtyardEditsV2;
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
  const well = items.find((item) => item.prop.kind === 'stone_well');
  if (well)
    groups.push({
      id: 'well',
      label: 'Stone well',
      members: [well.id],
      area: { x: well.prop.x - 1, y: well.prop.y - 1, width: 4, height: 4 },
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
  return arrangementInstances(
    map.decoration.props,
    map.objectEdits && { ...map.objectEdits, version: 1 as const },
    courtyardGroups(courtyardBase(map)),
  );
}
export function resolveCourtyard(map: CourtyardDocument): CourtyardDrawing {
  if (!map.objectEdits) return map;
  const items = courtyardInstances(map),
    groups = courtyardGroups(courtyardBase(map));
  const artTurns = arrangementArtTurns(items, groups, {
    ...map.objectEdits,
    version: 1 as const,
  });
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
