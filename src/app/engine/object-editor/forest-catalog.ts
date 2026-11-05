import { isBlockingProp } from '../model';
import type { ForestPropKind, PropKind } from '../model';
import type { ObjectCapability } from './catalog';

/** Frozen Forest editing vocabulary, independent of future generator additions. */
const FOREST_OBJECTS_V1 = {
  boulder: { label: 'Boulder', category: 'Stonework', editable: true },
  log: { label: 'Log', category: 'Woodland', editable: true },
  stump: { label: 'Stump', category: 'Woodland', editable: true },
  bush: { label: 'Bush', category: 'Vegetation', editable: true },
  fern: { label: 'Fern', category: 'Vegetation', editable: true },
  mushroom: { label: 'Mushrooms', category: 'Vegetation', editable: true },
  flower: { label: 'Flowers', category: 'Vegetation', editable: true },
  tree: {
    label: 'Tree',
    category: 'Protected',
    editable: false,
    reason: 'Trees form the fixed forest boundary.',
  },
  tent: { label: 'Tent', category: 'Protected', editable: false },
  bedroll: { label: 'Bedroll', category: 'Protected', editable: false },
  fire_ring: { label: 'Fire ring', category: 'Protected', editable: false },
  supply_bundle: { label: 'Supply bundle', category: 'Protected', editable: false },
  standing_stone: { label: 'Standing stone', category: 'Protected', editable: false },
  fallen_trunk: { label: 'Fallen trunk', category: 'Protected', editable: false },
  fallen_roots: { label: 'Exposed roots', category: 'Protected', editable: false },
  fallen_branch: { label: 'Fallen branch', category: 'Protected', editable: false },
  fallen_fungi: { label: 'Fallen-tree fungi', category: 'Protected', editable: false },
} as const satisfies Record<ForestPropKind, ObjectCapability>;
export function forestCapability(kind: PropKind): ObjectCapability | undefined {
  return Object.hasOwn(FOREST_OBJECTS_V1, kind)
    ? FOREST_OBJECTS_V1[kind as keyof typeof FOREST_OBJECTS_V1]
    : undefined;
}
export const FOREST_PALETTE = Object.entries(FOREST_OBJECTS_V1)
  .filter(([, entry]) => entry.editable)
  .map(([kind, entry]) => ({
    kind: kind as PropKind,
    label: entry.label,
    category: entry.category,
    blocking: isBlockingProp(kind as PropKind),
  }));
export function isForestGroundCover(kind: PropKind): boolean {
  return (
    kind === 'bush' ||
    kind === 'fern' ||
    kind === 'mushroom' ||
    kind === 'flower' ||
    kind === 'fallen_fungi'
  );
}
/** The generated renderer's original passes, including passable physical camp
 * components. Drawing order is deliberately separate from movement blocking. */
export function forestDrawsBelowObjects(kind: PropKind): boolean {
  return (
    isForestGroundCover(kind) ||
    kind === 'bedroll' ||
    kind === 'fire_ring' ||
    kind === 'fallen_branch'
  );
}
