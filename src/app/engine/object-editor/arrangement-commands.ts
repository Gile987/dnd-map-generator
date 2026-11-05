import { isBlockingProp, isTilePosition } from '../model';
import { QUARTER_TURNS } from '../prop-footprint';
import { stepObjectOrder, hasCustomObjectOrder } from './drawing-order';
import { MAX_AUTHORED_OBJECTS } from './object-command';
import type { ObjectCommand, ObjectEditResult } from './object-command';
import type {
  ArrangementAdapter,
  ArrangementBase,
  ArrangementDocument,
  ArrangementEdits,
} from './arrangement';

export function proposeArrangementCommand<Base extends ArrangementBase, Id extends string>(
  map: ArrangementDocument<Base, Id>,
  command: ObjectCommand,
  adapter: ArrangementAdapter<Base, Id>,
): ObjectEditResult<ArrangementDocument<Base, Id>> {
  const base = adapter.base(map);
  if (command.kind === 'reset') return { ok: true, document: map.objectEdits ? base : map };
  if ('target' in command && !isTilePosition(command.target.x, command.target.y))
    return { ok: false, error: 'Place the object inside the map.' };
  let edits: ArrangementEdits<Id> = map.objectEdits ?? {
    version: 1,
    nextId: 1,
    moves: [],
    removed: [],
    added: [],
    groups: [],
    order: [],
  };
  if (command.kind === 'order') {
    const units = adapter.selections(map),
      unit = units.find((unit) => unit.id === command.id);
    if (!unit || unit.lock) return { ok: false, error: 'Choose an editable object or addition.' };
    const current = adapter.ordered(map),
      order = stepObjectOrder(current, units, command.id, command.direction);
    if (order.every((id, i) => current[i]?.id === id)) return { ok: true, document: map };
    const defaults = adapter.ordered({ ...base, objectEdits: { ...edits, order: [] } });
    edits = { ...edits, order: hasCustomObjectOrder(defaults, order) ? order : [] };
  } else if (command.kind === 'move-group') {
    const group = adapter.groups(base).find((group) => group.id === command.id);
    if (!group) return { ok: false, error: 'That addition is not on this map.' };
    const current = edits.groups.find((move) => move.id === group.id) ?? {
      id: group.id,
      ...group.area,
      rotation: 0 as const,
    };
    const rotation = command.rotation ?? current.rotation;
    if (!QUARTER_TURNS.includes(rotation) || (!adapter.rotatable(group.id) && rotation !== 0))
      return { ok: false, error: adapter.unsupportedRotation };
    if (
      current.x === command.target.x &&
      current.y === command.target.y &&
      current.rotation === rotation
    )
      return { ok: true, document: map };
    edits = {
      ...edits,
      groups: [
        ...edits.groups.filter((move) => move.id !== group.id),
        ...(command.target.x === group.area.x && command.target.y === group.area.y && rotation === 0
          ? []
          : [{ id: group.id, x: command.target.x, y: command.target.y, rotation }]),
      ].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    };
  } else if (command.kind === 'add') {
    if (!adapter.capability(command.propKind)?.editable)
      return { ok: false, error: adapter.unsupportedObject };
    if (edits.added.length >= MAX_AUTHORED_OBJECTS || edits.nextId >= Number.MAX_SAFE_INTEGER)
      return { ok: false, error: 'The custom object limit has been reached.' };
    edits = {
      ...edits,
      nextId: edits.nextId + 1,
      added: [
        ...edits.added,
        {
          id: `added-${edits.nextId}`,
          prop: {
            kind: command.propKind,
            x: command.target.x,
            y: command.target.y,
            variation: 0.5,
            blocking: isBlockingProp(command.propKind),
          },
        },
      ],
    };
  } else {
    const item = adapter.instances(map).find((item) => item.id === command.id);
    if (!item) return { ok: false, error: 'That object is no longer available.' };
    const lock = adapter.lock(map, item.id, item.prop);
    if (lock) return { ok: false, error: lock };
    if (command.kind === 'remove')
      edits = {
        ...edits,
        moves: edits.moves.filter((move) => move.id !== item.id),
        added: edits.added.filter((other) => other.id !== item.id),
        removed: item.id.startsWith('base-') ? [...edits.removed, item.id].sort() : edits.removed,
      };
    else {
      if (item.prop.x === command.target.x && item.prop.y === command.target.y)
        return { ok: true, document: map };
      if (item.id.startsWith('base-')) {
        const source = base.decoration.props[Number(item.id.slice(5))];
        if (!source) return { ok: false, error: 'That object is no longer available.' };
        edits = {
          ...edits,
          moves: [
            ...edits.moves.filter((move) => move.id !== item.id),
            ...(source.x === command.target.x && source.y === command.target.y
              ? []
              : [{ id: item.id, x: command.target.x, y: command.target.y }]),
          ].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
        };
      } else
        edits = {
          ...edits,
          added: edits.added.map((other) =>
            other.id === item.id
              ? { ...other, prop: { ...other.prop, x: command.target.x, y: command.target.y } }
              : other,
          ),
        };
    }
  }
  if (edits.order.length) {
    const items = adapter.instances({ ...base, objectEdits: edits }),
      ids = new Set(items.map((item) => item.id));
    const retained = edits.order.filter((id) => ids.has(id)),
      added = items.filter((item) => !retained.includes(item.id));
    edits = {
      ...edits,
      order: [
        ...added.filter((item) => adapter.surface(item.prop.kind)).map((item) => item.id),
        ...retained,
        ...added.filter((item) => !adapter.surface(item.prop.kind)).map((item) => item.id),
      ],
    };
  }
  return {
    ok: true,
    document:
      edits.moves.length ||
      edits.removed.length ||
      edits.added.length ||
      edits.groups.length ||
      edits.order.length
        ? { ...base, objectEdits: edits }
        : base,
  };
}
export function applyArrangementCommand<Base extends ArrangementBase, Id extends string>(
  map: ArrangementDocument<Base, Id>,
  command: ObjectCommand,
  adapter: ArrangementAdapter<Base, Id>,
): ObjectEditResult<ArrangementDocument<Base, Id>> {
  const result = proposeArrangementCommand(map, command, adapter);
  if (!result.ok || result.document === map) return result;
  const error = adapter.placementError(result.document);
  return error ? { ok: false, error } : result;
}
