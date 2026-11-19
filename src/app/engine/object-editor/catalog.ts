import { isBlockingProp } from '../model';
import type { DungeonPropKind, PropKind } from '../model';

export interface ObjectCapability {
  readonly label: string;
  readonly category: 'Storage' | 'Stonework' | 'Ground' | 'Vegetation' | 'Woodland' | 'Protected';
  readonly editable: boolean;
  readonly reason?: string;
}
const group = 'Part of an addition. Its complete arrangement is protected.';
const attachment = 'Needs a wall attachment; this editor supports independent objects.';
/** Current authored vocabulary. Expanding capabilities needs a save format decision. */
export const DUNGEON_OBJECTS = {
  crate: { label: 'Crate', category: 'Storage', editable: true },
  barrel: { label: 'Barrel', category: 'Storage', editable: true },
  rubble: { label: 'Rubble', category: 'Stonework', editable: true },
  sarcophagus: { label: 'Sarcophagus', category: 'Stonework', editable: true },
  broken_column: { label: 'Broken column', category: 'Stonework', editable: true },
  moss: { label: 'Moss', category: 'Ground', editable: true },
  rug: { label: 'Rug', category: 'Ground', editable: true },
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

export function dungeonCapability(kind: PropKind): ObjectCapability | undefined {
  return Object.hasOwn(DUNGEON_OBJECTS, kind)
    ? DUNGEON_OBJECTS[kind as DungeonPropKind]
    : undefined;
}

export const DUNGEON_PALETTE = Object.entries(DUNGEON_OBJECTS)
  .filter(([, capability]) => capability.editable)
  .map(([kind, capability]) => ({
    kind: kind as DungeonPropKind,
    blocking: isBlockingProp(kind as DungeonPropKind),
    ...capability,
  }));
