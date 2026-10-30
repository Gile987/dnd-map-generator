import type { Point, Prop } from './model';
import type { Tower } from './tower';
import { placeTowerPropPack } from './tower-prop-pack';

// Save-format-16 arrangement: layout-only placement keeps the instruments fixed on shuffle.
const ARRANGEMENT = [
  { x: 7, y: 5, kind: 'telescope' },
  { x: 5, y: 7, kind: 'star_chart_table' },
  { x: 9, y: 7, kind: 'instrument_cabinet' },
  { x: 7, y: 9, kind: 'star_charts' },
] as const satisfies readonly (Point & { readonly kind: Prop['kind'] })[];

export function towerObservatoryProps(
  layout: Tower['layout'],
  floorNumber: number,
  reserved: (p: Point) => boolean,
): readonly Prop[] | undefined {
  return placeTowerPropPack(layout, floorNumber, reserved, ARRANGEMENT);
}
