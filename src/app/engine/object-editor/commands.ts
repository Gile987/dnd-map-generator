import { MAX_AUTHORED_OBJECTS } from './object-command';
import type { ObjectCommand, ObjectEditResult } from './object-command';
import { isDungeonSurface } from './dungeon-occupancy';
import { dungeonSelections } from './dungeon-selection';
import {
  hasCustomDungeonOrder,
  orderedDungeonObjects,
  stepDungeonOrder,
} from './dungeon-drawing-order';
import { withDoorStates } from '../dungeon-doors';
import { groupRotation } from './group-rotation';
import { QUARTER_TURNS } from '../prop-footprint';
import { layeredDungeonError } from './dungeon-layering-rules';
import { authoredDungeonError, individualObjectLock } from './dungeon-authoring-rules';
import { dungeonGroups } from './dungeon-groups';
import { isBlockingProp, isTilePosition } from '../model';
import type { Prop } from '../model';
import { dungeonCapability } from './catalog';
import { dungeonBase, dungeonInstances } from './document';
import type { DungeonDocument, ObjectEditsV4, ObjectEditsV5 } from './document';
import { dungeonTargetsError } from './dungeon-rules';

export { MAX_AUTHORED_OBJECTS } from './object-command';
export type { ObjectCommand } from './object-command';
export type EditResult = ObjectEditResult<DungeonDocument>;

