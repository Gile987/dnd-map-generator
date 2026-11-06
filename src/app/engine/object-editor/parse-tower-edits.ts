import type { Tower } from '../tower';
import type { AuthoredTower } from './tower-document';
import { TOWER_EDITOR } from './tower-adapter';
import { parseArrangementEdits } from './parse-arrangement-edits';
import { towerStairLandings } from '../tower-landings';
import { towerStairId } from './tower-stairs';
import type { TowerStairMove } from './tower-stairs';
import { towerEditorPosition, towerPlacementError } from './tower-rules';
export function parseTowerEdits(base: Tower, value: unknown): AuthoredTower | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  if (!('version' in value) || value.version !== 2)
    return parseArrangementEdits(base, value, TOWER_EDITOR);
  if (!('stairs' in value) || !Array.isArray(value.stairs) || !value.stairs.length)
    return undefined;
  const available = towerStairLandings(base),
    stairs: TowerStairMove[] = [],
    seen = new Set<string>();
  if (value.stairs.length > available.length) return undefined;
  for (const move of value.stairs) {
    if (
      typeof move !== 'object' ||
      move === null ||
      Array.isArray(move) ||
      Object.keys(move).some((k) => !['id', 'x', 'y'].includes(k)) ||
      typeof move.id !== 'string' ||
      typeof move.x !== 'number' ||
      typeof move.y !== 'number' ||
      !towerEditorPosition(base, move.x, move.y) ||
      seen.has(move.id)
    )
      return undefined;
    const original = available.find((s) => towerStairId(s) === move.id);
    if (!original || (original.x === move.x && original.y === move.y)) return undefined;
    seen.add(move.id);
    stairs.push({ id: move.id, x: move.x, y: move.y });
  }
  const { stairs: _stairs, ...objects } = value;
  // Parse the frozen furniture grammar first; validate occupancy once against
  // the resolved stair positions, so vacated landings really are usable.
  const parsed = parseArrangementEdits(
    base,
    { ...objects, version: 1 },
    { ...TOWER_EDITOR, placementError: () => undefined },
    { allowEmpty: true },
  );
  if (!parsed) return undefined;
  const result: AuthoredTower = {
    ...base,
    objectEdits: { ...parsed.objectEdits, version: 2, stairs },
  };
  return towerPlacementError(result) ? undefined : result;
}
