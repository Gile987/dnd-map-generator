import { isBlockingProp, isTilePosition } from '../model';
import type { PropKind } from '../model';
import { QUARTER_TURNS } from '../prop-footprint';
import { MAX_AUTHORED_OBJECTS } from './object-command';
import type {
  ArrangementAdapter,
  ArrangementBase,
  ArrangementEdits,
  AuthoredArrangement,
} from './arrangement';

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
export function parseArrangementEdits<Base extends ArrangementBase, Id extends string>(
  base: Base,
  value: unknown,
  adapter: ArrangementAdapter<Base, Id>,
): AuthoredArrangement<Base, Id> | undefined {
  if (
    !object(value) ||
    !keys(value, ['version', 'nextId', 'moves', 'removed', 'added', 'groups', 'order']) ||
    value['version'] !== 1 ||
    typeof value['nextId'] !== 'number' ||
    !Number.isSafeInteger(value['nextId']) ||
    value['nextId'] < 1 ||
    !Array.isArray(value['moves']) ||
    value['moves'].length > base.decoration.props.length ||
    !Array.isArray(value['removed']) ||
    value['removed'].length > base.decoration.props.length ||
    !Array.isArray(value['added']) ||
    value['added'].length > MAX_AUTHORED_OBJECTS ||
    !Array.isArray(value['groups']) ||
    value['groups'].length > adapter.groups(base).length ||
    !Array.isArray(value['order']) ||
    value['order'].length > base.decoration.props.length + MAX_AUTHORED_OBJECTS
  )
    return undefined;
  const groups: ArrangementEdits<Id>['groups'][number][] = [],
    moves: ArrangementEdits<Id>['moves'][number][] = [],
    removed: string[] = [],
    added: ArrangementEdits<Id>['added'][number][] = [];
  const seen = new Set<string>();
  for (const id of value['removed']) {
    if (typeof id !== 'string' || !/^base-(0|[1-9]\d*)$/.test(id) || seen.has(id)) return undefined;
    const prop = base.decoration.props[Number(id.slice(5))];
    if (!prop || adapter.lock(base, id, prop)) return undefined;
    seen.add(id);
    removed.push(id);
  }
  for (const move of value['moves']) {
    if (
      !object(move) ||
      !keys(move, ['id', 'x', 'y']) ||
      !position(move) ||
      typeof move['id'] !== 'string' ||
      !/^base-(0|[1-9]\d*)$/.test(move['id']) ||
      seen.has(move['id'])
    )
      return undefined;
    const id = move['id'],
      prop = base.decoration.props[Number(id.slice(5))];
    if (!prop || adapter.lock(base, id, prop) || (move.x === prop.x && move.y === prop.y))
      return undefined;
    seen.add(id);
    moves.push({ id, x: move.x, y: move.y });
  }
  for (const entry of value['added']) {
    if (
      !object(entry) ||
      !keys(entry, ['id', 'prop']) ||
      typeof entry['id'] !== 'string' ||
      !/^added-[1-9]\d*$/.test(entry['id']) ||
      Number(entry['id'].slice(6)) >= value['nextId'] ||
      seen.has(entry['id'])
    )
      return undefined;
    const prop = entry['prop'];
    if (
      !object(prop) ||
      !keys(prop, ['kind', 'x', 'y', 'blocking', 'variation']) ||
      !position(prop) ||
      typeof prop['kind'] !== 'string' ||
      !adapter.capability(prop['kind'] as PropKind)?.editable ||
      prop['blocking'] !== isBlockingProp(prop['kind'] as PropKind) ||
      prop['variation'] !== 0.5
    )
      return undefined;
    const kind = prop['kind'] as PropKind;
    seen.add(entry['id']);
    added.push({
      id: entry['id'],
      prop: { kind, x: prop.x, y: prop.y, blocking: isBlockingProp(kind), variation: 0.5 },
    });
  }
  const available = adapter.groups(base),
    seenGroups = new Set<string>();
  for (const move of value['groups']) {
    if (!object(move) || !keys(move, ['id', 'x', 'y', 'rotation']) || !position(move))
      return undefined;
    const group = available.find((group) => group.id === move['id']),
      rotation = QUARTER_TURNS.find((turn) => turn === move['rotation']);
    if (
      !group ||
      rotation === undefined ||
      seenGroups.has(group.id) ||
      (!adapter.rotatable(group.id) && rotation !== 0) ||
      (group.area.x === move.x && group.area.y === move.y && rotation === 0)
    )
      return undefined;
    seenGroups.add(group.id);
    groups.push({ id: group.id, x: move.x, y: move.y, rotation });
  }
  const order = value['order'];
  if (!order.every((id): id is string => typeof id === 'string')) return undefined;
  const result: AuthoredArrangement<Base, Id> = {
    ...base,
    objectEdits: { version: 1, nextId: value['nextId'], groups, moves, removed, added, order },
  };
  const items = adapter.instances(result),
    ids = new Set(items.map((item) => item.id));
  if (
    order.length &&
    (order.length !== items.length ||
      new Set(order).size !== order.length ||
      order.some((id) => !ids.has(id)))
  )
    return undefined;
  for (const group of available) {
    const expected = adapter
      .ordered(base)
      .filter((item) => group.members.includes(item.id))
      .map((item) => item.id);
    const actual = adapter
      .ordered(result)
      .filter((item) => group.members.includes(item.id))
      .map((item) => item.id);
    if (expected.some((id, i) => actual[i] !== id)) return undefined;
  }
  if (!moves.length && !removed.length && !added.length && !groups.length && !order.length)
    return undefined;
  return adapter.placementError(result) ? undefined : result;
}
