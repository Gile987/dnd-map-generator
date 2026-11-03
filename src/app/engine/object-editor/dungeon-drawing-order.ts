import { areasOverlap } from '../feature-reservation';
import { isDungeonSurface } from './dungeon-occupancy';
import { authoredObjectArea } from './object-geometry';
import type { AddedObject } from './document';

/** Shared by artwork, picking and overlap information. Never changes occupancy. */
export function orderedDungeonObjects(
  items: readonly AddedObject[],
  order: readonly string[] = [],
): readonly AddedObject[] {
  if (!order.length)
    return [
      ...items.filter(({ prop }) => isDungeonSurface(prop.kind)),
      ...items.filter(({ prop }) => !isDungeonSurface(prop.kind)),
    ];
  const positions = new Map(order.map((id, i) => [id, i]));
  return [...items].sort((a, b) => (positions.get(a.id) ?? -1) - (positions.get(b.id) ?? -1));
}

export interface DrawingUnit {
  readonly id: string;
  readonly members: readonly string[];
}

/** Ignore reordered pairs that do not overlap: they cannot change the artwork. */
export function hasCustomDungeonOrder(
  items: readonly AddedObject[],
  order: readonly string[],
): boolean {
  if (!order.length) return false;
  const defaults = orderedDungeonObjects(items);
  const positions = new Map(order.map((id, i) => [id, i]));
  return defaults.some((item, i) =>
    defaults
      .slice(i + 1)
      .some(
        (other) =>
          (positions.get(item.id) ?? -1) > (positions.get(other.id) ?? -1) &&
          areasOverlap(authoredObjectArea(item.prop), authoredObjectArea(other.prop)),
      ),
  );
}
export interface DungeonOverlap {
  readonly id: string;
  readonly underneath: readonly string[];
}

/** Count overlapping objects, excluding the fixed components of the same addition.
 * Bounds describe authored artwork, not pixel opacity or simulated cloth physics.
 */
export function dungeonOverlaps(
  ordered: readonly AddedObject[],
  units: readonly DrawingUnit[],
): readonly DungeonOverlap[] {
  const owner = new Map(units.flatMap((unit) => unit.members.map((id) => [id, unit.id] as const)));
  return ordered.flatMap((top, i) => {
    const underneath = ordered
      .slice(0, i)
      .filter(
        (item) =>
          owner.get(item.id) !== owner.get(top.id) &&
          areasOverlap(authoredObjectArea(item.prop), authoredObjectArea(top.prop)),
      )
      .map((item) => item.id);
    return underneath.length ? [{ id: top.id, underneath }] : [];
  });
}

/** One step past the nearest overlapping unit. Additions keep their internal order. */
export function stepDungeonOrder(
  items: readonly AddedObject[],
  order: readonly string[],
  units: readonly DrawingUnit[],
  id: string,
  direction: 'forward' | 'backward',
): readonly string[] {
  const current = orderedDungeonObjects(items, order);
  const unit = units.find((unit) => unit.id === id);
  if (!unit) return current.map((item) => item.id);
  const moving = current.filter((item) => unit.members.includes(item.id));
  const candidates = current.filter((item) => !unit.members.includes(item.id));
  const search = direction === 'forward' ? candidates : [...candidates].reverse();
  const target = search.find((other) =>
    moving.some(
      (item) =>
        (direction === 'forward'
          ? current.indexOf(other) > current.indexOf(item)
          : current.indexOf(other) < current.indexOf(item)) &&
        areasOverlap(authoredObjectArea(item.prop), authoredObjectArea(other.prop)),
    ),
  );
  if (!target) return current.map((item) => item.id);
  const other = units.find((unit) => unit.members.includes(target.id));
  const indices = candidates.flatMap((item, i) => (other?.members.includes(item.id) ? [i] : []));
  const index = direction === 'forward' ? Math.max(...indices) + 1 : Math.min(...indices);
  return [...candidates.slice(0, index), ...moving, ...candidates.slice(index)].map(
    (item) => item.id,
  );
}
