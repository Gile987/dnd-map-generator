import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import {
  ALL_FOREST_CHARACTERS,
  GENERATOR_VERSION,
  HEIGHT,
  WIDTH,
  indexOf,
  isWalkable,
} from './model';
import type { Density, ForestCharacter, ForestClearing, ForestSettings, Point } from './model';
import {
  changeForestCharacter,
  changeForestDensity,
  generateForestClearing,
  shuffleForestDetails,
} from './forest-generate';
import { validateForestSettings } from './forest-validation';

const budgets: Readonly<Record<Density, number>> = { Sparse: 0.05, Balanced: 0.1, Cluttered: 0.15 };

function forestDistances(
  tiles: readonly boolean[],
  start: Point,
  blocked: ReadonlySet<number> = new Set(),
): Map<number, number> {
  const first = indexOf(start.x, start.y);
  const result = new Map<number, number>();
  if (!tiles[first] || blocked.has(first)) return result;
  result.set(first, 0);
  const queue = [first];
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (current === undefined) continue;
    const x = current % WIDTH;
    const y = Math.floor(current / WIDTH);
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= WIDTH || ny >= HEIGHT) continue;
      const next = indexOf(nx, ny);
      if (tiles[next] && !blocked.has(next) && !result.has(next)) {
        result.set(next, (result.get(current) ?? 0) + 1);
        queue.push(next);
      }
    }
  }
  return result;
}

function validMap(settings: ForestSettings): ForestClearing {
  const result = generateForestClearing(settings);
  if (!result.ok) throw new Error(`${settings.seed}: ${result.error}`);
  return result.map;
}

function digest(map: ForestClearing): string {
  return createHash('sha256').update(JSON.stringify(map)).digest('hex').slice(0, 16);
}

