import { isBlockingProp } from '../model';
import type { PropKind } from '../model';
import type { ObjectCapability } from './catalog';
/** Frozen Tower editing vocabulary. Group membership is instance-based: ordinary
 * desks and shelves remain independent even when an addition uses the same kind. */
const TOWER_OBJECTS_V1 = {
  crate: { label: 'Crate', category: 'Storage', editable: true },
  barrel: { label: 'Barrel', category: 'Storage', editable: true },
  bookshelf: { label: 'Bookshelf', category: 'Storage', editable: true },
  desk: { label: 'Desk', category: 'Storage', editable: true },
  scroll_case: { label: 'Scroll case', category: 'Storage', editable: true },
  ritual_altar: { label: 'Altar', category: 'Stonework', editable: true },
  ritual_candles: { label: 'Candles', category: 'Storage', editable: true },
  ritual_offering: { label: 'Offering', category: 'Storage', editable: true },
  bedroll: { label: 'Bedroll', category: 'Ground', editable: true },
  moss: { label: 'Moss', category: 'Ground', editable: true },
  cauldron: { label: 'Cauldron', category: 'Protected', editable: false },
  telescope: { label: 'Telescope', category: 'Protected', editable: false },
  star_chart_table: { label: 'Star-chart table', category: 'Protected', editable: false },
  instrument_cabinet: { label: 'Instrument cabinet', category: 'Protected', editable: false },
  star_charts: { label: 'Star charts', category: 'Protected', editable: false },
} as const satisfies Partial<Record<PropKind, ObjectCapability>>;
export function towerCapability(kind: PropKind): ObjectCapability | undefined {
  return Object.hasOwn(TOWER_OBJECTS_V1, kind)
    ? TOWER_OBJECTS_V1[kind as keyof typeof TOWER_OBJECTS_V1]
    : undefined;
}
export const TOWER_PALETTE = Object.entries(TOWER_OBJECTS_V1)
  .filter(([, c]) => c.editable)
  .map(([kind, c]) => ({
    kind: kind as PropKind,
    label: c.label,
    category: c.category,
    blocking: isBlockingProp(kind as PropKind),
  }));
export function isTowerSurface(kind: PropKind): boolean {
  return kind === 'moss' || kind === 'bedroll';
}
