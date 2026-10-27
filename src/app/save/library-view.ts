import type { MapType } from '../engine/model';
import type { SavedMap } from './save-format';

export const LIBRARY_SORT_OPTIONS = [
  { value: 'favorites', label: 'Favorites first' },
  { value: 'newest', label: 'Newest first' },
  { value: 'name', label: 'Name A–Z' },
] as const;

export interface LibraryView {
  readonly query: string;
  readonly mapType: 'all' | MapType;
  readonly favoritesOnly: boolean;
  readonly sort: (typeof LIBRARY_SORT_OPTIONS)[number]['value'];
}

export const DEFAULT_LIBRARY_VIEW: LibraryView = {
  query: '',
  mapType: 'all',
  favoritesOnly: false,
  sort: 'favorites',
};

const names = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

function newestFirst(a: SavedMap, b: SavedMap): number {
  // Older imported records can lack a usable timestamp; keep them browsable.
  const aTime = Date.parse(a.savedAt);
  const bTime = Date.parse(b.savedAt);
  const left = Number.isNaN(aTime) ? -Infinity : aTime;
  const right = Number.isNaN(bTime) ? -Infinity : bTime;
  return left === right ? 0 : left > right ? -1 : 1;
}

export function viewSavedMaps(
  records: readonly SavedMap[],
  view: LibraryView,
): readonly SavedMap[] {
  const query = view.query.trim().toLowerCase();
  return records
    .filter(
      (record) =>
        (view.mapType === 'all' || record.map.type === view.mapType) &&
        (!view.favoritesOnly || record.favorite) &&
        (!query ||
          record.name.toLowerCase().includes(query) ||
          record.map.seed.toLowerCase().includes(query)),
    )
    .sort((a, b) => {
      const name = names.compare(a.name, b.name);
      const newest = newestFirst(a, b);
      const id = a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      if (view.sort === 'name') return name || newest || id;
      const favorite = view.sort === 'favorites' ? Number(b.favorite) - Number(a.favorite) : 0;
      return favorite || newest || name || id;
    });
}
