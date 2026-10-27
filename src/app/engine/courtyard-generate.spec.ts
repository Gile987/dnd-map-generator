import { describe, expect, test } from 'vitest';
import {
  changeCourtyardAppearance,
  generateCourtyard,
  shuffleCourtyardDetails,
} from './courtyard-generate';
import { validateCourtyard } from './courtyard-validation';
import { ALL_DENSITIES, DENSITY_BUDGETS, HEIGHT, WIDTH, indexOf } from './model';
import type { CourtyardSettings, RuinedCourtyard } from './model';

function courtyard(settings: Partial<CourtyardSettings> = {}): RuinedCourtyard {
  const result = generateCourtyard({
    seed: 'ivy-court',
    density: 'Balanced',
    fountain: true,
    ...settings,
  });
  if (!result.ok) throw new Error(result.error);
  return result.map;
}

// Independent test traversal and footprint expansion avoid validating the engine with itself.
function assertOpen(map: RuinedCourtyard): void {
  const blocked = new Set<number>();
  for (const prop of map.decoration.props) {
    for (let dy = 0; dy < (prop.footprint?.height ?? 1); dy++)
      for (let dx = 0; dx < (prop.footprint?.width ?? 1); dx++) {
        const tile = (prop.y + dy) * 40 + prop.x + dx;
        expect(map.layout.tiles[tile]).toBe(true);
        if (prop.blocking) {
          expect(blocked.has(tile)).toBe(false);
          blocked.add(tile);
        }
      }
  }
  const visited = new Set([0]);
  const queue = [0];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    if (current === undefined) continue;
    const x = current % 40,
      y = Math.floor(current / 40);
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx === undefined || ny === undefined || nx < 0 || nx >= 40 || ny < 0 || ny >= 30)
        continue;
      const next = ny * 40 + nx;
      if (visited.has(next) || blocked.has(next) || !map.layout.tiles[next]) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  expect(visited.size).toBe(map.layout.tiles.filter(Boolean).length - blocked.size);
  expect(blocked.size).toBeLessThanOrEqual(
    Math.floor(map.layout.tiles.filter(Boolean).length * DENSITY_BUDGETS[map.decoration.density]),
  );
  const e = map.layout.encounter;
  for (let y = e.y; y < e.y + 6; y++)
    for (let x = e.x; x < e.x + 6; x++) {
      expect(visited.has(y * 40 + x)).toBe(true);
      expect(map.decoration.props.some((p) => p.x === x && p.y === y)).toBe(false);
    }
  for (const [side, p] of map.layout.approaches.entries())
    for (let d = -1; d <= 1; d++) {
      const tile = side % 2 === 0 ? p.y * 40 + p.x + d : (p.y + d) * 40 + p.x;
      expect(visited.has(tile)).toBe(true);
      expect(blocked.has(tile)).toBe(false);
    }
  expect(map.decoration.props.filter((p) => p.kind === 'dry_fountain')).toHaveLength(
    map.decoration.fountain ? 1 : 0,
  );
}

describe.each(ALL_DENSITIES)('%s courtyards', (density) => {
  test.each([false, true])(
    'ten seeds stay open with fountain=%s, including after shuffling',
    (fountain) => {
      for (let n = 0; n < 10; n++) {
        const map = courtyard({ seed: `ruin-${n}`, density, fountain });
        expect(validateCourtyard(map)).toBeUndefined();
        assertOpen(map);
        const next = shuffleCourtyardDetails(map);
        expect(next).not.toBe(map);
        expect(validateCourtyard(next)).toBeUndefined();
        assertOpen(next);
      }
    },
  );
});

test('seeded models vary their walls and approaches and reproduce without ambient randomness', () => {
  const maps = ['ivy-court', 'fallen-crown', 'sunken-abbey'].map((seed) => courtyard({ seed }));
  expect(new Set(maps.map((m) => JSON.stringify(m.layout))).size).toBe(3);
  for (const map of maps) expect(courtyard({ seed: map.seed })).toEqual(map);
  expect(courtyard({ seed: '  ivy-court  ' })).toEqual(maps[0]);
});

test('appearance changes and shuffles retain the layout and surface, without changing callers', () => {
  const map = courtyard();
  const before = structuredClone(map);
  const next = shuffleCourtyardDetails(map);
  const changed = changeCourtyardAppearance(next, { density: 'Sparse', fountain: false });
  expect(map).toEqual(before);
  expect(changed.layout).toBe(map.layout);
  expect(changed.surfaceSeed).toBe(map.surfaceSeed);
  expect(changed.decoration.revision).toBe(1);
  expect(changed.decoration.fountain).toBe(false);
  assertOpen(changed);
  const restored = changeCourtyardAppearance(changed, { density: 'Balanced', fountain: true });
  expect(restored).toEqual(next);
});

test('appearance commands use only appearance settings, even when passed full generator settings', () => {
  const original = courtyard({ fountain: false });
  const settings: CourtyardSettings = {
    seed: 'an-unapplied-seed',
    density: 'Balanced',
    fountain: true,
  };
  const changed = changeCourtyardAppearance(original, settings);
  expect(changed).toEqual(courtyard({ fountain: true }));
  expect(changed.decoration).not.toHaveProperty('seed');
  expect(settings.seed).toBe('an-unapplied-seed');
});

test('rejects invalid settings and obstructed or disconnected courtyard geometry', () => {
  expect(generateCourtyard({ seed: ' ', density: 'Balanced', fountain: false })).toMatchObject({
    ok: false,
  });
  expect(
    generateCourtyard({ seed: 'x'.repeat(65), density: 'Balanced', fountain: false }),
  ).toMatchObject({ ok: false });
  const map = courtyard();
  const tiles = [...map.layout.tiles];
  const gate = map.layout.approaches[0];
  if (!gate) throw new Error('Missing gate');
  tiles[indexOf(gate.x, gate.y)] = false;
  expect(validateCourtyard({ ...map, layout: { ...map.layout, tiles } })).toMatch(/approach/);
  const divided = map.layout.tiles.map((tile, i) => (i % WIDTH === 20 ? false : tile));
  expect(validateCourtyard({ ...map, layout: { ...map.layout, tiles: divided } })).toBeDefined();
  expect(map.layout.tiles).toHaveLength(WIDTH * HEIGHT);
});
