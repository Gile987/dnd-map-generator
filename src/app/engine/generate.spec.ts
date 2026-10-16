import { describe, expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { generateDungeon } from './generate';
import { changeDensity, changePreset, shuffleDetails } from './decoration';
import { HEIGHT, WIDTH, center, indexOf } from './model';
import type { DecorationPreset, Density, Dungeon, Settings } from './model';
import { carveLayout, distances } from './topology';
import { reservedTiles, validateDungeon } from './validation';

function validMap(settings: Settings): Dungeon {
  const result = generateDungeon(settings);
  if (!result.ok) throw new Error(`${settings.seed}: ${result.error}`);
  return result.map;
}

function digest(map: Dungeon): string {
  return createHash('sha256').update(JSON.stringify(map)).digest('hex').slice(0, 16);
}

const settings: Settings = {
  seed: 'mosslit-sanctum',
  roomCount: 6,
  density: 'Balanced',
  preset: 'Mosslit',
};

describe('deterministic dungeon generation', () => {
  test('reproduces full models and does not mutate settings or previous maps', () => {
    const input = Object.freeze({ ...settings });
    const first = validMap(input);
    const snapshot = structuredClone(first);
    expect(validMap(input)).toEqual(first);
    expect(input).toEqual(settings);
    shuffleDetails(first);
    changeDensity(first, 'Cluttered');
    expect(first).toEqual(snapshot);
  });

  test('pins representative generated models to a recorded baseline', () => {
    const cases: readonly Settings[] = [
      { seed: 'mosslit-sanctum', roomCount: 6, density: 'Balanced', preset: 'Mosslit' },
      { seed: 'amber-vault', roomCount: 4, density: 'Sparse', preset: 'Mosslit' },
      { seed: 'forgotten-library', roomCount: 8, density: 'Cluttered', preset: 'Mosslit' },
      { seed: 'lantern-watch', roomCount: 7, density: 'Sparse', preset: 'Mosslit' },
      { seed: 'moss-and-memory', roomCount: 5, density: 'Cluttered', preset: 'Mosslit' },
      { seed: 'silver-crypt', roomCount: 8, density: 'Balanced', preset: 'Mosslit' },
      { seed: 'amber-vault', roomCount: 4, density: 'Sparse', preset: 'Crypt' },
      { seed: 'forgotten-library', roomCount: 8, density: 'Cluttered', preset: 'Storehouse' },
      { seed: 'lantern-watch', roomCount: 7, density: 'Sparse', preset: 'Sanctuary' },
    ];
    expect(
      cases.map((entry) => `${entry.seed}:${entry.preset}:${digest(validMap(entry))}`),
    ).toEqual([
      'mosslit-sanctum:Mosslit:98ea0456edc39183',
      'amber-vault:Mosslit:9e1e07c5c14b8295',
      'forgotten-library:Mosslit:62377dddbbddc387',
      'lantern-watch:Mosslit:32cbfcca0598728b',
      'moss-and-memory:Mosslit:9013a57d319492ac',
      'silver-crypt:Mosslit:515494aff2d383fd',
      'amber-vault:Crypt:87862478829bf7d2',
      'forgotten-library:Storehouse:dc3a0745a0d5a396',
      'lantern-watch:Sanctuary:ff1f06c72013193a',
    ]);
  });

  test('satisfies topology and decoration invariants across 45 seeds and every room count', () => {
    const densities: readonly Density[] = ['Sparse', 'Balanced', 'Cluttered'];
    for (let seed = 0; seed < 45; seed++) {
      const density = densities[seed % densities.length] ?? 'Balanced';
      const roomCount = 4 + (seed % 5);
      const map = validMap({ seed: `batch-${seed}`, roomCount, density, preset: 'Mosslit' });
      expect(map.layout.rooms).toHaveLength(roomCount);
      expect(map.layout.tiles).toHaveLength(WIDTH * HEIGHT);
      expect(validateDungeon(map), `batch-${seed}`).toBeUndefined();
      expect(map.layout.connections.length).toBeGreaterThanOrEqual(roomCount - 1);
      expect(map.layout.connections.length).toBeLessThanOrEqual(roomCount);
      const blocked = new Set(
        map.decoration.props.filter((prop) => prop.blocking).map((prop) => indexOf(prop.x, prop.y)),
      );
      const reserved = reservedTiles(map.layout);
      expect([...blocked].some((tile) => reserved.has(tile))).toBe(false);
      const reachable = distances(map.layout.tiles, map.layout.entrance, blocked);
      expect(reachable.has(indexOf(map.layout.objective.x, map.layout.objective.y))).toBe(true);
      expect(reachable.size).toBe(map.layout.tiles.filter(Boolean).length - blocked.size);
      expect(blocked.size).toBeLessThanOrEqual(
        Math.floor(
          map.layout.rooms.reduce((sum, room) => sum + room.width * room.height, 0) *
            { Sparse: 0.05, Balanced: 0.1, Cluttered: 0.15 }[density],
        ),
      );
      for (const room of map.layout.rooms) {
        expect(room.x).toBeGreaterThan(0);
        expect(room.y).toBeGreaterThan(0);
        expect(room.x + room.width).toBeLessThan(WIDTH);
        expect(room.y + room.height).toBeLessThan(HEIGHT);
      }
    }
  });

  test('adds the optional extra connection only for seeds with a useful shortcut', () => {
    const shortcut = validMap({
      seed: 'batch-1',
      roomCount: 8,
      density: 'Balanced',
      preset: 'Mosslit',
    });
    expect(shortcut.layout.connections).toHaveLength(shortcut.layout.rooms.length);
    const pairs = shortcut.layout.connections.map(
      (link) => `${Math.min(link.from, link.to)}~${Math.max(link.from, link.to)}`,
    );
    expect(new Set(pairs).size).toBe(shortcut.layout.connections.length);
    const spanningTree = shortcut.layout.connections.slice(0, -1);
    const extra = shortcut.layout.connections.at(-1);
    const from = shortcut.layout.rooms.find((room) => room.id === extra?.from);
    const to = shortcut.layout.rooms.find((room) => room.id === extra?.to);
    if (!extra || !from || !to) throw new Error('the extra connection is missing');
    const ac = center(from);
    const bc = center(to);
    const target = indexOf(bc.x, bc.y);
    const detour = distances(carveLayout(shortcut.layout.rooms, spanningTree), ac).get(target);
    const improved = distances(shortcut.layout.tiles, ac).get(target);
    if (detour === undefined || improved === undefined)
      throw new Error('the shortcut endpoints are unreachable');
    expect(detour - improved).toBeGreaterThanOrEqual(10);
    const spanningTreeOnly = validMap(settings);
    expect(spanningTreeOnly.layout.connections).toHaveLength(
      spanningTreeOnly.layout.rooms.length - 1,
    );
  });

  test('detail shuffling and density changes preserve all topology and surface data', () => {
    const original = validMap(settings);
    const shuffled = shuffleDetails(original);
    expect(shuffled.layout).toEqual(original.layout);
    expect(shuffled.surfaceSeed).toBe(original.surfaceSeed);
    expect(shuffled.seed).toBe(original.seed);
    expect(shuffled.decoration.revision).toBe(1);
    expect(shuffled.decoration.props).not.toEqual(original.decoration.props);
    expect(shuffleDetails(original)).toEqual(shuffled);
    for (const density of ['Sparse', 'Balanced', 'Cluttered'] as const) {
      const changed = changeDensity(shuffled, density);
      expect(changed.layout).toEqual(original.layout);
      expect(changed.surfaceSeed).toBe(original.surfaceSeed);
      expect(changed.decoration.revision).toBe(1);
      expect(validateDungeon(changed)).toBeUndefined();
      expect(changeDensity(changed, 'Balanced')).toEqual(shuffled);
    }
  });

  test('rejects invalid settings and bounded impossible placement explicitly', () => {
    for (const seed of ['', '   ', 'x'.repeat(65)])
      expect(generateDungeon({ ...settings, seed }).ok).toBe(false);
    for (const roomCount of [0, 3, 9, 4.5, NaN, Infinity])
      expect(generateDungeon({ ...settings, roomCount }).ok).toBe(false);
    const invalidDensities: readonly string[] = ['Dense', 'balanced', ''];
    for (const density of invalidDensities)
      expect(generateDungeon({ ...settings, density: density as Density })).toEqual({
        ok: false,
        error: 'Choose a valid decoration density.',
      });
    const failure = generateDungeon(settings, { retries: 1, placementAttempts: 1 });
    expect(failure.ok).toBe(false);
    if (!failure.ok) expect(failure.error).toContain('generation limit');
    expect(generateDungeon(settings, { retries: 999, placementAttempts: 999 }).ok).toBe(false);
  });

  test('trims seeds and keeps view settings outside the generation model', () => {
    const map = validMap(settings);
    expect(validMap({ ...settings, seed: `  ${settings.seed}  ` })).toEqual(map);
    expect(Object.keys(map)).toEqual(['version', 'seed', 'layout', 'surfaceSeed', 'decoration']);
    expect(changeDensity(map, 'Sparse').layout).toEqual(
      validMap({ ...settings, density: 'Sparse' }).layout,
    );
  });

  test('preset changes preserve all topology and surface data', () => {
    const original = validMap(settings);
    for (const preset of ['Mosslit', 'Crypt', 'Storehouse', 'Sanctuary'] as const) {
      const changed = changePreset(original, preset);
      expect(changed.layout).toEqual(original.layout);
      expect(changed.surfaceSeed).toBe(original.surfaceSeed);
      expect(changed.seed).toBe(original.seed);
      expect(changed.decoration.preset).toBe(preset);
      expect(changed.decoration.density).toBe(original.decoration.density);
      expect(changed.decoration.revision).toBe(original.decoration.revision);
      expect(validateDungeon(changed)).toBeUndefined();
    }
    expect(changePreset(original, 'Mosslit')).toEqual(original);
    const crypt = changePreset(original, 'Crypt');
    const storehouse = changePreset(original, 'Storehouse');
    expect(crypt.decoration.props).not.toEqual(storehouse.decoration.props);
  });

  test('each preset produces valid dungeons across seeds and densities', () => {
    const presets: readonly DecorationPreset[] = ['Mosslit', 'Crypt', 'Storehouse', 'Sanctuary'];
    const densities: readonly Density[] = ['Sparse', 'Balanced', 'Cluttered'];
    for (const preset of presets) {
      for (let i = 0; i < 8; i++) {
        const density = densities[i % densities.length] ?? 'Balanced';
        const map = validMap({
          seed: `preset-${preset}-${i}`,
          roomCount: 4 + (i % 5),
          density,
          preset,
        });
        expect(map.decoration.preset).toBe(preset);
        expect(validateDungeon(map)).toBeUndefined();
      }
    }
  });

  test('rejects invalid preset in settings', () => {
    const invalidPresets: readonly string[] = ['Dungeon', 'mosslit', ''];
    for (const preset of invalidPresets)
      expect(generateDungeon({ ...settings, preset: preset as DecorationPreset })).toEqual({
        ok: false,
        error: 'Choose a valid decoration preset.',
      });
  });
});