/** Unvalidated candidate for placement previews. Only applyObjectCommand commits it. */
export function proposeObjectCommand(
  document: DungeonDocument,
  command: ObjectCommand,
): EditResult {
  const base = dungeonBase(document);
  const plain = withDoorStates(base, document.doorStates);
  if (command.kind === 'reset')
    return { ok: true, document: document.objectEdits ? plain : document };
  if (
    command.kind !== 'remove' &&
    command.kind !== 'order' &&
    !isTilePosition(command.target.x, command.target.y)
  )
    return { ok: false, error: 'Place the object inside the map.' };
  if (
    command.kind === 'move-group' &&
    command.rotation !== undefined &&
    !QUARTER_TURNS.includes(command.rotation)
  )
    return { ok: false, error: 'Choose a quarter-turn rotation.' };
  const common: ObjectEditsV4 = document.objectEdits
    ? {
        ...document.objectEdits,
        version: 4,
        groups:
          document.objectEdits.version !== 1
            ? document.objectEdits.groups.map((move) => ({
                ...move,
                rotation: groupRotation(move),
              }))
            : [],
      }
    : {
        version: 4,
        groups: [],
        nextId: 1,
        moves: [],
        added: [],
        removed: [],
      };
  let edits: ObjectEditsV4 | ObjectEditsV5 =
    document.objectEdits?.version === 5
      ? { ...common, version: 5, order: document.objectEdits.order }
      : common;
  if (command.kind === 'order') {
    const units = dungeonSelections(document);
    const unit = units.find((unit) => unit.id === command.id);
    if (!unit || unit.lock) return { ok: false, error: 'Choose an editable object or addition.' };
    const items = dungeonInstances(document);
    const previous = edits.version === 5 ? edits.order : [];
    const order = stepDungeonOrder(items, previous, units, command.id, command.direction);
    const current = orderedDungeonObjects(items, previous);
    if (order.every((id, i) => current[i]?.id === id)) return { ok: true, document };
    edits = { ...edits, version: 5, order };
  } else if (command.kind === 'move-group') {
    const group = dungeonGroups(base).find((group) => group.id === command.id);
    if (!group) return { ok: false, error: 'That addition is not on this map.' };
    const current = edits.groups.find((move) => move.id === group.id) ?? {
      id: group.id,
      ...group.area,
      rotation: 0 as const,
    };
    const rotation = command.rotation ?? groupRotation(current);
    if (
      current.x === command.target.x &&
      current.y === command.target.y &&
      groupRotation(current) === rotation
    )
      return { ok: true, document };
    edits = {
      ...edits,
      groups: [
        ...edits.groups.filter((move) => move.id !== group.id),
        ...(group.area.x === command.target.x && group.area.y === command.target.y && rotation === 0
          ? []
          : [{ id: group.id, x: command.target.x, y: command.target.y, rotation }]),
      ].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    };
  } else if (command.kind === 'add') {
    if (!dungeonCapability(command.propKind, 2)?.editable)
      return { ok: false, error: 'This object cannot be added individually.' };
    if (edits.added.length >= MAX_AUTHORED_OBJECTS || edits.nextId >= Number.MAX_SAFE_INTEGER)
      return { ok: false, error: 'The custom object limit has been reached.' };
    // Fixed stored artwork choice, independent of generator streams and pointer events.
    const prop: Prop = {
      kind: command.propKind,
      x: command.target.x,
      y: command.target.y,
      blocking: isBlockingProp(command.propKind),
      variation: 0.5,
    };
    edits = {
      ...edits,
      nextId: edits.nextId + 1,
      added: [...edits.added, { id: `added-${edits.nextId}`, prop }],
    };
  } else {
    const item = dungeonInstances(document).find((item) => item.id === command.id);
    if (!item) return { ok: false, error: 'That object is no longer available.' };
    const lock = individualObjectLock(base, item.id, item.prop);
    if (lock) return { ok: false, error: lock };
    if (command.kind === 'remove') {
      edits = {
        ...edits,
        moves: edits.moves.filter((move) => move.id !== command.id),
        added: edits.added.filter((item) => item.id !== command.id),
        removed: command.id.startsWith('base-')
          ? [...edits.removed, command.id].sort()
          : edits.removed,
      };
    } else if (item.prop.x === command.target.x && item.prop.y === command.target.y)
      return { ok: true, document };
    else if (command.id.startsWith('base-')) {
      const original = base.decoration.props[Number(command.id.slice(5))];
      if (!original) return { ok: false, error: 'That object is no longer available.' };
      edits = {
        ...edits,
        moves: [
          ...edits.moves.filter((move) => move.id !== command.id),
          ...(original.x === command.target.x && original.y === command.target.y
            ? []
            : [{ id: command.id, x: command.target.x, y: command.target.y }]),
        ].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
      };
    } else
      edits = {
        ...edits,
        added: edits.added.map((item) =>
          item.id === command.id
            ? { ...item, prop: { ...item.prop, x: command.target.x, y: command.target.y } }
            : item,
        ),
      };
  }
  if (edits.version === 5) {
    const items = dungeonInstances({ ...plain, objectEdits: edits });
    const ids = new Set(items.map((item) => item.id));
    const retained = edits.order.filter((id) => ids.has(id));
    const newItems = items.filter((item) => !retained.includes(item.id));
    // Newly inserted surfaces start underneath; new physical objects start above.
    const order = edits.order.length
      ? [
          ...newItems.filter((item) => isDungeonSurface(item.prop.kind)).map((item) => item.id),
          ...retained,
          ...newItems.filter((item) => !isDungeonSurface(item.prop.kind)).map((item) => item.id),
        ]
      : [];
    edits = {
      ...edits,
      order: command.kind !== 'order' || hasCustomDungeonOrder(items, order) ? order : [],
    };
  }
  const next: DungeonDocument =
    edits.moves.length ||
    edits.added.length ||
    edits.removed.length ||
    edits.groups.length ||
    (edits.version === 5 && edits.order.length)
      ? { ...plain, objectEdits: edits }
      : plain;
  return { ok: true, document: next };
}

export function applyObjectCommand(document: DungeonDocument, command: ObjectCommand): EditResult {
  const result = proposeObjectCommand(document, command);
  if (!result.ok || result.document === document) return result;
  const error = authoredPlacementError(result.document);
  return error ? { ok: false, error } : result;
}

export function authoredPlacementError(document: DungeonDocument): string | undefined {
  if (
    document.objectEdits?.version === 3 ||
    document.objectEdits?.version === 4 ||
    document.objectEdits?.version === 5
  )
    return layeredDungeonError(dungeonBase(document), document, dungeonInstances(document));
  if (document.objectEdits?.version === 2)
    return authoredDungeonError(dungeonBase(document), document, dungeonInstances(document));
  const all = dungeonInstances(document),
    moved = new Set(document.objectEdits?.moves.map((m) => m.id));
  return dungeonTargetsError(
    dungeonBase(document),
    all.filter((p) => moved.has(p.id) || p.id.startsWith('added-')).map((p) => p.prop),
    all.map((p) => p.prop),
  );
}
