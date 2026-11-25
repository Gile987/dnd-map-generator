import type { MapType } from './model';

export interface ObjectCapability {
  readonly label: string;
  readonly category:
    'Storage' | 'Furniture' | 'Stonework' | 'Ground' | 'Vegetation' | 'Woodland' | 'Protected';
  readonly editable: boolean;
  readonly reason?: string;
}
interface SharedPropDefinition {
  readonly label: string;
  readonly category: ObjectCapability['category'];
  readonly blocking: boolean;
  readonly mapTypes: readonly MapType[];
}

/** Shared placeable props. Availability does not add them to generation. */
export const SHARED_PROPS = {
  treasure_chest: {
    label: 'Treasure chest',
    category: 'Storage',
    blocking: true,
    mapTypes: ['dungeon', 'forest', 'courtyard', 'tower'],
  },
  supply_sacks: {
    label: 'Supply sacks',
    category: 'Storage',
    blocking: true,
    mapTypes: ['dungeon', 'forest', 'courtyard', 'tower'],
  },
  weapon_rack: {
    label: 'Weapon rack',
    category: 'Storage',
    blocking: true,
    mapTypes: ['dungeon', 'forest', 'courtyard', 'tower'],
  },
  crate: {
    label: 'Crate',
    category: 'Storage',
    blocking: true,
    mapTypes: ['dungeon', 'forest', 'courtyard', 'tower'],
  },
  barrel: {
    label: 'Barrel',
    category: 'Storage',
    blocking: true,
    mapTypes: ['dungeon', 'forest', 'courtyard', 'tower'],
  },
  bedroll: {
    label: 'Bedroll',
    category: 'Ground',
    blocking: false,
    mapTypes: ['dungeon', 'forest', 'courtyard', 'tower'],
  },
  moss: {
    label: 'Moss',
    category: 'Ground',
    blocking: false,
    mapTypes: ['dungeon', 'forest', 'courtyard', 'tower'],
  },
  fern: {
    label: 'Fern',
    category: 'Vegetation',
    blocking: false,
    mapTypes: ['dungeon', 'forest', 'courtyard', 'tower'],
  },
  log: { label: 'Log', category: 'Woodland', blocking: true, mapTypes: ['forest', 'courtyard'] },
  stump: {
    label: 'Stump',
    category: 'Woodland',
    blocking: true,
    mapTypes: ['forest', 'courtyard'],
  },
  desk: { label: 'Desk', category: 'Storage', blocking: true, mapTypes: ['dungeon', 'tower'] },
  bookshelf: {
    label: 'Bookshelf',
    category: 'Storage',
    blocking: true,
    mapTypes: ['dungeon', 'tower'],
  },
  wooden_bench: {
    label: 'Wooden bench',
    category: 'Furniture',
    blocking: true,
    mapTypes: ['dungeon', 'forest', 'courtyard', 'tower'],
  },
  wooden_bed: {
    label: 'Wooden bed',
    category: 'Furniture',
    blocking: true,
    mapTypes: ['dungeon', 'tower'],
  },
  small_table: {
    label: 'Small table',
    category: 'Furniture',
    blocking: true,
    mapTypes: ['dungeon', 'forest', 'courtyard', 'tower'],
  },
} as const satisfies Readonly<Record<string, SharedPropDefinition>>;

export type SharedPropKind = keyof typeof SHARED_PROPS;
export const SHARED_PROP_KINDS: readonly SharedPropKind[] = Object.keys(
  SHARED_PROPS,
) as SharedPropKind[];

export function sharedPropDefinition(kind: string): SharedPropDefinition | undefined {
  return Object.hasOwn(SHARED_PROPS, kind) ? SHARED_PROPS[kind as SharedPropKind] : undefined;
}

export function sharedObjectCapabilities(
  mapType: MapType,
): Partial<Record<SharedPropKind, ObjectCapability>> {
  const result: Partial<Record<SharedPropKind, ObjectCapability>> = {};
  for (const kind of SHARED_PROP_KINDS) {
    const definition = SHARED_PROPS[kind];
    const mapTypes: readonly MapType[] = definition.mapTypes;
    if (mapTypes.includes(mapType)) {
      result[kind] = { label: definition.label, category: definition.category, editable: true };
    }
  }
  return result;
}
