import type { TowerDocument, TowerEditsV1 } from './tower-document';
import { towerBase, towerObjectDocument } from './tower-document';
import { TOWER_EDITOR } from './tower-adapter';
import { proposeArrangementCommand } from './arrangement-commands';
import type { ObjectCommand, ObjectEditResult } from './object-command';
import { editableTowerStairs, towerStairMoves, towerStairId } from './tower-stairs';
import { towerStairLandings } from '../tower-landings';
import { towerCommandError, towerEditorPosition, towerPlacementError } from './tower-rules';

const EMPTY_TOWER_OBJECT_EDITS: TowerEditsV1 = {
  version: 1,
  nextId: 1,
  moves: [],
  removed: [],
  added: [],
  groups: [],
  order: [],
};
export function proposeTowerCommand(
  map: TowerDocument,
  command: ObjectCommand,
): ObjectEditResult<TowerDocument> {
  if (command.kind === 'reset')
    return { ok: true, document: map.objectEdits ? towerBase(map) : map };
  const stairs = towerStairMoves(map);
  if ('id' in command && command.id.startsWith('stairs-')) {
    const stair = editableTowerStairs(map).find((s) => s.id === command.id);
    if (!stair) return { ok: false, error: 'That staircase is no longer available.' };
    if (command.kind !== 'move')
      return {
        ok: false,
        error: 'Staircases can be moved; their routes and style stay unchanged.',
      };
    if (!towerEditorPosition(map, command.target.x, command.target.y))
      return { ok: false, error: 'Place the staircase inside the map.' };
    if (stair.x === command.target.x && stair.y === command.target.y)
      return { ok: true, document: map };
    const original = towerStairLandings(map).find((s) => towerStairId(s) === stair.id);
    if (!original) return { ok: false, error: 'That staircase is no longer available.' };
    const moves = [
      ...stairs.filter((s) => s.id !== stair.id),
      ...(original.x === command.target.x && original.y === command.target.y
        ? []
        : [{ id: stair.id, x: command.target.x, y: command.target.y }]),
    ].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const objects = towerObjectDocument(map);
    if (moves.length)
      return {
        ok: true,
        document: {
          ...towerBase(map),
          objectEdits: {
            ...(objects.objectEdits ?? EMPTY_TOWER_OBJECT_EDITS),
            version: 2,
            stairs: moves,
          },
        },
      };
    const edits = objects.objectEdits;
    const hasObjects =
      edits &&
      (edits.moves.length ||
        edits.removed.length ||
        edits.added.length ||
        edits.groups.length ||
        edits.order.length);
    return { ok: true, document: hasObjects ? objects : towerBase(map) };
  }
  const objects = towerObjectDocument(map),
    result = proposeArrangementCommand(objects, command, TOWER_EDITOR);
  if (!result.ok) return result;
  if (result.document === objects) return { ok: true, document: map };
  return {
    ok: true,
    document: stairs.length
      ? {
          ...towerBase(map),
          objectEdits: {
            ...(result.document.objectEdits ?? EMPTY_TOWER_OBJECT_EDITS),
            version: 2,
            stairs,
          },
        }
      : result.document,
  };
}
export function applyTowerCommand(
  map: TowerDocument,
  command: ObjectCommand,
): ObjectEditResult<TowerDocument> {
  const result = proposeTowerCommand(map, command);
  if (!result.ok || result.document === map) return result;
  const error = towerCommandError(map, command) ?? towerPlacementError(result.document);
  return error ? { ok: false, error } : result;
}
