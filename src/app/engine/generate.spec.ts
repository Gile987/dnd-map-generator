import { describe, expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { generateDungeon } from './generate';
import { changeDensity, shuffleDetails } from './decoration';
import { HEIGHT, WIDTH, indexOf } from './model';
import type { Density, Dungeon, Settings } from './model';
import { distances } from './topology';
import { reservedTiles, validateDungeon } from './validation';

function validMap(settings: Settings): Dungeon {
  const result = generateDungeon(settings);
  if (!result.ok) throw new Error(`${settings.seed}: ${result.error}`);
  return result.map;
}

function digest(map: Dungeon): string {
  return createHash('sha256').update(JSON.stringify(map)).digest('hex').slice(0, 16);
}

const settings: Settings = { seed: 'mosslit-sanctum', roomCount: 6, density: 'Balanced' };

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
      { seed: 'mosslit-sanctum', roomCount: 6, density: 'Balanced' },
      { seed: 'amber-vault', roomCount: 4, density: 'Sparse' },
      { seed: 'forgotten-library', roomCount: 8, density: 'Cluttered' },
      { seed: 'lantern-watch', roomCount: 7, density: 'Sparse' },
      { seed: 'moss-and-memory', roomCount: 5, density: 'Cluttered' },
      { seed: 'silver-crypt', roomCount: 8, density: 'Balanced' },
    ];
    expect(cases.map((entry) => `${entry.seed}:${digest(validMap(entry))}`)).toEqual([
      'mosslit-sanctum:3d1aaad4c6a88f73',
      'amber-vault:a5074a047b6f05b0',
      'forgotten-library:d7a004eb69d49933',
      'lantern-watch:f0aab59055a89df0',
      'moss-and-memory:47c08761eb57584d',
      'silver-crypt:0f53ed0b356b9955',
    ]);
  });

  test('satisfies topology and decoration invariants across 45 seeds and every room count', () => {
    const densities: readonly Density[] = ['Sparse', 'Balanced', 'Cluttered'];
    for (let seed = 0; seed < 45; seed++) {
      const density = densities[seed % densities.length] ?? 'Balanced';
      const roomCount = 4 + (seed % 5);
      const map = validMap({ seed: `batch-${seed}`, roomCount, density });
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
});
