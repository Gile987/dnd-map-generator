import type { DoorStates } from '../dungeon-doors';
import { groupRotation, transformedGroup, transformedGroupProp } from './group-rotation';
import type { GroupTransform } from './group-rotation';
import { dungeonGroups, translatedGroup, translateGroupProp } from './dungeon-groups';
import type { ReservedArea } from '../feature-reservation';
import type { GroupMove, DungeonGroup } from './dungeon-groups';
import type { Dungeon, GeneratedMap, Point, Prop, QuarterTurn } from '../model';

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
export interface ObjectEditsV3 extends Omit<ObjectEditsV2, 'version'> {
  readonly version: 3;
}
export interface ObjectEditsV4 extends Omit<ObjectEditsV3, 'version' | 'groups'> {
  readonly version: 4;
  readonly groups: readonly GroupTransform[];
}
export type ObjectEdits = ObjectEditsV1 | ObjectEditsV2 | ObjectEditsV3 | ObjectEditsV4;
/** The ordinary map fields are the frozen base, never the resolved arrangement. */
export interface AuthoredDungeon extends Omit<Dungeon, 'objectEdits' | 'doorStates'> {
  readonly objectEdits: ObjectEdits;
  readonly doorStates?: DoorStates;
}
export interface DoorDungeon extends Omit<Dungeon, 'doorStates'> {
  readonly doorStates: DoorStates;
}
export type DungeonDocument = Dungeon | DoorDungeon | AuthoredDungeon;
export type MapDocument = GeneratedMap | DoorDungeon | AuthoredDungeon;
export interface GroupArtworkTransform {
  readonly base: Dungeon;
  readonly group: DungeonGroup;
  readonly move: GroupTransform;
}
export interface ResolvedDungeon extends Omit<Dungeon, 'objectEdits' | 'doorStates'> {
  readonly objectEdits: 'resolved';
  readonly doorStates?: DoorStates;
  readonly instances: readonly AddedObject[];
  readonly artTurns?: ReadonlyMap<Prop, QuarterTurn>;
  readonly ritualTransform?: GroupArtworkTransform;
  readonly studyTransform?: GroupArtworkTransform;
  readonly studyArea?: ReservedArea;
}
export type DungeonDrawing = Dungeon | DoorDungeon | ResolvedDungeon;

export function dungeonBase(document: DungeonDocument): Dungeon {
  if (!document.objectEdits && !document.doorStates) return document;
  const { objectEdits: _edits, doorStates: _doors, ...base } = document;
  return base;
}

export function dungeonInstances(document: DungeonDocument): readonly AddedObject[] {
  const groups =
    document.objectEdits && document.objectEdits.version !== 1
      ? dungeonGroups(dungeonBase(document))
      : [];
  const groupMoves =
    document.objectEdits && document.objectEdits.version !== 1 ? document.objectEdits.groups : [];
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
            ? document.objectEdits?.version === 4
              ? transformedGroupProp(prop, group, groupMove)
              : translateGroupProp(prop, group, groupMove)
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
    document.objectEdits.version !== 1
      ? dungeonGroups(dungeonBase(document)).find((group) => group.id === 'study')
      : undefined;
  const studyMove =
    document.objectEdits.version !== 1
      ? document.objectEdits.groups.find((move) => move.id === 'study')
      : undefined;
  const artTurns = new Map<Prop, QuarterTurn>();
  const base = dungeonBase(document);
  if (document.objectEdits.version === 4) {
    const groups = dungeonGroups(base);
    for (const move of document.objectEdits.groups) {
      const group = groups.find((g) => g.id === move.id);
      if (!group) continue;
      for (const item of items)
        if (group.members.includes(item.id) && !item.prop.footprint)
          artTurns.set(item.prop, move.rotation);
    }
  }
  const studyTransform =
    document.objectEdits.version === 4 && studyMove && study
      ? { base, group: study, move: { ...studyMove, rotation: groupRotation(studyMove) } }
      : undefined;
  const ritual = dungeonGroups(base).find((g) => g.id === 'ritual');
  const ritualMove =
    document.objectEdits.version === 4
      ? document.objectEdits.groups.find((g) => g.id === 'ritual')
      : undefined;
  return {
    ...base,
    objectEdits: 'resolved',
    ...(document.doorStates ? { doorStates: document.doorStates } : {}),
    instances: items,
    ...(artTurns.size ? { artTurns } : {}),
    ...(studyTransform ? { studyTransform } : {}),
    ...(ritual && ritualMove ? { ritualTransform: { base, group: ritual, move: ritualMove } } : {}),
    ...(study && studyMove
      ? {
          studyArea: (document.objectEdits.version === 4
            ? transformedGroup(study, studyMove)
            : translatedGroup(study, studyMove)
          ).area,
        }
      : {}),
    decoration: { ...document.decoration, props: items.map((item) => item.prop) },
  };
}
