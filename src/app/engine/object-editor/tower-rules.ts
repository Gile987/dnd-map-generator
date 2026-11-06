import { towerStairFootprint } from '../tower-connection-geometry';
import {
  editableTowerStairs,
  towerStairBounds,
  towerStairPlacementError,
  towerConnectionFootprints,
} from './tower-stairs';
import { DENSITY_BUDGETS } from '../model';
import type { Prop } from '../model';
import { towerFloorAt, towerStairStyle } from '../tower';
import type { Tower } from '../tower';
import { propBounds, propCells } from '../prop-footprint';
import { areasOverlap, shapesOverlap } from '../feature-reservation';
import type { ObjectSelection } from './object-selection';
import type { ObjectCommand } from './object-command';
import { towerInstances, towerBase, currentTowerGroups } from './tower-document';
import type { TowerDocument } from './tower-document';
import { towerCapability, isTowerSurface } from './tower-catalog';
export function towerEditorPosition(base: Pick<Tower, 'layout'>, x: number, y: number): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    y >= 0 &&
    x < base.layout.width &&
    y < base.layout.height
  );
}
export function towerObjectLock(map: TowerDocument, id: string, prop: Prop): string | undefined {
  if (currentTowerGroups(map).some((g) => g.members.includes(id)))
    return 'Select the complete addition.';
  return independentObjectLock(prop);
}
function independentObjectLock(prop: Prop): string | undefined {
  const capability = towerCapability(prop.kind);
  return capability?.editable ? undefined : (capability?.reason ?? 'This object is protected.');
}
export function towerSelections(map: TowerDocument): readonly ObjectSelection[] {
  const items = towerInstances(map),
    groups = currentTowerGroups(map);
  return [
    ...editableTowerStairs(map).map((stair) => ({
      id: stair.id,
      architecture: 'stairs' as const,
      label: `${stair.routes.length > 1 ? 'Up/down staircase' : 'Staircase'} · ${stair.routes.map((r) => `${r.id} ${r.direction} to floor ${r.destination}`).join(', ')}`,
      position: { x: stair.x, y: stair.y },
      area: towerStairBounds(map, stair),
      footprint: towerStairFootprint(stair, towerStairStyle(map)),
      members: [],
      props: [],
      removable: false,
    })),
    ...groups.map((g) => ({
      id: `group-${g.id}`,
      groupId: g.id,
      label: g.label,
      position: g.area,
      area: g.area,
      members: g.members,
      props: items.filter((i) => g.members.includes(i.id)).map((i) => i.prop),
      rotation: map.objectEdits?.groups.find((m) => m.id === g.id)?.rotation ?? 0,
      removable: false,
    })),
    ...items
      .filter((i) => !groups.some((g) => g.members.includes(i.id)))
      .map((i) => {
        // Group members were already filtered above. Do not reconstruct both
        // canonical addition packs for every independent object in the sheet.
        const lock = independentObjectLock(i.prop);
        return {
          id: i.id,
          label: towerCapability(i.prop.kind)?.label ?? i.prop.kind,
          position: i.prop,
          area: propBounds(i.prop),
          members: [i.id],
          props: [i.prop],
          lock,
          removable: !lock,
        };
      }),
  ];
}
export function towerObjectsCollide(a: Prop, b: Prop): boolean {
  if (!areasOverlap(propBounds(a), propBounds(b))) return false;
  const ca = isTowerSurface(a.kind),
    cb = isTowerSurface(b.kind);
  return (!ca && !cb) || (ca && cb && a.kind === b.kind);
}
export function towerCommandError(map: TowerDocument, command: ObjectCommand): string | undefined {
  if (command.kind === 'move') {
    const source = towerInstances(map).find((i) => i.id === command.id),
      floor = source && towerFloorAt(map, source.prop),
      target = towerFloorAt(map, command.target);
    if (floor && target && target.number !== floor.number)
      return `Keep this object on floor ${floor.number}. Cross-floor moves are not available.`;
  }
  if (command.kind === 'add' && command.floor !== undefined) {
    const floor = towerFloorAt(map, command.target);
    if (!Number.isInteger(command.floor) || !floor || floor.number !== command.floor)
      return `Place the new object on the selected floor ${command.floor}.`;
  }
  return undefined;
}
export function towerPlacementError(map: TowerDocument): string | undefined {
  const stairError = towerStairPlacementError(map);
  if (stairError) return stairError;
  const connections = towerConnectionFootprints(map);
  const base = towerBase(map),
    items = towerInstances(map),
    width = map.layout.width;
  for (const item of items) {
    const floor = towerFloorAt(map, item.prop);
    if (
      !floor ||
      propCells(item.prop).some(
        (p) =>
          !towerEditorPosition(map, p.x, p.y) ||
          !map.layout.tiles[p.y * width + p.x] ||
          towerFloorAt(map, p)?.number !== floor.number,
      )
    )
      return 'Keep every object on the walkable interior of one floor, inside its circular walls.';
    const original = item.id.startsWith('base-')
      ? base.decoration.props[Number(item.id.slice(5))]
      : undefined;
    const owner = original && towerFloorAt(base, original);
    if (owner && owner.number !== floor.number)
      return `Keep this object on floor ${owner.number}. Cross-floor moves are not available.`;
    // Moss is painted ground beneath connection artwork, not an obstacle.
    // Bedrolls and other physical props still need clear space.
    if (
      item.prop.kind !== 'moss' &&
      connections.some((shape) =>
        shapesOverlap({ kind: 'rectangle', ...propBounds(item.prop) }, shape),
      )
    ) {
      const label = towerCapability(item.prop.kind)?.label ?? item.prop.kind;
      return `${label} on floor ${floor.number} at column ${item.prop.x + 1}, row ${item.prop.y + 1} overlaps stairs, a portal or their connection labels. Move the object or choose another position.`;
    }
    const other = items.find(
      (other) => other.id !== item.id && towerObjectsCollide(item.prop, other.prop),
    );
    if (other) {
      const a = propBounds(item.prop),
        b = propBounds(other.prop),
        label = (p: Prop) => towerCapability(p.kind)?.label ?? p.kind;
      return `${label(item.prop)} overlaps ${label(other.prop)} on floor ${floor.number} at column ${Math.max(a.x, b.x) + 1}, row ${Math.max(a.y, b.y) + 1}. Move one of the objects.`;
    }
  }
  for (const floor of map.layout.floors) {
    const cells = new Set<number>();
    for (let y = floor.y; y < floor.y + floor.height; y++)
      for (let x = floor.x; x < floor.x + floor.width; x++)
        if (map.layout.tiles[y * width + x]) cells.add(y * width + x);
    const blocked = new Set(
      items
        .filter((i) => i.prop.blocking && towerFloorAt(map, i.prop)?.number === floor.number)
        .flatMap((i) => propCells(i.prop))
        .map((p) => p.y * width + p.x),
    );
    if (blocked.size > Math.floor(cells.size * DENSITY_BUDGETS[map.decoration.density]))
      return `Floor ${floor.number} has reached its blocking limit. Remove a solid object or choose a surface.`;
    const first = [...cells].find((i) => !blocked.has(i));
    if (first === undefined) return `Keep floor ${floor.number} reachable.`;
    const reached = new Set([first]),
      queue = [first];
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i];
      if (current === undefined) continue;
      for (const next of [current - 1, current + 1, current - width, current + width])
        if (cells.has(next) && !blocked.has(next) && !reached.has(next)) {
          reached.add(next);
          queue.push(next);
        }
    }
    if (reached.size !== cells.size - blocked.size)
      return `Keep every open part of floor ${floor.number} reachable from its connections.`;
  }
  return undefined;
}
