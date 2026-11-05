import { isDungeonSurface } from './dungeon-occupancy';
import {
  orderedObjects,
  objectOverlaps,
  hasCustomObjectOrder,
  stepObjectOrder,
} from './drawing-order';
import type { DrawingUnit } from './drawing-order';
import type { AddedObject } from './document';
export type { DrawingUnit, ObjectOverlap as DungeonOverlap } from './drawing-order';
export const dungeonOverlaps = objectOverlaps;

export function orderedDungeonObjects(
  items: readonly AddedObject[],
  order: readonly string[] = [],
): readonly AddedObject[] {
  return order.length
    ? orderedObjects(items, order)
    : [
        ...items.filter(({ prop }) => isDungeonSurface(prop.kind)),
        ...items.filter(({ prop }) => !isDungeonSurface(prop.kind)),
      ];
}
export function hasCustomDungeonOrder(
  items: readonly AddedObject[],
  order: readonly string[],
): boolean {
  return hasCustomObjectOrder(orderedDungeonObjects(items), order);
}
export function stepDungeonOrder(
  items: readonly AddedObject[],
  order: readonly string[],
  units: readonly DrawingUnit[],
  id: string,
  direction: 'forward' | 'backward',
): readonly string[] {
  return stepObjectOrder(orderedDungeonObjects(items, order), units, id, direction);
}
