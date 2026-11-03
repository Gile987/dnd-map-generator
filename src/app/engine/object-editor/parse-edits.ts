import { individualObjectLock } from './dungeon-authoring-rules';
import { dungeonGroups } from './dungeon-groups';
import { QUARTER_TURNS } from '../prop-footprint';
import type { GroupTransform } from './group-rotation';
import type { GroupMove } from './dungeon-groups';
import { isBlockingProp, isDungeonPropKind, isTilePosition } from '../model';
import type { Dungeon, PropKind } from '../model';
import { dungeonCapability } from './catalog';
import { authoredPlacementError, MAX_AUTHORED_OBJECTS } from './commands';
import type { AuthoredDungeon, ObjectEdits, ObjectMove, AddedObject } from './document';
import { dungeonObjectLock } from './dungeon-rules';

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
function position(
  value: Record<string, unknown>,
): value is Record<string, unknown> & { x: number; y: number } {
  return (
    typeof value['x'] === 'number' &&
    typeof value['y'] === 'number' &&
    isTilePosition(value['x'], value['y'])
  );
}

/** Versioned edits; base validation and format vocabulary checks happen at the save boundary. */
export function parseDungeonEdits(base: Dungeon, value: unknown): AuthoredDungeon | undefined {
  if (
    !object(value) ||
    !keys(
      value,
      value['version'] === 2 || value['version'] === 3 || value['version'] === 4
        ? ['version', 'nextId', 'moves', 'added', 'removed', 'groups']
        : ['version', 'nextId', 'moves', 'added', 'removed'],
    ) ||
    (value['version'] !== 1 &&
      value['version'] !== 2 &&
      value['version'] !== 3 &&
      value['version'] !== 4) ||
    typeof value['nextId'] !== 'number' ||
    !Number.isSafeInteger(value['nextId']) ||
    value['nextId'] < 1 ||
    !Array.isArray(value['removed']) ||
    value['removed'].length > base.decoration.props.length ||
    !Array.isArray(value['moves']) ||
    value['moves'].length > base.decoration.props.length ||
    !Array.isArray(value['added']) ||
    value['added'].length > MAX_AUTHORED_OBJECTS
  )
    return undefined;
  const groups: GroupMove[] = [];
  const transforms: GroupTransform[] = [];
  if (value['version'] === 2 || value['version'] === 3 || value['version'] === 4) {
    if (!Array.isArray(value['groups']) || value['groups'].length > 4) return undefined;
    const available = dungeonGroups(base),
      seen = new Set<string>();
    for (const move of value['groups']) {
      if (
        !object(move) ||
        !keys(move, value['version'] === 4 ? ['id', 'x', 'y', 'rotation'] : ['id', 'x', 'y']) ||
        !position(move)
      )
        return undefined;
      const rotation = QUARTER_TURNS.find((q) => q === move['rotation']);
      if (value['version'] === 4 && rotation === undefined) return undefined;
      const group = available.find((group) => group.id === move['id']);
      if (
        !group ||
        seen.has(group.id) ||
        (group.area.x === move.x &&
          group.area.y === move.y &&
          (value['version'] !== 4 || move['rotation'] === 0))
      )
        return undefined;
      seen.add(group.id);
      const groupPosition = { id: group.id, x: move.x, y: move.y };
      groups.push(groupPosition);
      if (value['version'] === 4 && rotation !== undefined)
        transforms.push({ ...groupPosition, rotation });
    }
  }
  const moves: ObjectMove[] = [],
    added: AddedObject[] = [],
    ids = new Set<string>(),
    removed: string[] = [];
  for (const id of value['removed']) {
    if (typeof id !== 'string' || !/^base-(0|[1-9]\d*)$/.test(id) || ids.has(id)) return undefined;
    const prop = base.decoration.props[Number(id.slice(5))];
    if (
      !prop ||
      (value['version'] === 1
        ? dungeonObjectLock(base, prop)
        : individualObjectLock(base, id, prop))
    )
      return undefined;
    ids.add(id);
    removed.push(id);
  }
  for (const move of value['moves']) {
    if (
      !object(move) ||
      !keys(move, ['id', 'x', 'y']) ||
      !position(move) ||
      typeof move['id'] !== 'string' ||
      !/^base-(0|[1-9]\d*)$/.test(move['id']) ||
      ids.has(move['id'])
    )
      return undefined;
    const source = base.decoration.props[Number(move['id'].slice(5))];
    if (
      !source ||
      (value['version'] === 1
        ? dungeonObjectLock(base, source)
        : individualObjectLock(base, move['id'], source)) ||
      (source.x === move.x && source.y === move.y)
    )
      return undefined;
    ids.add(move['id']);
    moves.push({ id: move['id'], x: move.x, y: move.y });
  }
  for (const item of value['added']) {
    if (
      !object(item) ||
      !keys(item, ['id', 'prop']) ||
      typeof item['id'] !== 'string' ||
      !/^added-[1-9]\d*$/.test(item['id']) ||
      ids.has(item['id']) ||
      Number(item['id'].slice(6)) >= value['nextId']
    )
      return undefined;
    const prop = item['prop'];
    if (
      !object(prop) ||
      !keys(prop, ['kind', 'x', 'y', 'variation', 'blocking']) ||
      !position(prop) ||
      typeof prop['kind'] !== 'string' ||
      !isDungeonPropKind(prop['kind'] as PropKind) ||
      !dungeonCapability(prop['kind'] as PropKind, value['version'])?.editable ||
      prop['blocking'] !== isBlockingProp(prop['kind'] as PropKind) ||
      prop['variation'] !== 0.5
    )
      return undefined;
    ids.add(item['id']);
    added.push({
      id: item['id'],
      prop: {
        kind: prop['kind'] as PropKind,
        x: prop.x,
        y: prop.y,
        blocking: isBlockingProp(prop['kind'] as PropKind),
        variation: 0.5,
      },
    });
  }
  if (!moves.length && !added.length && !removed.length && !groups.length) return undefined;
  const common = { nextId: value['nextId'], moves, added, removed };
  const edits: ObjectEdits =
    value['version'] === 1
      ? { ...common, version: 1 }
      : value['version'] === 4
        ? { ...common, version: 4, groups: transforms }
        : { ...common, version: value['version'], groups };
  const result = { ...base, objectEdits: edits };
  return authoredPlacementError(result) ? undefined : result;
}
