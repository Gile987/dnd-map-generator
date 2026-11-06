import { resolvedTowerLayout } from './tower-stairs';
import type { TowerStairMove } from './tower-stairs';
import type { Tower } from '../tower';
import { towerConnectionReserved } from '../tower';
import { towerLaboratoryProps } from '../tower-laboratory';
import { towerObservatoryProps } from '../tower-observatory';
import type { Prop, QuarterTurn } from '../model';
import type { AddedObject } from './document';
import type { ObjectGroup } from './object-group';
import type { ArrangementEdits, AuthoredArrangement } from './arrangement';
import { arrangementInstances, arrangementArtTurns } from './arrangement';
import { transformedGroup } from './group-rotation';
import { orderedObjects } from './drawing-order';
import { isTowerSurface } from './tower-catalog';
export type TowerGroupId = 'laboratory' | 'observatory';
export type TowerEditsV1 = ArrangementEdits<TowerGroupId>;
export interface TowerEditsV2 extends Omit<TowerEditsV1, 'version'> {
  readonly version: 2;
  readonly stairs: readonly TowerStairMove[];
}
export type AuthoredTower = Omit<Tower, 'objectEdits'> & {
  readonly objectEdits: TowerEditsV1 | TowerEditsV2;
};
/** Project only furniture edits for the shared version-1 arrangement reducer. */
export function towerObjectDocument(
  map: TowerDocument,
): Tower | AuthoredArrangement<Tower, TowerGroupId> {
  if (!map.objectEdits) return towerBase(map);
  if (map.objectEdits.version === 1) return { ...towerBase(map), objectEdits: map.objectEdits };
  const { stairs: _stairs, ...edits } = map.objectEdits;
  return { ...map, objectEdits: { ...edits, version: 1 } };
}
export type TowerDocument = Tower | AuthoredTower;
export interface ResolvedTower extends Omit<Tower, 'objectEdits'> {
  readonly objectEdits: 'resolved';
  readonly instances: readonly AddedObject[];
  readonly order: readonly string[];
  readonly artTurns: ReadonlyMap<Prop, QuarterTurn>;
}
export type TowerDrawing = Tower | ResolvedTower;
export function towerBase(map: TowerDocument): Tower {
  if (!map.objectEdits) return map;
  const { objectEdits: _edits, ...base } = map;
  return base;
}
export function towerGroups(base: Tower): readonly ObjectGroup<TowerGroupId>[] {
  const groups: ObjectGroup<TowerGroupId>[] = [];
  for (const [id, label, floor, pack] of [
    ['laboratory', 'Alchemist’s laboratory', base.decoration.laboratoryFloor, towerLaboratoryProps],
    ['observatory', 'Tower observatory', base.decoration.observatoryFloor, towerObservatoryProps],
  ] as const) {
    if (floor === undefined) continue;
    const expected = pack(base.layout, floor, (p) =>
      towerConnectionReserved(base.layout, p, base.version),
    );
    if (!expected) continue;
    const items = base.decoration.props.flatMap((prop, i) =>
      expected.some((p) => p.x === prop.x && p.y === prop.y && p.kind === prop.kind)
        ? [{ id: `base-${i}`, prop }]
        : [],
    );
    if (!items.length) continue;
    const x = Math.min(...items.map((i) => i.prop.x)),
      y = Math.min(...items.map((i) => i.prop.y));
    groups.push({
      id,
      label,
      members: items.map((i) => i.id),
      area: {
        x,
        y,
        width: Math.max(...items.map((i) => i.prop.x + 1)) - x,
        height: Math.max(...items.map((i) => i.prop.y + 1)) - y,
      },
    });
  }
  return groups;
}
export function currentTowerGroups(map: TowerDocument): readonly ObjectGroup<TowerGroupId>[] {
  return towerGroups(towerBase(map)).map((group) =>
    transformedGroup(
      group,
      map.objectEdits?.groups.find((move) => move.id === group.id),
    ),
  );
}
export function towerInstances(map: TowerDocument): readonly AddedObject[] {
  return arrangementInstances(
    map.decoration.props,
    map.objectEdits && { ...map.objectEdits, version: 1 },
    towerGroups(towerBase(map)),
  );
}
export function orderedTowerObjects(
  map: TowerDocument,
  items = towerInstances(map),
): readonly AddedObject[] {
  const cover = items.filter((i) => i.id.startsWith('added-') && isTowerSurface(i.prop.kind)),
    ids = new Set(cover.map((i) => i.id));
  return orderedObjects(
    [...cover, ...items.filter((i) => !ids.has(i.id))],
    map.objectEdits?.order ?? [],
  );
}
export function resolveTower(map: TowerDocument): TowerDrawing {
  if (!map.objectEdits) return map;
  const items = towerInstances(map);
  return {
    ...towerBase(map),
    objectEdits: 'resolved',
    layout: resolvedTowerLayout(map),
    instances: items,
    order: orderedTowerObjects(map, items).map((i) => i.id),
    artTurns: arrangementArtTurns(items, towerGroups(towerBase(map)), {
      ...map.objectEdits,
      version: 1,
    }),
    decoration: { ...map.decoration, props: items.map((i) => i.prop) },
  };
}
