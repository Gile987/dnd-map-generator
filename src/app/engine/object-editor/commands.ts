import { groupRotation } from './group-rotation';
import { QUARTER_TURNS } from '../prop-footprint';
import { layeredDungeonError } from './dungeon-layering-rules';
import { authoredDungeonError, individualObjectLock } from './dungeon-authoring-rules';
import { dungeonGroups } from './dungeon-groups';
import { isBlockingProp, isTilePosition } from '../model';
import type { Point, Prop, PropKind, QuarterTurn } from '../model';
import { dungeonCapability } from './catalog';
import { dungeonBase, dungeonInstances } from './document';
import type { DungeonDocument, ObjectEditsV4 } from './document';
import { dungeonTargetsError } from './dungeon-rules';

export const MAX_AUTHORED_OBJECTS = 120;
export type ObjectCommand =
  | {
      readonly kind: 'move-group';
      readonly id: string;
      readonly target: Point;
      readonly rotation?: QuarterTurn;
    }
  | { readonly kind: 'move'; readonly id: string; readonly target: Point }
  | { readonly kind: 'add'; readonly propKind: PropKind; readonly target: Point }
  | { readonly kind: 'remove'; readonly id: string }
  | { readonly kind: 'reset' };
export type EditResult =
  | { readonly ok: true; readonly document: DungeonDocument }
  | { readonly ok: false; readonly error: string };

/** Unvalidated candidate for placement previews. Only applyObjectCommand commits it. */
export function proposeObjectCommand(
  document: DungeonDocument,
  command: ObjectCommand,
): EditResult {
  const base = dungeonBase(document);
  if (command.kind === 'reset') return { ok: true, document: base };
  if (command.kind !== 'remove' && !isTilePosition(command.target.x, command.target.y))
    return { ok: false, error: 'Place the object inside the map.' };
  if (
    command.kind === 'move-group' &&
    command.rotation !== undefined &&
    !QUARTER_TURNS.includes(command.rotation)
  )
    return { ok: false, error: 'Choose a quarter-turn rotation.' };
  let edits: ObjectEditsV4 = document.objectEdits
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
  if (command.kind === 'move-group') {
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
      const next =
        edits.moves.length || edits.added.length || edits.removed.length || edits.groups.length
          ? { ...base, objectEdits: edits }
          : base;
      return { ok: true, document: next };
    }
    if (item.prop.x === command.target.x && item.prop.y === command.target.y)
      return { ok: true, document };
    if (command.id.startsWith('base-')) {
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
  const next: DungeonDocument =
    edits.moves.length || edits.added.length || edits.removed.length || edits.groups.length
      ? { ...base, objectEdits: edits }
      : base;
  return { ok: true, document: next };
}

export function applyObjectCommand(document: DungeonDocument, command: ObjectCommand): EditResult {
  const result = proposeObjectCommand(document, command);
  if (!result.ok || result.document === document) return result;
  const error = authoredPlacementError(result.document);
  return error ? { ok: false, error } : result;
}

export function authoredPlacementError(document: DungeonDocument): string | undefined {
  if (document.objectEdits?.version === 3 || document.objectEdits?.version === 4)
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
