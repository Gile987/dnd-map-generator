import { sharedObjectCapabilities } from '../shared-props';
import { isBlockingProp } from '../model';
import type { PropKind } from '../model';

import type { ObjectCapability } from '../shared-props';
export type { ObjectCapability } from '../shared-props';

const group = 'Part of an addition. Its complete arrangement is protected.';
const attachment = 'Needs a wall attachment; this editor supports independent objects.';
/** Current authored vocabulary. Expanding capabilities needs a save format decision. */
export const DUNGEON_OBJECTS = {
  ...sharedObjectCapabilities('dungeon'),
  rubble: { label: 'Rubble', category: 'Stonework', editable: true },
  sarcophagus: { label: 'Sarcophagus', category: 'Stonework', editable: true },
  broken_column: { label: 'Broken column', category: 'Stonework', editable: true },
  rug: { label: 'Rug', category: 'Ground', editable: true },
  sconce: { label: 'Wall sconce', category: 'Protected', editable: false, reason: attachment },
  vine: { label: 'Vine', category: 'Protected', editable: false, reason: attachment },
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
} as const satisfies Readonly<Partial<Record<PropKind, ObjectCapability>>>;

export function dungeonCapability(kind: PropKind): ObjectCapability | undefined {
  return Object.hasOwn(DUNGEON_OBJECTS, kind)
    ? DUNGEON_OBJECTS[kind as keyof typeof DUNGEON_OBJECTS]
    : undefined;
}

export const DUNGEON_PALETTE = Object.entries(DUNGEON_OBJECTS)
  .filter((entry): entry is [string, ObjectCapability] => !!entry[1]?.editable)
  .map(([kind, capability]) => ({
    kind: kind as PropKind,
    blocking: isBlockingProp(kind as PropKind),
    ...capability,
  }));
