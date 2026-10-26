import type { MapType } from './model';

// IDs are persisted; labels and descriptions can change independently.
export const LANDMARK_CATALOG = {
  'weathered-statue': {
    label: 'Weathered statue',
    mapTypes: ['dungeon'],
    description:
      'A weathered stone figure on a plinth. One blocking tile with clear space around it.',
  },
  'standing-stone-circle': {
    label: 'Standing-stone circle',
    mapTypes: ['forest'],
    description:
      'Six standing stones around a clear center. Each stone blocks one tile; gaps stay open.',
  },
} as const satisfies Record<
  string,
  {
    readonly label: string;
    readonly mapTypes: readonly MapType[];
    readonly description: string;
  }
>;

export type LandmarkId = keyof typeof LANDMARK_CATALOG;
export type LandmarkIdFor<T extends MapType> = {
  [K in LandmarkId]: T extends (typeof LANDMARK_CATALOG)[K]['mapTypes'][number] ? K : never;
}[LandmarkId];

export function landmarkIdsFor<T extends MapType>(type: T): readonly LandmarkIdFor<T>[] {
  return (Object.keys(LANDMARK_CATALOG) as LandmarkId[]).filter((id): id is LandmarkIdFor<T> => {
    const types: readonly MapType[] = LANDMARK_CATALOG[id].mapTypes;
    return types.includes(type);
  });
}
