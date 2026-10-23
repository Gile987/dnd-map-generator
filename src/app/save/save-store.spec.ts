import '@angular/compiler';
import { Injector } from '@angular/core';
import type { DestroyableInjector, Signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, expectTypeOf, test, vi } from 'vitest';
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

const injectors: DestroyableInjector[] = [];

function createStore(): SaveStore {
  const injector = Injector.create({ providers: [SaveStore] });
  injectors.push(injector);
  return injector.get(SaveStore);
}

beforeEach(() => {
  vi.stubGlobal('window', new EventTarget());
  let queue = Promise.resolve();
  vi.stubGlobal('navigator', {
    locks: {
      request: (_name: string, action: () => unknown) => {
        const result = queue.then(action);
        queue = result.then(
          () => undefined,
          () => undefined,
        );
        return result;
      },
    },
  });
});

afterEach(() => {
  for (const injector of injectors.splice(0)) injector.destroy();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('saved-map persistence', () => {
  test('exposes saved records through a readonly signal and collection', () => {
    expectTypeOf<SaveStore['saved']>().toEqualTypeOf<Signal<readonly SavedMap[]>>();
  });

  test.each(['add', 'remove', 'rename', 'duplicate', 'favorite', 'import'] as const)(
    'a failed %s write preserves disk and signal state, then permits retry',
    async (operation) => {
      const storage = stubStorage();
      const store = createStore();
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

      await expect(actions[operation]()).rejects.toThrow(
        'Your browser could not write to local storage',
      );
      expect(stateAtWrite).toBe(before);
      expect(store.saved()).toBe(before);
      expect(store.saved()).toEqual(snapshot);
      expect(storage.values.get(SAVE_STORAGE_KEY)).toBe(diskBefore);
      expect(createStore().saved()).toEqual(snapshot);

      await actions[operation]();
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
      expect(createStore().saved()).toEqual(store.saved());
      expect(before).toEqual(snapshot);
      expect(storage.setItem).toHaveBeenCalledTimes(2);
    },
  );

  test('publishes the new signal state only after a successful storage write', async () => {
    const storage = stubStorage();
    const store = createStore();
    const before = store.saved();
    storage.setItem.mockImplementation((key, value) => {
      expect(store.saved()).toBe(before);
      expect(key).toBe(SAVE_STORAGE_KEY);
      expect(JSON.parse(value)).toEqual([{ ...original, name: 'Committed' }]);
      storage.values.set(key, value);
    });
    await store.rename(original.id, 'Committed');
    expect(storage.setItem).toHaveBeenCalledOnce();
    expect(store.saved()).toEqual([{ ...original, name: 'Committed' }]);
    expect(store.saved()).not.toBe(before);
  });

  test('imports each new ID once, retains the first batch entry, and preserves existing saves', async () => {
    const storage = stubStorage();
    const store = createStore();
    const another = { ...incoming, id: 'another', name: 'Another forest' };
    const batch = [
      { ...original, name: 'Must not overwrite existing' },
      incoming,
      { ...incoming, name: 'Must not overwrite first batch entry' },
      another,
      original,
    ];
    const before = structuredClone(batch);
    expect(await store.importMaps(batch)).toEqual({ added: 2, skipped: 3 });
    expect(store.saved()).toEqual([incoming, another, original]);
    expect(createStore().saved()).toEqual([incoming, another, original]);
    expect(storage.setItem).toHaveBeenCalledOnce();
    expect(batch).toEqual(before);
  });

  test('empty and duplicate-only imports need no storage write, even when writes are blocked', async () => {
    const storage = stubStorage();
    const store = createStore();
    const before = store.saved();
    storage.setItem.mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError');
    });
    expect(await store.importMaps([])).toEqual({ added: 0, skipped: 0 });
    expect(await store.importMaps([original, { ...original, name: 'Duplicate' }])).toEqual({
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
      expect(createStore().saved()).toEqual([]);
      expect(storage.setItem).not.toHaveBeenCalled();
      expect(storage.values.get(SAVE_STORAGE_KEY) ?? null).toBe(raw);
    },
  );

  test('loads valid dungeon and forest records while discarding invalid entries in memory', () => {
    const raw = JSON.stringify([original, null, { ...incoming, name: '' }, incoming]);
    const storage = stubStorage(raw);
    expect(createStore().saved()).toEqual([original, incoming]);
    expect(storage.getItem).toHaveBeenCalledExactlyOnceWith(SAVE_STORAGE_KEY);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.values.get(SAVE_STORAGE_KEY)).toBe(raw);
  });

  test('a blocked storage read leaves construction safe and does not attempt a write', () => {
    const storage = stubStorage();
    storage.getItem.mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError');
    });
    expect(createStore().saved()).toEqual([]);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.values.get(SAVE_STORAGE_KEY)).toBe(JSON.stringify([original]));
  });

  test('exports the current accepted records without mutating or writing the library', () => {
    const storage = stubStorage(JSON.stringify([original, incoming]));
    const store = createStore();
    const before = store.saved();
    expect(parseBundle(store.exportBundle())).toEqual({
      ok: true,
      maps: [original, incoming],
      skipped: 0,
    });
    expect(store.saved()).toBe(before);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  test('a stale store preserves saves committed by another store', async () => {
    stubStorage(null);
    const first = createStore();
    const second = createStore();
    await first.add(original.map, 'First tab', thumbnail);
    await second.add(incoming.map, 'Second tab', thumbnail);
    expect(
      createStore()
        .saved()
        .map((record) => record.name),
    ).toEqual(['Second tab', 'First tab']);
  });

  test('unreadable local entries survive an unrelated rename attempt', async () => {
    const raw = JSON.stringify([original, { ...incoming, saveFormatVersion: '99.0.0' }]);
    const storage = stubStorage(raw);
    const store = createStore();
    await expect(store.rename(original.id, 'Attempted rename')).rejects.toThrow('unreadable');
    expect(storage.values.get(SAVE_STORAGE_KEY)).toBe(raw);
    expect(store.saved()).toEqual([original]);
  });

  test('a stale duplicate cannot resurrect a map deleted by another store', async () => {
    stubStorage();
    const first = createStore();
    const stale = createStore();
    await first.remove(original.id);
    await expect(stale.duplicate(original.id)).rejects.toThrow('no longer in the library');
    expect(createStore().saved()).toEqual([]);
  });

  test('concurrent stores serialize mutations and preserve unrelated fields', async () => {
    const storage = stubStorage();
    const first = createStore();
    const second = createStore();
    await Promise.all([
      first.rename(original.id, 'Renamed in first tab'),
      second.toggleFavorite(original.id),
      first.add(incoming.map, 'Added in first tab', thumbnail),
      second.importMaps([incoming]),
    ]);
    const records = createStore().saved();
    expect(records).toHaveLength(3);
    expect(records.find((record) => record.id === original.id)).toMatchObject({
      name: 'Renamed in first tab',
      favorite: false,
    });
    expect(records.map((record) => record.name)).toContain('Added in first tab');
    expect(records.map((record) => record.id)).toContain(incoming.id);
    expect(storage.setItem).toHaveBeenCalledTimes(4);
  });

  test.each(['rename', 'duplicate', 'favorite', 'remove'] as const)(
    'a stale %s command cannot restore a deleted record',
    async (operation) => {
      const storage = stubStorage();
      const first = createStore();
      const stale = createStore();
      await first.remove(original.id);
      const actions = {
        rename: () => stale.rename(original.id, 'Stale edit'),
        duplicate: () => stale.duplicate(original.id),
        favorite: () => stale.toggleFavorite(original.id),
        remove: () => stale.remove(original.id),
      };
      await expect(actions[operation]()).rejects.toThrow('no longer in the library');
      expect(stale.saved()).toEqual([]);
      expect(storage.values.get(SAVE_STORAGE_KEY)).toBe('[]');
      expect(storage.setItem).toHaveBeenCalledOnce();
    },
  );

  test('duplicate and import commands use the latest record and ID set', async () => {
    stubStorage();
    const first = createStore();
    const stale = createStore();
    await first.rename(original.id, 'Latest name');
    await first.toggleFavorite(original.id);
    await stale.duplicate(original.id);
    expect(stale.saved()[0]).toMatchObject({ name: 'Latest name (copy)', favorite: false });
    await first.importMaps([incoming]);
    expect(await stale.importMaps([incoming])).toEqual({ added: 0, skipped: 1 });
    expect(createStore().saved()).toHaveLength(3);
  });

  test('storage events reload the current value and cleanup removes the listener', () => {
    const storage = stubStorage();
    const store = createStore();
    const remove = vi.spyOn(window, 'removeEventListener');
    storage.values.set(SAVE_STORAGE_KEY, JSON.stringify([incoming]));
    window.dispatchEvent(Object.assign(new Event('storage'), { key: 'unrelated' }));
    expect(store.saved()).toEqual([original]);
    window.dispatchEvent(
      Object.assign(new Event('storage'), { key: SAVE_STORAGE_KEY, newValue: 'stale event data' }),
    );
    expect(store.saved()).toEqual([incoming]);
    storage.values.delete(SAVE_STORAGE_KEY);
    window.dispatchEvent(Object.assign(new Event('storage'), { key: null }));
    expect(store.saved()).toEqual([]);
    const injector = injectors.pop();
    if (!injector) throw new Error('Expected store injector');
    injector.destroy();
    expect(remove).toHaveBeenCalledWith('storage', expect.any(Function));
    storage.getItem.mockClear();
    window.dispatchEvent(Object.assign(new Event('storage'), { key: SAVE_STORAGE_KEY }));
    expect(storage.getItem).not.toHaveBeenCalled();
  });

  test.each(['add', 'remove', 'rename', 'duplicate', 'favorite', 'import'] as const)(
    '%s cannot replace a partially readable library',
    async (operation) => {
      const raw = JSON.stringify([original, { ...incoming, saveFormatVersion: '99.0.0' }]);
      const storage = stubStorage(raw);
      const store = createStore();
      const actions = {
        add: () => store.add(incoming.map, 'New map', thumbnail),
        remove: () => store.remove(original.id),
        rename: () => store.rename(original.id, 'Renamed'),
        duplicate: () => store.duplicate(original.id),
        favorite: () => store.toggleFavorite(original.id),
        import: () => store.importMaps([incoming]),
      };
      expect(store.canWrite()).toBe(false);
      expect(store.recoveryData()).toBe(raw);
      expect(store.problem()).toContain('1 unreadable entry');
      await expect(actions[operation]()).rejects.toThrow('Changes are paused');
      expect(storage.values.get(SAVE_STORAGE_KEY) === raw).toBe(true);
      expect(storage.setItem).not.toHaveBeenCalled();
      expect(store.saved()).toEqual([original]);
      expect(createStore().recoveryData()).toBe(raw);
      expect(parseBundle(store.exportBundle())).toMatchObject({ ok: true, maps: [original] });
    },
  );

  test.each(['', 'not JSON', '{}', 'null'])(
    'malformed storage (%j) stays byte-for-byte recoverable through a save attempt',
    async (raw) => {
      const storage = stubStorage(raw);
      const store = createStore();
      expect(store.canWrite()).toBe(false);
      expect(store.recoveryData()).toBe(raw);
      await expect(store.add(original.map, 'New map', thumbnail)).rejects.toThrow(
        'Changes are paused',
      );
      expect(storage.values.get(SAVE_STORAGE_KEY)).toBe(raw);
      expect(storage.setItem).not.toHaveBeenCalled();
    },
  );

  test('duplicate IDs retain the first readable record, preserve raw data, and pause writes', async () => {
    const raw = JSON.stringify([original, { ...original, name: 'Duplicate ID' }, incoming]);
    const storage = stubStorage(raw);
    const store = createStore();
    expect(store.saved()).toEqual([original, incoming]);
    expect(store.problem()).toContain('1 duplicate entry');
    expect(store.recoveryData()).toBe(raw);
    await expect(store.remove(original.id)).rejects.toThrow('Changes are paused');
    expect(storage.values.get(SAVE_STORAGE_KEY) === raw).toBe(true);
  });

  test('writes recheck readability inside the lock instead of trusting the initial load', async () => {
    const storage = stubStorage();
    const store = createStore();
    const raw = JSON.stringify([original, null]);
    storage.values.set(SAVE_STORAGE_KEY, raw);
    await expect(store.rename(original.id, 'Attempted')).rejects.toThrow('unreadable');
    expect(store.saved()).toEqual([original]);
    expect(store.recoveryData()).toBe(raw);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  test('a failed read preserves cached maps and prevents writes until a successful retry', async () => {
    const storage = stubStorage();
    const store = createStore();
    const before = store.saved();
    storage.getItem.mockImplementation(() => {
      throw new Error('blocked read');
    });
    store.reload();
    expect(store.saved()).toBe(before);
    expect(store.canWrite()).toBe(false);
    expect(store.problem()).toContain('could not read');
    await expect(store.rename(original.id, 'After retry')).rejects.toThrow('could not read');
    expect(storage.setItem).not.toHaveBeenCalled();
    storage.getItem.mockImplementation((key: string) => storage.values.get(key) ?? null);
    store.reload();
    expect(store.canWrite()).toBe(true);
    expect(store.problem()).toBe('');
    await store.rename(original.id, 'After retry');
    expect(createStore().saved()[0]?.name).toBe('After retry');
  });

  test('repairing partial storage allows retry without changing the accepted map model', async () => {
    const storage = stubStorage(JSON.stringify([original, null]));
    const store = createStore();
    const before = structuredClone(store.saved()[0]?.map);
    storage.values.set(SAVE_STORAGE_KEY, JSON.stringify([original]));
    store.reload();
    expect(store.canWrite()).toBe(true);
    expect(store.recoveryData()).toBeNull();
    await store.rename(original.id, 'Recovered');
    expect(createStore().saved()[0]?.map).toEqual(before);
  });

  test('without cross-tab locks the library remains readable and refuses unsafe writes', async () => {
    const storage = stubStorage();
    vi.stubGlobal('navigator', {});
    const store = createStore();
    expect(store.saved()).toEqual([original]);
    expect(store.canWrite()).toBe(false);
    expect(store.problem()).toContain('Saving is unavailable');
    await expect(store.remove(original.id)).rejects.toThrow('Saving is unavailable');
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(parseBundle(store.exportBundle())).toMatchObject({ ok: true, maps: [original] });
  });

  test('rename and favorite results describe the latest committed record', async () => {
    stubStorage();
    const first = createStore();
    const stale = createStore();
    await first.rename(original.id, 'Latest name');
    await first.toggleFavorite(original.id);
    expect((await stale.rename(original.id, '   ')).name).toBe('Latest name');
    expect(await stale.toggleFavorite(original.id)).toBe(true);
    expect(createStore().saved()[0]).toMatchObject({ name: 'Latest name', favorite: true });
  });
});
