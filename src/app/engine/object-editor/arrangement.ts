import type { Prop, PropKind, QuarterTurn } from '../model';
import type { ObjectCapability } from './catalog';
import type { ObjectMove, AddedObject } from './document';
import type { ObjectGroup, ObjectGroupTransform } from './object-group';
import type { ObjectSelection } from './object-selection';
import { transformedGroupProp } from './group-rotation';

/** Shared sidecar shape for new map adapters. Historical Dungeon versions keep
 * their independent schemas and semantics. */
export interface ArrangementEdits<Id extends string> {
  readonly version: 1;
  readonly nextId: number;
  readonly moves: readonly ObjectMove[];
  readonly removed: readonly string[];
  readonly added: readonly AddedObject[];
  readonly groups: readonly ObjectGroupTransform<Id>[];
  readonly order: readonly string[];
}
export interface ArrangementBase {
  readonly objectEdits?: never;
  readonly decoration: { readonly props: readonly Prop[] };
}
export type AuthoredArrangement<Base, Id extends string> = Omit<Base, 'objectEdits'> & {
  readonly objectEdits: ArrangementEdits<Id>;
};
export type ArrangementDocument<Base, Id extends string> = Base | AuthoredArrangement<Base, Id>;
export interface ArrangementAdapter<Base extends ArrangementBase, Id extends string> {
  readonly base: (map: ArrangementDocument<Base, Id>) => Base;
  readonly groups: (base: Base) => readonly ObjectGroup<Id>[];
  readonly instances: (map: ArrangementDocument<Base, Id>) => readonly AddedObject[];
  readonly ordered: (map: ArrangementDocument<Base, Id>) => readonly AddedObject[];
  readonly selections: (map: ArrangementDocument<Base, Id>) => readonly ObjectSelection[];
  readonly lock: (map: ArrangementDocument<Base, Id>, id: string, prop: Prop) => string | undefined;
  readonly capability: (kind: PropKind) => ObjectCapability | undefined;
  readonly surface: (kind: PropKind) => boolean;
  readonly rotatable: (id: Id) => boolean;
  readonly placementError: (map: ArrangementDocument<Base, Id>) => string | undefined;
  readonly unsupportedObject: string;
  readonly unsupportedRotation: string;
}
export function arrangementInstances<Id extends string>(
  props: readonly Prop[],
  edits: ArrangementEdits<Id> | undefined,
  groups: readonly ObjectGroup<Id>[],
): readonly AddedObject[] {
  const removed = new Set(edits?.removed),
    moves = new Map(edits?.moves.map((move) => [move.id, move]));
  return [
    ...props.map((prop, i) => {
      const id = `base-${i}`,
        move = moves.get(id),
        group = groups.find((group) => group.members.includes(id));
      const transform = group && edits?.groups.find((move) => move.id === group.id);
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
    ...(edits?.added ?? []),
  ].filter((item) => !removed.has(item.id));
}
export function arrangementArtTurns<Id extends string>(
  items: readonly AddedObject[],
  groups: readonly ObjectGroup<Id>[],
  edits: ArrangementEdits<Id>,
): ReadonlyMap<Prop, QuarterTurn> {
  const turns = new Map<Prop, QuarterTurn>();
  for (const move of edits.groups) {
    const group = groups.find((group) => group.id === move.id);
    for (const item of items)
      if (group?.members.includes(item.id) && !item.prop.footprint)
        turns.set(item.prop, move.rotation);
  }
  return turns;
}
