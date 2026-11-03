import { isBlockingProp } from '../model';
import type { DungeonPropKind, PropKind } from '../model';

export interface ObjectCapability {
  readonly label: string;
  readonly category: 'Storage' | 'Stonework' | 'Ground' | 'Protected';
  readonly editable: boolean;
  readonly reason?: string;
}
const group = 'Part of an addition. Its complete arrangement is protected.';
const attachment = 'Needs a wall attachment; this editor supports independent objects.';
/** Version-1 authored vocabulary. Expanding capabilities needs a save compatibility decision. */
export const DUNGEON_OBJECTS_V1 = {
  crate: { label: 'Crate', category: 'Storage', editable: true },
  barrel: { label: 'Barrel', category: 'Storage', editable: true },
  rubble: { label: 'Rubble', category: 'Stonework', editable: true },
  sarcophagus: { label: 'Sarcophagus', category: 'Stonework', editable: true },
  broken_column: { label: 'Broken column', category: 'Stonework', editable: true },
  moss: { label: 'Moss', category: 'Ground', editable: true },
  rug: {
    label: 'Rug',
    category: 'Protected',
    editable: false,
    reason: 'Its artwork spans several squares; rug editing is not available yet.',
  },
  sconce: { label: 'Wall sconce', category: 'Protected', editable: false, reason: attachment },
  vine: { label: 'Vine', category: 'Protected', editable: false, reason: attachment },
  desk: { label: 'Writing desk', category: 'Protected', editable: false, reason: group },
  bookshelf: { label: 'Bookshelf', category: 'Protected', editable: false, reason: group },
  scroll_case: { label: 'Scroll case', category: 'Protected', editable: false, reason: group },
  ritual_altar: { label: 'Ritual altar', category: 'Protected', editable: false, reason: group },
  ritual_candles: {
    label: 'Ritual candles',
    category: 'Protected',
    editable: false,
    reason: group,
  },
  ritual_offering: {
    label: 'Ritual offering',
    category: 'Protected',
    editable: false,
    reason: group,
  },
  weathered_statue: {
    label: 'Weathered statue',
    category: 'Protected',
    editable: false,
    reason: group,
  },
  dining_table: { label: 'Dining table', category: 'Protected', editable: false, reason: group },
} as const satisfies Readonly<Record<DungeonPropKind, ObjectCapability>>;

export const DUNGEON_OBJECTS_V2 = {
  ...DUNGEON_OBJECTS_V1,
  rug: { label: 'Rug', category: 'Ground', editable: true },
} as const;

export function dungeonCapability(
  kind: PropKind,
  version: 1 | 2 | 3 | 4 | 5 = 1,
): ObjectCapability | undefined {
  return Object.hasOwn(DUNGEON_OBJECTS_V1, kind)
    ? (version !== 1 ? DUNGEON_OBJECTS_V2 : DUNGEON_OBJECTS_V1)[kind as DungeonPropKind]
    : undefined;
}

export const DUNGEON_PALETTE = Object.entries(DUNGEON_OBJECTS_V1)
  .filter(([, capability]) => capability.editable)
  .map(([kind, capability]) => ({
    kind: kind as DungeonPropKind,
    blocking: isBlockingProp(kind as DungeonPropKind),
    ...capability,
  }));

export const DUNGEON_PALETTE_V2 = Object.entries(DUNGEON_OBJECTS_V2)
  .filter(([, capability]) => capability.editable)
  .map(([kind, capability]) => ({
    kind: kind as DungeonPropKind,
    blocking: isBlockingProp(kind as DungeonPropKind),
    ...capability,
  }));