describe('deterministic forest clearing generation', () => {
  test('reproduces full models and does not mutate settings or previous maps', () => {
    const settings: ForestSettings = {
      seed: 'woodland-glade',
      density: 'Balanced',
      character: 'Verdant',
    };
    const input = Object.freeze({ ...settings });
    const first = validMap(input);
    const snapshot = structuredClone(first);
    expect(validMap(input)).toEqual(first);
    expect(input).toEqual(settings);
    shuffleForestDetails(first);
    changeForestDensity(first, 'Cluttered');
    changeForestCharacter(first, 'Fey');
    expect(first).toEqual(snapshot);
  });

  test('pins representative forest models to a recorded baseline', () => {
    const cases: readonly ForestSettings[] = [
      { seed: 'woodland-glade', density: 'Balanced', character: 'Verdant' },
      { seed: 'emerald-path', density: 'Sparse', character: 'Verdant' },
      { seed: 'ancient-grove', density: 'Cluttered', character: 'Verdant' },
      { seed: 'misty-hollow', density: 'Sparse', character: 'Verdant' },
      { seed: 'sunlit-clearing', density: 'Balanced', character: 'Verdant' },
      { seed: 'twilight-wood', density: 'Cluttered', character: 'Verdant' },
    ];
    expect(cases.map((entry) => `${entry.seed}:${digest(validMap(entry))}`)).toEqual([
      'woodland-glade:29698166a8645d97',
      'emerald-path:a8582675400cbdf5',
      'ancient-grove:ff82d6247de3e426',
      'misty-hollow:493b9d96c6f31361',
      'sunlit-clearing:ec8a1e11d7dc24f9',
      'twilight-wood:8eb0564d9cb955a6',
    ]);
  });

  test('pins every forest character for one seed to a recorded baseline', () => {
    const cases = ALL_FOREST_CHARACTERS.map((character): ForestSettings => ({
      seed: 'character-showcase',
      density: 'Balanced',
      character,
    }));
    expect(cases.map((entry) => `${entry.character}:${digest(validMap(entry))}`)).toEqual([
      'Verdant:836d3da4c685b747',
      'Autumn:76b0b61d97d2d8e9',
      'Pines:4869ae625325dc88',
      'Fey:c26d45b9b446bfb2',
    ]);
  });

  test('satisfies topology and decoration invariants across 30 seeds', () => {
    const densities: readonly Density[] = ['Sparse', 'Balanced', 'Cluttered'];
    for (let seed = 0; seed < 30; seed++) {
      const density = densities[seed % densities.length] ?? 'Balanced';
      const map = validMap({ seed: `forest-batch-${seed}`, density, character: 'Verdant' });
      expect(map.type).toBe('forest');
      expect(map.version).toBe(GENERATOR_VERSION);
      expect(map.layout.tiles).toHaveLength(WIDTH * HEIGHT);
      expect(isWalkable(map.layout, map.layout.pathStart.x, map.layout.pathStart.y)).toBe(true);
      expect(isWalkable(map.layout, map.layout.pathEnd.x, map.layout.pathEnd.y)).toBe(true);

      const floorCount = map.layout.tiles.filter(Boolean).length;
      expect(floorCount).toBeGreaterThan(200);

      const trees = map.decoration.props.filter((p) => p.kind === 'tree');
      expect(trees.length).toBeGreaterThan(0);
      for (const tree of trees) {
        expect(isWalkable(map.layout, tree.x, tree.y)).toBe(false);
      }

      const blocking = new Set<number>();
      for (const prop of map.decoration.props) {
        if (!prop.blocking) continue;
        expect(isWalkable(map.layout, prop.x, prop.y)).toBe(true);
        blocking.add(indexOf(prop.x, prop.y));
      }
    }
  });

  test('satisfies connectivity and budget invariants for every character', () => {
    for (let seed = 0; seed < 8; seed++) {
      for (const character of ALL_FOREST_CHARACTERS) {
        const map = validMap({
          seed: `character-batch-${seed}`,
          density: 'Cluttered',
          character,
        });
        expect(map.decoration.character).toBe(character);
        const blocked = new Set<number>();
        for (const prop of map.decoration.props) {
          if (prop.blocking) {
            expect(isWalkable(map.layout, prop.x, prop.y)).toBe(true);
            blocked.add(indexOf(prop.x, prop.y));
          }
        }
        const floorCount = map.layout.tiles.filter(Boolean).length;
        expect(blocked.size).toBeLessThanOrEqual(Math.floor(floorCount * budgets['Cluttered']));
        const reachable = forestDistances(map.layout.tiles, map.layout.pathStart, blocked);
        expect(reachable.size).toBe(floorCount - blocked.size);
        expect(reachable.has(indexOf(map.layout.pathEnd.x, map.layout.pathEnd.y))).toBe(true);
      }
    }
  });

  test('changing the character preserves the layout, route, endpoints, surface, and revision', () => {
    const original = validMap({
      seed: 'character-change',
      density: 'Balanced',
      character: 'Verdant',
    });
    for (const character of ALL_FOREST_CHARACTERS) {
      const changed = changeForestCharacter(original, character);
      expect(changed.decoration.character).toBe(character);
      expect(changed.layout).toEqual(original.layout);
      expect(changed.surfaceSeed).toBe(original.surfaceSeed);
      expect(changed.seed).toBe(original.seed);
      expect(changed.version).toBe(original.version);
      expect(changed.decoration.density).toBe(original.decoration.density);
      expect(changed.decoration.revision).toBe(original.decoration.revision);
      if (character !== 'Verdant') {
        expect(changed.decoration.props).not.toEqual(original.decoration.props);
      }
      expect(changeForestCharacter(changed, 'Verdant')).toEqual(original);
    }
    expect(shuffleForestDetails(original).decoration.character).toBe('Verdant');
    const autumn = changeForestCharacter(original, 'Autumn');
    expect(shuffleForestDetails(autumn).decoration.character).toBe('Autumn');
  });

  test('detail shuffling and density changes preserve layout and surface', () => {
    const original = validMap({
      seed: 'shuffle-test',
      density: 'Balanced',
      character: 'Verdant',
    });
    const shuffled = shuffleForestDetails(original);
    expect(shuffled.layout).toEqual(original.layout);
    expect(shuffled.surfaceSeed).toBe(original.surfaceSeed);
    expect(shuffled.seed).toBe(original.seed);
    expect(shuffled.decoration.revision).toBe(1);
    expect(shuffled.decoration.props).not.toEqual(original.decoration.props);
    expect(shuffleForestDetails(original)).toEqual(shuffled);

    for (const density of ['Sparse', 'Balanced', 'Cluttered'] as const) {
      const changed = changeForestDensity(shuffled, density);
      expect(changed.layout).toEqual(original.layout);
      expect(changed.surfaceSeed).toBe(original.surfaceSeed);
      expect(changed.decoration.revision).toBe(1);
      expect(changeForestDensity(changed, 'Balanced')).toEqual(shuffled);
    }
  });

  test('rejects invalid settings and bounded impossible placement', () => {
    for (const seed of ['', '   ', 'x'.repeat(65)])
      expect(generateForestClearing({ seed, density: 'Balanced', character: 'Verdant' }).ok).toBe(
        false,
      );
    for (const density of ['Dense', 'balanced', ''] as const)
      expect(
        generateForestClearing({
          seed: 'test',
          density: density as Density,
          character: 'Verdant',
        }),
      ).toEqual({
        ok: false,
        error: 'Choose a valid decoration density.',
      });
    for (const character of ['Weird', 'verdant', ''] as const)
      expect(
        validateForestSettings({
          seed: 'test',
          density: 'Balanced',
          character: character as ForestCharacter,
        }),
      ).toBe('Choose a valid forest character.');
    const failure = generateForestClearing(
      { seed: 'test', density: 'Balanced', character: 'Verdant' },
      { retries: 0 },
    );
    expect(failure.ok).toBe(false);
  });

  test('trims seeds', () => {
    const map = validMap({ seed: 'woodland-glade', density: 'Balanced', character: 'Verdant' });
    expect(
      validMap({ seed: '  woodland-glade  ', density: 'Balanced', character: 'Verdant' }),
    ).toEqual(map);
  });

  test('has enough open space for encounters', () => {
    for (let seed = 0; seed < 10; seed++) {
      const map = validMap({
        seed: `space-test-${seed}`,
        density: 'Balanced',
        character: 'Verdant',
      });
      const floorCount = map.layout.tiles.filter(Boolean).length;
      expect(floorCount).toBeGreaterThanOrEqual(200);
      const centerFloors = [];
      const cx = Math.floor(WIDTH / 2);
      const cy = Math.floor(HEIGHT / 2);
      for (let dy = -5; dy <= 5; dy++) {
        for (let dx = -5; dx <= 5; dx++) {
          if (isWalkable(map.layout, cx + dx, cy + dy))
            centerFloors.push({ x: cx + dx, y: cy + dy });
        }
      }
      expect(centerFloors.length).toBeGreaterThan(50);
    }
  });

  test('route tiles connect path start to path end', () => {
    for (let seed = 0; seed < 20; seed++) {
      const map = validMap({
        seed: `route-connectivity-${seed}`,
        density: 'Balanced',
        character: 'Verdant',
      });
      expect(map.layout.route.length).toBeGreaterThan(0);

      const startIdx = indexOf(map.layout.pathStart.x, map.layout.pathStart.y);
      const endIdx = indexOf(map.layout.pathEnd.x, map.layout.pathEnd.y);

      const routeSet = new Set(map.layout.route);
      expect(routeSet.has(startIdx), `seed=${seed}: route contains path start`).toBe(true);
      expect(routeSet.has(endIdx), `seed=${seed}: route contains path end`).toBe(true);

      const visited = new Set<number>();
      const queue = [startIdx];
      visited.add(startIdx);

      while (queue.length > 0) {
        const current = queue.shift();
        if (current === undefined) continue;
        if (current === endIdx) break;

        const x = current % WIDTH;
        const y = Math.floor(current / WIDTH);
        for (const [dx, dy] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ] as const) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= WIDTH || ny >= HEIGHT) continue;
          const next = indexOf(nx, ny);
          if (routeSet.has(next) && !visited.has(next)) {
            visited.add(next);
            queue.push(next);
          }
        }
      }

      expect(visited.has(endIdx), `seed=${seed}: route connects path start to path end`).toBe(true);
    }
  });

  test('shuffle and density changes maintain full connectivity and constraints', () => {
    for (let seed = 0; seed < 20; seed++) {
      for (const density of ['Sparse', 'Balanced', 'Cluttered'] as const) {
        const map = validMap({
          seed: `connectivity-${seed}`,
          density,
          character: 'Verdant',
        });
        let current = map;

        for (let i = 0; i < 5; i++) {
          current = shuffleForestDetails(current);

          expect(current.decoration.revision).toBe(i + 1);

          expect(current.decoration.density).toBe(density);

          const blocked = new Set<number>();
          for (const prop of current.decoration.props) {
            if (prop.blocking) blocked.add(indexOf(prop.x, prop.y));
          }
          const floorCount = current.layout.tiles.filter(Boolean).length;
          const maxBlocking = Math.floor(floorCount * budgets[density]);
          expect(blocked.size).toBeLessThanOrEqual(maxBlocking);

          const reachable = forestDistances(
            current.layout.tiles,
            current.layout.pathStart,
            blocked,
          );
          const totalWalkable = floorCount - blocked.size;
          expect(
            reachable.size,
            `seed=${seed}, density=${density}, revision=${i}: full connectivity`,
          ).toBe(totalWalkable);

          const endIdx = indexOf(current.layout.pathEnd.x, current.layout.pathEnd.y);
          expect(
            reachable.has(endIdx),
            `seed=${seed}, density=${density}, revision=${i}: start-to-end`,
          ).toBe(true);
        }

        current = changeForestDensity(map, 'Cluttered');
        expect(current.decoration.density).toBe('Cluttered');

        const blocked = new Set<number>();
        for (const prop of current.decoration.props) {
          if (prop.blocking) blocked.add(indexOf(prop.x, prop.y));
        }
        const floorCount = current.layout.tiles.filter(Boolean).length;
        const maxBlocking = Math.floor(floorCount * budgets['Cluttered']);
        expect(blocked.size).toBeLessThanOrEqual(maxBlocking);

        const reachable = forestDistances(current.layout.tiles, current.layout.pathStart, blocked);
        const totalWalkable = floorCount - blocked.size;
        expect(reachable.size, `seed=${seed}, density=Cluttered: full connectivity`).toBe(
          totalWalkable,
        );

        const endIdx = indexOf(current.layout.pathEnd.x, current.layout.pathEnd.y);
        expect(reachable.has(endIdx), `seed=${seed}, density=Cluttered: start-to-end`).toBe(true);
      }
    }
  });
});
