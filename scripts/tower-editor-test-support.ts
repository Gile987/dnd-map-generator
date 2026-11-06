import { editableTowerStairs } from '../src/app/engine/object-editor/tower-stairs';
import { generateTower } from '../src/app/engine/tower';
import type { TowerSettings } from '../src/app/engine/tower';
import type { Point } from '../src/app/engine/model';
import { towerInstances, towerGroups } from '../src/app/engine/object-editor/tower-document';
import type { TowerDocument, TowerGroupId } from '../src/app/engine/object-editor/tower-document';
import { applyTowerCommand } from '../src/app/engine/object-editor/tower-commands';
import { towerObjectLock } from '../src/app/engine/object-editor/tower-rules';
import type { ObjectCommand } from '../src/app/engine/object-editor/object-command';
import { QUARTER_TURNS } from '../src/app/engine/prop-footprint';
export function towerEditorFixture(changes: Partial<TowerSettings> = {}) {
  const result = generateTower({
    seed: 'tower-editor',
    floorCount: 8,
    portalFloor: 1,
    laboratoryFloor: 2,
    observatoryFloor: 3,
    density: 'Balanced',
    stairStyle: 'spiral',
    ...changes,
  });
  if (!result.ok) throw Error(result.error);
  return result.map;
}
export function acceptTower(map: TowerDocument, command: ObjectCommand): TowerDocument {
  const r = applyTowerCommand(map, command);
  if (!r.ok) throw Error(r.error);
  return r.document;
}
export function clearTower(map: TowerDocument): TowerDocument {
  let current = map;
  for (const item of towerInstances(map))
    if (!towerObjectLock(map, item.id, item.prop))
      current = acceptTower(current, { kind: 'remove', id: item.id });
  return current;
}
export function validTowerCommand(
  map: TowerDocument,
  floorNumber: number,
  make: (p: Point) => ObjectCommand,
  skip?: Point,
): ObjectCommand {
  const floor = map.layout.floors.find((f) => f.number === floorNumber);
  if (!floor) throw Error('Missing floor');
  for (let y = floor.y; y < floor.y + floor.height; y++)
    for (let x = floor.x; x < floor.x + floor.width; x++) {
      if (skip?.x === x && skip.y === y) continue;
      const command = make({ x, y }),
        r = applyTowerCommand(map, command);
      if (r.ok && r.document !== map) return command;
    }
  throw Error('No valid Tower placement');
}
export function towerGroupFixture(id: TowerGroupId, changes: Partial<TowerSettings> = {}) {
  const base = towerEditorFixture(changes),
    prepared = clearTower(base),
    group = towerGroups(base).find((g) => g.id === id);
  if (!group) throw Error('Missing group');
  const number =
    id === 'laboratory' ? base.decoration.laboratoryFloor : base.decoration.observatoryFloor;
  const floor = base.layout.floors.find((f) => f.number === number);
  if (!floor) throw Error('Missing floor');
  for (let y = floor.y; y < floor.y + floor.height; y++)
    for (let x = floor.x; x < floor.x + floor.width; x++)
      if (
        (x !== group.area.x || y !== group.area.y) &&
        QUARTER_TURNS.every(
          (rotation) =>
            applyTowerCommand(prepared, { kind: 'move-group', id, target: { x, y }, rotation }).ok,
        )
      )
        return { base, prepared, group, floor, target: { x, y } };
  throw Error('No all-turn group site');
}

/** A destination that clears the old landing for an ordinary object, too. */
export function towerStairFixture(stairStyle: 'spiral' | 'separate' = 'spiral', floorNumber = 2) {
  const base = towerEditorFixture({
      stairStyle,
      portalFloor: null,
      laboratoryFloor: undefined,
      observatoryFloor: undefined,
    }),
    prepared = clearTower(base),
    stair = editableTowerStairs(prepared).find((s) => s.floor === floorNumber),
    floor = base.layout.floors.find((f) => f.number === floorNumber);
  if (!stair || !floor) throw Error('Missing staircase');
  for (let y = floor.y; y < floor.y + floor.height; y++)
    for (let x = floor.x; x < floor.x + floor.width; x++) {
      if (x === stair.x && y === stair.y) continue;
      const command = { kind: 'move' as const, id: stair.id, target: { x, y } },
        result = applyTowerCommand(prepared, command);
      if (
        result.ok &&
        applyTowerCommand(result.document, { kind: 'add', propKind: 'crate', target: stair }).ok
      )
        return { base, prepared, stair, command, moved: result.document };
    }
  throw Error('No clear relocated staircase');
}
