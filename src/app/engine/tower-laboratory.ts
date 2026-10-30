import type { Point, Prop } from './model';
import type { Tower } from './tower';
import { placeTowerPropPack } from './tower-prop-pack';
export { towerPackFloorUsable as laboratoryFloorUsable } from './tower-prop-pack';

// The laboratory fills the central encounter area of one floor, the way a dungeon
// ritual site fills a chamber. Perimeter objects stay out in their ring.
const ARRANGEMENT = [
  { x: 7, y: 5, kind: 'cauldron' },
  { x: 5, y: 6, kind: 'desk' },
  { x: 9, y: 6, kind: 'bookshelf' },
  { x: 6, y: 8, kind: 'scroll_case' },
  { x: 8, y: 8, kind: 'ritual_candles' },
] as const satisfies readonly (Point & { readonly kind: Prop['kind'] })[];

export function towerLaboratoryProps(
  layout: Tower['layout'],
  floorNumber: number,
  reserved: (p: Point) => boolean,
): readonly Prop[] | undefined {
  return placeTowerPropPack(layout, floorNumber, reserved, ARRANGEMENT);
}
