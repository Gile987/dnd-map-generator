import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import type { GeneratedMap } from '../engine/model';
import {
  SAVE_STORAGE_KEY,
  duplicateName,
  makeSavedMap,
  normalizeName,
  parseSavedMap,
  serializeBundle,
  uniqueById,
} from './save-format';
import type { SavedMap } from './save-format';

type StoredLibrary =
  | { readonly kind: 'ready'; readonly raw: string | null; readonly records: readonly SavedMap[] }
  | {
      readonly kind: 'partial';
      readonly raw: string;
      readonly records: readonly SavedMap[];
      readonly unreadable: number;
      readonly duplicates: number;
    }
  | { readonly kind: 'invalid'; readonly raw: string; readonly records: readonly SavedMap[] }
  | { readonly kind: 'unavailable'; readonly records: readonly SavedMap[] };

interface LibraryChange<T> {
  readonly records: readonly SavedMap[];
  readonly result: T;
}

const WRITE_LOCK = `${SAVE_STORAGE_KEY}.write`;
const LOCKS_UNAVAILABLE =
  'Saving is unavailable in this browser or connection. You can still open maps and download backups.';

function readLibrary(previous?: StoredLibrary): StoredLibrary {
  let raw: string | null;
  try {
    raw = localStorage.getItem(SAVE_STORAGE_KEY);
  } catch {
    return { kind: 'unavailable', records: previous?.records ?? [] };
  }
  if (previous && previous.kind !== 'unavailable' && previous.raw === raw) return previous;
  if (raw === null) return { kind: 'ready', raw, records: [] };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { kind: 'invalid', raw, records: [] };
  }
  if (!Array.isArray(data)) return { kind: 'invalid', raw, records: [] };
  const records: SavedMap[] = [];
  const ids = new Set<string>();
  let unreadable = 0;
  let duplicates = 0;
  for (const value of data) {
    const record = parseSavedMap(value);
    if (!record) {
      unreadable++;
    } else if (ids.has(record.id)) {
      duplicates++;
    } else {
      ids.add(record.id);
      records.push(record);
    }
  }
  return unreadable || duplicates
    ? { kind: 'partial', raw, records, unreadable, duplicates }
    : { kind: 'ready', raw, records };
}

function libraryProblem(library: StoredLibrary): string {
  switch (library.kind) {
    case 'ready':
      return '';
    case 'unavailable':
      return 'Your browser could not read the saved library. Changes are paused. Retry when browser storage is available.';
    case 'invalid':
      return 'The saved library could not be read. Its original data is preserved. Download recovery data before repairing it, then retry. Changes are paused.';
    case 'partial': {
      const issues = [
        library.unreadable > 0
          ? `${library.unreadable} unreadable ${library.unreadable === 1 ? 'entry' : 'entries'}`
          : '',
        library.duplicates > 0
          ? `${library.duplicates} duplicate ${library.duplicates === 1 ? 'entry' : 'entries'}`
          : '',
      ].filter(Boolean);
      return `The saved library contains ${issues.join(' and ')}. Readable maps are available and the original data is preserved. Download recovery data before repairing it, then retry. Changes are paused.`;
    }
  }
}

function requireRecord(records: readonly SavedMap[], id: string): SavedMap {
  const record = records.find((candidate) => candidate.id === id);
  if (!record)
    throw new Error(
      'That map is no longer in the library. It may have been deleted in another tab.',
    );
  return record;
}

@Injectable({ providedIn: 'root' })
export class SaveStore {
  private readonly state = signal<StoredLibrary>(readLibrary());
  private readonly locks: LockManager | undefined = navigator.locks;
  readonly saved = computed(() => this.state().records);
  readonly problem = computed(
    () => libraryProblem(this.state()) || (!this.locks ? LOCKS_UNAVAILABLE : ''),
  );
  readonly canWrite = computed(() => this.state().kind === 'ready' && this.locks !== undefined);
  readonly recoveryData = computed(() => {
    const state = this.state();
    return state.kind === 'partial' || state.kind === 'invalid' ? state.raw : null;
  });

  constructor() {
    const changed = (event: StorageEvent): void => {
      if (event.key === SAVE_STORAGE_KEY || event.key === null) this.reload();
    };
    window.addEventListener('storage', changed);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('storage', changed));
  }

  reload(): void {
    this.state.set(readLibrary(this.state()));
  }

  async add(map: GeneratedMap, name: string, thumbnail: string): Promise<SavedMap> {
    const record = makeSavedMap(
      map,
      name,
      thumbnail,
      crypto.randomUUID(),
      new Date().toISOString(),
    );
    return this.commit((records) => ({ records: [record, ...records], result: record }));
  }

  async remove(id: string): Promise<void> {
    return this.commit((records) => {
      requireRecord(records, id);
      return { records: records.filter((record) => record.id !== id), result: undefined };
    });
  }

  async rename(id: string, name: string): Promise<SavedMap> {
    return this.commit((records) => {
      const source = requireRecord(records, id);
      const renamed = { ...source, name: normalizeName(name) || source.name };
      return {
        records: records.map((record) => (record.id === id ? renamed : record)),
        result: renamed,
      };
    });
  }

  async duplicate(id: string): Promise<void> {
    return this.commit((records) => {
      const source = requireRecord(records, id);
      const copy: SavedMap = {
        ...source,
        id: crypto.randomUUID(),
        name: duplicateName(source.name),
        favorite: false,
        savedAt: new Date().toISOString(),
      };
      return { records: [copy, ...records], result: undefined };
    });
  }

  async toggleFavorite(id: string): Promise<boolean> {
    return this.commit((records) => {
      const favorite = !requireRecord(records, id).favorite;
      return {
        records: records.map((record) => (record.id === id ? { ...record, favorite } : record)),
        result: favorite,
      };
    });
  }

  async importMaps(maps: readonly SavedMap[]): Promise<{ added: number; skipped: number }> {
    return this.commit((records) => {
      const { fresh, skipped } = uniqueById(maps, new Set(records.map((record) => record.id)));
      return {
        records: fresh.length > 0 ? [...fresh, ...records] : records,
        result: { added: fresh.length, skipped },
      };
    });
  }

  exportBundle(): string {
    this.reload();
    return serializeBundle(this.saved());
  }

  private async commit<T>(change: (records: readonly SavedMap[]) => LibraryChange<T>): Promise<T> {
    if (!this.locks) throw new Error(LOCKS_UNAVAILABLE);
    return this.locks.request(WRITE_LOCK, () => {
      const latest = readLibrary(this.state());
      if (latest.kind !== 'ready') {
        this.state.set(latest);
        throw new Error(libraryProblem(latest));
      }
      let next: LibraryChange<T>;
      try {
        next = change(latest.records);
      } catch (error: unknown) {
        this.state.set(latest);
        throw error;
      }
      if (next.records === latest.records) {
        this.state.set(latest);
        return next.result;
      }
      const raw = JSON.stringify(next.records);
      try {
        localStorage.setItem(SAVE_STORAGE_KEY, raw);
      } catch {
        throw new Error(
          'Your browser could not write to local storage. It may be full or blocked.',
        );
      }
      this.state.set({ kind: 'ready', raw, records: next.records });
      return next.result;
    });
  }
}
