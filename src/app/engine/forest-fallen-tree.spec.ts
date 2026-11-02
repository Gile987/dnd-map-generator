import { expect, test } from 'vitest';
import {
  generateForestClearing,
  changeForestAppearance,
  shuffleForestDetails,
  changeForestCharacter,
} from './forest-generate';
import { validateForest } from './forest-validation';
import {
  ALL_FOREST_CHARACTERS,
  ALL_DENSITIES,
  DENSITY_BUDGETS,
  FALLEN_TREE_PROP_KINDS,
} from './model';
import type { ForestClearing } from './model';
import { fallenTreeSite } from './forest-fallen-tree';
function assertSpace(map: ForestClearing) {
  const blocked = new Set<number>();
  for (const p of map.decoration.props.filter((p) => p.blocking)) {
    const width = (p.rotation ?? 0) % 2 ? (p.footprint?.height ?? 1) : (p.footprint?.width ?? 1),
      height = (p.rotation ?? 0) % 2 ? (p.footprint?.width ?? 1) : (p.footprint?.height ?? 1);
    for (let dy = 0; dy < height; dy++)
      for (let dx = 0; dx < width; dx++) {
        const tile = (p.y + dy) * 40 + p.x + dx;
        expect(map.layout.tiles[tile]).toBe(true);
        expect(map.layout.route).not.toContain(tile);
        expect(blocked.has(tile)).toBe(false);
        blocked.add(tile);
      }
  }
  const first = map.layout.pathStart.y * 40 + map.layout.pathStart.x,
    visited = new Set([first]),
    queue = [first];
  for (let i = 0; i < queue.length; i++) {
    const tile = queue[i];
    if (tile === undefined) continue;
    const x = tile % 40,
      y = Math.floor(tile / 40);
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ])
      if (nx !== undefined && ny !== undefined && nx >= 0 && nx < 40 && ny >= 0 && ny < 30) {
        const n = ny * 40 + nx;
        if (map.layout.tiles[n] && !blocked.has(n) && !visited.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      }
  }
  expect(visited.size).toBe(map.layout.tiles.filter(Boolean).length - blocked.size);
  for (const tile of map.layout.route) expect(visited.has(tile)).toBe(true);
  expect(blocked.size).toBeLessThanOrEqual(
    Math.floor(map.layout.tiles.filter(Boolean).length * DENSITY_BUDGETS[map.decoration.density]),
  );
  expect(
    [...visited].some((i) => i % 40 < 39 && [i + 1, i + 40, i + 41].every((n) => visited.has(n))),
  ).toBe(true);
}
test.each(ALL_FOREST_CHARACTERS)(
  '%s fallen trees retain paths, complete camps and circles, blocking budgets, determinism and exact removal',
  (character) => {
    const covered = new Set<string>(),
      rotations = new Set<number>();
    for (const density of ALL_DENSITIES)
      for (const camp of [false, true])
        for (const circle of [false, true])
          for (let n = 0; n < 4; n++) {
            const settings = {
              seed: `fallen-${n}`,
              character,
              density,
              scene: camp ? ('Abandoned camp' as const) : ('None' as const),
              landmark: circle ? ('standing-stone-circle' as const) : ('None' as const),
            };
            const original = generateForestClearing(settings);
            if (!original.ok) continue;
            const before = structuredClone(original.map),
              changed = changeForestAppearance(original.map, { ...settings, fallenTree: true });
            if (!changed.decoration.fallenTree) {
              expect(changed).toBe(original.map);
              continue;
            }
            covered.add(`${character}-${density}`);
            expect(validateForest(changed)).toBeUndefined();
            assertSpace(changed);
            expect(changed.layout).toBe(original.map.layout);
            expect(changed.surfaceSeed).toBe(original.map.surfaceSeed);
            for (const p of original.map.decoration.props.filter((p) =>
              ['tent', 'bedroll', 'fire_ring', 'supply_bundle', 'standing_stone'].includes(p.kind),
            ))
              expect(changed.decoration.props).toContainEqual(p);
            const pack = changed.decoration.props.filter((p) =>
              FALLEN_TREE_PROP_KINDS.some((kind) => kind === p.kind),
            );
            expect(pack).toHaveLength(4);
            const body = pack.find((p) => p.kind === 'fallen_trunk');
            if (!body) throw new Error('Missing trunk');
            rotations.add(body.rotation ?? 0);
            expect(changeForestAppearance(changed, { ...settings, fallenTree: false })).toEqual(
              original.map,
            );
            const shuffled = shuffleForestDetails(changed);
            expect(shuffled.layout).toBe(changed.layout);
            expect(shuffled.decoration.fallenTree).toBe(true);
            assertSpace(shuffled);
            expect(original.map).toEqual(before);
          }
    for (const density of ALL_DENSITIES) expect(covered.has(`${character}-${density}`)).toBe(true);
    expect(rotations).toEqual(new Set([0, 1]));
  },
);
test('full generation includes the complete request or reports bounded failure; character changes retain the addition', () => {
  for (const character of ALL_FOREST_CHARACTERS) {
    const settings = {
      seed: 'woodland-glade',
      character,
      density: 'Balanced' as const,
      fallenTree: true,
    };
    const r = generateForestClearing(settings);
    if (!r.ok) throw new Error(r.error);
    expect(generateForestClearing(settings)).toEqual(r);
    expect(r.map.decoration.fallenTree).toBe(true);
    assertSpace(r.map);
    for (const next of ALL_FOREST_CHARACTERS) {
      const changed = changeForestCharacter(r.map, next);
      expect(changed.decoration.fallenTree).toBe(true);
      expect(changed.layout).toBe(r.map.layout);
      assertSpace(changed);
    }
    const impossible = {
      ...r.map.layout,
      route: r.map.layout.tiles.flatMap((tile, i) => (tile ? [i] : [])),
    };
    expect(fallenTreeSite(impossible, [], 'no-space', 'Balanced', 0)).toBeUndefined();
  }
  expect(
    generateForestClearing({
      seed: 'tree',
      character: 'Verdant',
      density: 'Balanced',
      fallenTree: 'yes' as never,
    }),
  ).toMatchObject({ ok: false });
  const clean = generateForestClearing({
    seed: 'woodland-glade',
    character: 'Verdant',
    density: 'Balanced',
  });
  if (!clean.ok) throw new Error(clean.error);
  expect(
    changeForestAppearance(clean.map, { ...clean.map.decoration, fallenTree: 'yes' as never }),
  ).toBe(clean.map);
});
