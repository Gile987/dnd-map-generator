import { isBlockingProp } from '../model';
import type { PropKind } from '../model';
import type { ObjectCapability } from './catalog';

/** Frozen first Courtyard editing vocabulary. New kinds require a compatibility decision. */
const COURTYARD_OBJECTS_V1 = {
  broken_column: { label: 'Broken column', category: 'Stonework', editable: true },
  low_rubble: { label: 'Low rubble', category: 'Ground', editable: true },
  moss: { label: 'Moss', category: 'Ground', editable: true },
  fern: { label: 'Fern', category: 'Vegetation', editable: true },
  vine: {
    label: 'Vine',
    category: 'Protected',
    editable: false,
    reason: 'Vines remain protected in this editor.',
  },
  dry_fountain: { label: 'Dry fountain', category: 'Protected', editable: false },
  collapsed_wagon: { label: 'Collapsed wagon', category: 'Protected', editable: false },
  spilled_crate: { label: 'Spilled crate', category: 'Protected', editable: false },
  wagon_wheel: { label: 'Detached wheel', category: 'Protected', editable: false },
  spilled_goods: { label: 'Loose goods', category: 'Protected', editable: false },
} as const satisfies Partial<Record<PropKind, ObjectCapability>>;

export function courtyardCapability(kind: PropKind): ObjectCapability | undefined {
  return Object.hasOwn(COURTYARD_OBJECTS_V1, kind)
    ? COURTYARD_OBJECTS_V1[kind as keyof typeof COURTYARD_OBJECTS_V1]
    : undefined;
}
export const COURTYARD_PALETTE = Object.entries(COURTYARD_OBJECTS_V1)
  .filter(([, capability]) => capability.editable)
  .map(([kind, capability]) => ({
    kind: kind as PropKind,
    blocking: isBlockingProp(kind as PropKind),
    ...capability,
  }));

export function isCourtyardSurface(kind: PropKind): boolean {
  return kind === 'moss' || kind === 'low_rubble';
}

/** Decorative ground cover can stay beneath physical objects. Passability alone
 * does not imply ground cover: detached wheels and loose goods remain physical.
 */
export function isCourtyardGroundCover(kind: PropKind): boolean {
  return isCourtyardSurface(kind) || kind === 'fern' || kind === 'vine';
}
