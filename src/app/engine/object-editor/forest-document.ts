import { CAMP_PROP_KINDS } from '../forest-camp';
import { FALLEN_TREE_PROP_KINDS } from '../model';
import type { ForestClearing, Prop, QuarterTurn, TileArea } from '../model';
import { propBounds } from '../prop-footprint';
import type { AddedObject } from './document';
import type { ObjectGroup } from './object-group';
import type { ArrangementEdits, AuthoredArrangement } from './arrangement';
import { arrangementInstances, arrangementArtTurns } from './arrangement';
import { transformedGroup } from './group-rotation';
import { orderedObjects } from './drawing-order';
import { forestDrawsBelowObjects, isForestGroundCover } from './forest-catalog';

export type ForestGroupId = 'camp' | 'stone-circle' | 'fallen-tree';
export type ForestEditsV1 = ArrangementEdits<ForestGroupId>;
export type AuthoredForest = AuthoredArrangement<ForestClearing, ForestGroupId>;
export type ForestDocument = ForestClearing | AuthoredForest;
export interface ResolvedForest extends Omit<ForestClearing, 'objectEdits'> {
  readonly objectEdits: 'resolved';
  readonly instances: readonly AddedObject[];
  readonly order: readonly string[];
  readonly artTurns: ReadonlyMap<Prop, QuarterTurn>;
  readonly campTurn: QuarterTurn;
  readonly campArea?: TileArea;
}
export type ForestDrawing = ForestClearing | ResolvedForest;
export function forestBase(map: ForestDocument): ForestClearing {
  if (!map.objectEdits) return map;
  const { objectEdits: _edits, ...base } = map;
  return base;
}
export function forestGroups(base: ForestClearing): readonly ObjectGroup<ForestGroupId>[] {
  const items = base.decoration.props.map((prop, i) => ({ id: `base-${i}`, prop }));
  const definitions: readonly {
    id: ForestGroupId;
    label: string;
    includes: (prop: Prop) => boolean;
  }[] = [
    {
      id: 'camp',
      label: 'Abandoned camp',
      includes: (prop) => CAMP_PROP_KINDS.includes(prop.kind),
    },
    {
      id: 'stone-circle',
      label: 'Standing-stone circle',
      includes: (prop) => prop.kind === 'standing_stone',
    },
    {
      id: 'fallen-tree',
      label: 'Fallen ancient tree',
      includes: (prop) => FALLEN_TREE_PROP_KINDS.some((kind) => kind === prop.kind),
    },
  ];
  return definitions.flatMap((definition) => {
    const members = items.filter((item) => definition.includes(item.prop));
    if (!members.length) return [];
    const bounds = members.map((item) => propBounds(item.prop)),
      x = Math.min(...bounds.map((b) => b.x)),
      y = Math.min(...bounds.map((b) => b.y));
    return [
      {
        id: definition.id,
        label: definition.label,
        members: members.map((item) => item.id),
        area: {
          x,
          y,
          width: Math.max(...bounds.map((b) => b.x + b.width)) - x,
          height: Math.max(...bounds.map((b) => b.y + b.height)) - y,
        },
      },
    ];
  });
}
export function currentForestGroups(map: ForestDocument): readonly ObjectGroup<ForestGroupId>[] {
  return forestGroups(forestBase(map)).map((group) =>
    transformedGroup(
      group,
      map.objectEdits?.groups.find((move) => move.id === group.id),
    ),
  );
}
export function forestInstances(map: ForestDocument): readonly AddedObject[] {
  return arrangementInstances(map.decoration.props, map.objectEdits, forestGroups(forestBase(map)));
}
export function orderedForestObjects(
  map: ForestDocument,
  items = forestInstances(map),
): readonly AddedObject[] {
  const surfaces = items.filter(
      (item) => item.id.startsWith('added-') && isForestGroundCover(item.prop.kind),
    ),
    surfaceIds = new Set(surfaces.map((item) => item.id));
  const defaults = [
    ...surfaces,
    ...items.filter((item) => forestDrawsBelowObjects(item.prop.kind) && !surfaceIds.has(item.id)),
    ...items.filter((item) => !forestDrawsBelowObjects(item.prop.kind)),
  ];
  return orderedObjects(defaults, map.objectEdits?.order ?? []);
}
export function resolveForest(map: ForestDocument): ForestDrawing {
  if (!map.objectEdits) return map;
  const items = forestInstances(map),
    groups = forestGroups(forestBase(map)),
    camp = currentForestGroups(map).find((group) => group.id === 'camp');
  return {
    ...forestBase(map),
    objectEdits: 'resolved',
    instances: items,
    order: orderedForestObjects(map, items).map((item) => item.id),
    artTurns: arrangementArtTurns(items, groups, map.objectEdits),
    campTurn: map.objectEdits.groups.find((move) => move.id === 'camp')?.rotation ?? 0,
    ...(camp
      ? {
          campArea: {
            x: camp.area.x - 1,
            y: camp.area.y - 1,
            width: camp.area.width + 2,
            height: camp.area.height + 2,
          },
        }
      : {}),
    decoration: { ...map.decoration, props: items.map((item) => item.prop) },
  };
}
