import '@angular/compiler';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { generateDungeon } from '../engine/generate';
import { generateForestClearing } from '../engine/forest-generate';
import { SAVE_STORAGE_KEY, makeSavedMap, parseBundle } from './save-format';
import type { SavedMap } from './save-format';
import { SaveStore } from './save-store';

const dungeon = generateDungeon({
  seed: 'mosslit-sanctum',
  roomCount: 6,
  density: 'Balanced',
  preset: 'Mosslit',
});
const forest = generateForestClearing({
  seed: 'woodland-glade',
  density: 'Sparse',
  character: 'Autumn',
});
if (!dungeon.ok) throw new Error(dungeon.error);
if (!forest.ok) throw new Error(forest.error);

const thumbnail = 'data:image/png;base64,AAAA';
const original: SavedMap = {
  ...makeSavedMap(dungeon.map, 'Original', thumbnail, 'existing', '2026-10-21T10:00:00.000Z'),
  favorite: true,
};
const incoming = makeSavedMap(
  forest.map,
  'Imported forest',
  thumbnail,
  'incoming',
  '2026-10-21T11:00:00.000Z',
);

function stubStorage(raw: string | null = JSON.stringify([original])) {
  const values = new Map<string, string>();
  if (raw !== null) values.set(SAVE_STORAGE_KEY, raw);
  const getItem = vi.fn((key: string) => values.get(key) ?? null);
  const setItem = vi.fn((key: string, value: string) => {
    values.set(key, value);
  });
  vi.stubGlobal('localStorage', { getItem, setItem });
  return { values, getItem, setItem };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('saved-map persistence', () => {
  test.each(['add', 'remove', 'rename', 'duplicate', 'favorite', 'import'] as const)(
    'a failed %s write preserves disk and signal state, then permits retry',
    (operation) => {
      const storage = stubStorage();
      const store = new SaveStore();
      const before = store.saved();
      const snapshot = structuredClone(before);
      const diskBefore = storage.values.get(SAVE_STORAGE_KEY);
      let stateAtWrite: readonly SavedMap[] | undefined;
      storage.setItem.mockImplementationOnce(() => {
        stateAtWrite = store.saved();
        throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
      });
      const actions = {
        add: () => store.add(incoming.map, 'New map', thumbnail),
        remove: () => store.remove(original.id),
        rename: () => store.rename(original.id, '  Renamed  '),
        duplicate: () => store.duplicate(original.id),
        favorite: () => store.toggleFavorite(original.id),
        import: () => store.importMaps([incoming]),
      };

      expect(actions[operation]).toThrow('Your browser could not write to local storage');
      expect(stateAtWrite).toBe(before);
      expect(store.saved()).toBe(before);
      expect(store.saved()).toEqual(snapshot);
      expect(storage.values.get(SAVE_STORAGE_KEY)).toBe(diskBefore);
      expect(new SaveStore().saved()).toEqual(snapshot);

      actions[operation]();
      const expected = {
        add: [
          expect.objectContaining({
            name: 'New map',
            map: incoming.map,
            thumbnail,
            favorite: false,
          }),
          original,
        ],
        remove: [],
        rename: [{ ...original, name: 'Renamed' }],
        duplicate: [
          {
            ...original,
            id: expect.any(String),
            name: 'Original (copy)',
            favorite: false,
            savedAt: expect.any(String),
          },
          original,
        ],
        favorite: [{ ...original, favorite: false }],
        import: [incoming, original],
      };
      expect(store.saved()).toEqual(expected[operation]);
      expect(new Set(store.saved().map((record) => record.id)).size).toBe(store.saved().length);
      expect(storage.values.get(SAVE_STORAGE_KEY)).toBe(JSON.stringify(store.saved()));
      expect(new SaveStore().saved()).toEqual(store.saved());
      expect(before).toEqual(snapshot);
      expect(storage.setItem).toHaveBeenCalledTimes(2);
    },
  );

  test('publishes the new signal state only after a successful storage write', () => {
    const storage = stubStorage();
    const store = new SaveStore();
    const before = store.saved();
    storage.setItem.mockImplementation((key, value) => {
      expect(store.saved()).toBe(before);
      expect(key).toBe(SAVE_STORAGE_KEY);
      expect(JSON.parse(value)).toEqual([{ ...original, name: 'Committed' }]);
      storage.values.set(key, value);
    });
    store.rename(original.id, 'Committed');
    expect(storage.setItem).toHaveBeenCalledOnce();
    expect(store.saved()).toEqual([{ ...original, name: 'Committed' }]);
    expect(store.saved()).not.toBe(before);
  });

  test('imports each new ID once, retains the first batch entry, and preserves existing saves', () => {
    const storage = stubStorage();
    const store = new SaveStore();
    const another = { ...incoming, id: 'another', name: 'Another forest' };
    const batch = [
      { ...original, name: 'Must not overwrite existing' },
      incoming,
      { ...incoming, name: 'Must not overwrite first batch entry' },
      another,
      original,
    ];
    const before = structuredClone(batch);
    expect(store.importMaps(batch)).toEqual({ added: 2, skipped: 3 });
    expect(store.saved()).toEqual([incoming, another, original]);
    expect(new SaveStore().saved()).toEqual([incoming, another, original]);
    expect(storage.setItem).toHaveBeenCalledOnce();
    expect(batch).toEqual(before);
  });

  test('empty and duplicate-only imports need no storage write, even when writes are blocked', () => {
    const storage = stubStorage();
    const store = new SaveStore();
    const before = store.saved();
    storage.setItem.mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError');
    });
    expect(store.importMaps([])).toEqual({ added: 0, skipped: 0 });
    expect(store.importMaps([original, { ...original, name: 'Duplicate' }])).toEqual({
      added: 0,
      skipped: 2,
    });
    expect(store.saved()).toBe(before);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.values.get(SAVE_STORAGE_KEY)).toBe(JSON.stringify([original]));
  });

  test.each([null, 'not JSON', '{}'])(
    'loads an empty library from absent or malformed storage (%s) without overwriting it',
    (raw) => {
      const storage = stubStorage(raw);
      expect(new SaveStore().saved()).toEqual([]);
      expect(storage.setItem).not.toHaveBeenCalled();
      expect(storage.values.get(SAVE_STORAGE_KEY) ?? null).toBe(raw);
    },
  );

  test('loads valid dungeon and forest records while discarding invalid entries in memory', () => {
    const raw = JSON.stringify([original, null, { ...incoming, name: '' }, incoming]);
    const storage = stubStorage(raw);
    expect(new SaveStore().saved()).toEqual([original, incoming]);
    expect(storage.getItem).toHaveBeenCalledExactlyOnceWith(SAVE_STORAGE_KEY);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.values.get(SAVE_STORAGE_KEY)).toBe(raw);
  });

  test('a blocked storage read leaves construction safe and does not attempt a write', () => {
    const storage = stubStorage();
    storage.getItem.mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError');
    });
    expect(new SaveStore().saved()).toEqual([]);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.values.get(SAVE_STORAGE_KEY)).toBe(JSON.stringify([original]));
  });

  test('exports the current accepted records without mutating or writing the library', () => {
    const storage = stubStorage(JSON.stringify([original, incoming]));
    const store = new SaveStore();
    const before = store.saved();
    expect(parseBundle(store.exportBundle())).toEqual({
      ok: true,
      maps: [original, incoming],
      skipped: 0,
    });
    expect(store.saved()).toBe(before);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
