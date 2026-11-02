import { dungeonGroups, translatedGroup, translateGroupProp } from './dungeon-groups';
import type { ReservedArea } from '../feature-reservation';
import type { GroupMove } from './dungeon-groups';
import type { Dungeon, GeneratedMap, Point, Prop } from '../model';

export interface ObjectMove extends Point {
  readonly id: string;
}
export interface AddedObject {
  readonly id: string;
  readonly prop: Prop;
}
export interface ObjectEditsV1 {
  readonly version: 1;
  readonly nextId: number;
  readonly removed: readonly string[];
  readonly moves: readonly ObjectMove[];
  readonly added: readonly AddedObject[];
}
export interface ObjectEditsV2 extends Omit<ObjectEditsV1, 'version'> {
  readonly version: 2;
  readonly groups: readonly GroupMove[];
}
export type ObjectEdits = ObjectEditsV1 | ObjectEditsV2;
/** The ordinary map fields are the frozen base, never the resolved arrangement. */
export interface AuthoredDungeon extends Omit<Dungeon, 'objectEdits'> {
  readonly objectEdits: ObjectEdits;
}
export type DungeonDocument = Dungeon | AuthoredDungeon;
export type MapDocument = GeneratedMap | AuthoredDungeon;
export interface ResolvedDungeon extends Omit<Dungeon, 'objectEdits'> {
  readonly objectEdits: 'resolved';
  readonly studyArea?: ReservedArea;
}
export type DungeonDrawing = Dungeon | ResolvedDungeon;

export function dungeonBase(document: DungeonDocument): Dungeon {
  if (!document.objectEdits) return document;
  const { objectEdits: _edits, ...base } = document;
  return base;
}

export function dungeonInstances(document: DungeonDocument): readonly AddedObject[] {
  const groups = document.objectEdits?.version === 2 ? dungeonGroups(dungeonBase(document)) : [];
  const groupMoves = document.objectEdits?.version === 2 ? document.objectEdits.groups : [];
  const removed = new Set(document.objectEdits?.removed);
  const moves = new Map(document.objectEdits?.moves.map((move) => [move.id, move]));
  return [
    ...document.decoration.props.map((prop, index) => {
      const id = `base-${index}`,
        move = moves.get(id);
      const group = groups.find((group) => group.members.includes(id));
      const groupMove = group && groupMoves.find((move) => move.id === group.id);
      return {
        id,
        prop:
          group && groupMove
            ? translateGroupProp(prop, group, groupMove)
            : move
              ? { ...prop, x: move.x, y: move.y }
              : prop,
      };
    }),
    ...(document.objectEdits?.added ?? []),
  ].filter((item) => !removed.has(item.id));
}

export function resolveDungeon(document: DungeonDocument): DungeonDrawing {
  if (!document.objectEdits) return document;
  const items = dungeonInstances(document);
  const study =
    document.objectEdits.version === 2
      ? dungeonGroups(dungeonBase(document)).find((group) => group.id === 'study')
      : undefined;
  const studyMove =
    document.objectEdits.version === 2
      ? document.objectEdits.groups.find((move) => move.id === 'study')
      : undefined;
  return {
    ...dungeonBase(document),
    objectEdits: 'resolved',
    ...(study && studyMove ? { studyArea: translatedGroup(study, studyMove).area } : {}),
    decoration: { ...document.decoration, props: items.map((item) => item.prop) },
  };
}
