import { validStoredRotation, authoredOrientation } from './object-rotation';
import type { QuarterTurn } from '../model';
import { dungeonInstances } from './document';
import { orderedDungeonObjects } from './dungeon-drawing-order';
import { individualObjectLock } from './dungeon-authoring-rules';
import { dungeonGroups } from './dungeon-groups';
import { QUARTER_TURNS } from '../prop-footprint';
import type { GroupTransform } from './group-rotation';
import { isBlockingProp, isTilePosition } from '../model';
import type { Dungeon, PropKind } from '../model';
import { dungeonCapability } from './catalog';
import { authoredPlacementError, MAX_AUTHORED_OBJECTS } from './commands';
import type { AuthoredDungeon, ObjectEdits, ObjectMove, AddedObject } from './document';

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
    !keys(value, [
      'version',
      'nextId',
      'moves',
      'added',
      'removed',
      'groups',
      ...(value['version'] === 5 ? ['order'] : []),
    ]) ||
    (value['version'] !== 4 && value['version'] !== 5) ||
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
  const transforms: GroupTransform[] = [];
  if (!Array.isArray(value['groups']) || value['groups'].length > 4) return undefined;
  const available = dungeonGroups(base),
    seen = new Set<string>();
  for (const move of value['groups']) {
    if (!object(move) || !keys(move, ['id', 'x', 'y', 'rotation']) || !position(move))
      return undefined;
    const rotation = QUARTER_TURNS.find((q) => q === move['rotation']);
    if (rotation === undefined) return undefined;
    const group = available.find((group) => group.id === move['id']);
    if (
      !group ||
      seen.has(group.id) ||
      (group.area.x === move.x && group.area.y === move.y && rotation === 0)
    )
      return undefined;
    seen.add(group.id);
    transforms.push({ id: group.id, x: move.x, y: move.y, rotation });
  }
  const moves: ObjectMove[] = [],
    added: AddedObject[] = [],
    ids = new Set<string>(),
    removed: string[] = [];
  for (const id of value['removed']) {
    if (typeof id !== 'string' || !/^base-(0|[1-9]\d*)$/.test(id) || ids.has(id)) return undefined;
    const prop = base.decoration.props[Number(id.slice(5))];
    if (!prop || individualObjectLock(base, id, prop)) return undefined;
    ids.add(id);
    removed.push(id);
  }
  for (const move of value['moves']) {
    if (
      !object(move) ||
      !keys(move, ['id', 'x', 'y', 'artRotation', 'rotation']) ||
      !validStoredRotation(move) ||
      !position(move) ||
      typeof move['id'] !== 'string' ||
      !/^base-(0|[1-9]\d*)$/.test(move['id']) ||
      ids.has(move['id'])
    )
      return undefined;
    const source = base.decoration.props[Number(move['id'].slice(5))];
    if (
      !source ||
      individualObjectLock(base, move['id'], source) ||
      (source.footprint
        ? move['artRotation'] !== undefined ||
          !QUARTER_TURNS.some((turn) => turn === move['rotation'])
        : move['rotation'] !== undefined) ||
      (source.x === move.x &&
        source.y === move.y &&
        (source.footprint ? move['rotation'] === source.rotation : !move['artRotation']))
    )
      return undefined;
    ids.add(move['id']);
    moves.push({
      id: move['id'],
      x: move.x,
      y: move.y,
      ...(source.footprint
        ? { rotation: move['rotation'] as QuarterTurn }
        : move['artRotation']
          ? { artRotation: move['artRotation'] as QuarterTurn }
          : {}),
    });
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
    if (!object(prop)) return undefined;
    const orientation = authoredOrientation(prop);
    if (
      !keys(prop, [
        'kind',
        'x',
        'y',
        'variation',
        'blocking',
        'artRotation',
        'footprint',
        'rotation',
      ]) ||
      !orientation ||
      !position(prop) ||
      typeof prop['kind'] !== 'string' ||
      !dungeonCapability(prop['kind'] as PropKind)?.editable ||
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
        ...orientation,
      },
    });
  }
  const order = value['version'] === 5 ? value['order'] : [];
  if (!Array.isArray(order) || !order.every((id): id is string => typeof id === 'string'))
    return undefined;
  const availableIds = [
    ...base.decoration.props.flatMap((_, i) =>
      removed.includes(`base-${i}`) ? [] : [`base-${i}`],
    ),
    ...added.map((item) => item.id),
  ];
  if (
    order.length &&
    (order.length !== availableIds.length ||
      new Set(order).size !== order.length ||
      order.some((id) => !availableIds.includes(id)))
  )
    return undefined;
  if (!moves.length && !added.length && !removed.length && !transforms.length && !order.length)
    return undefined;
  const common = { nextId: value['nextId'], moves, added, removed };
  const edits: ObjectEdits =
    value['version'] === 5
      ? { ...common, version: 5, groups: transforms, order }
      : { ...common, version: 4, groups: transforms };
  const result = { ...base, objectEdits: edits };
  if (order.length) {
    const defaults = orderedDungeonObjects(dungeonInstances(result));
    for (const group of dungeonGroups(base)) {
      const expected = defaults
        .filter((item) => group.members.includes(item.id))
        .map((item) => item.id);
      const actual = order.filter((id) => group.members.includes(id));
      if (expected.some((id, i) => actual[i] !== id)) return undefined;
    }
  }
  return authoredPlacementError(result) ? undefined : result;
}
