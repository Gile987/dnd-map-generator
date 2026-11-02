import { expect, test } from 'vitest';
import {
  generateCourtyard,
  changeCourtyardAppearance,
  shuffleCourtyardDetails,
} from './courtyard-generate';
import {
  validateCourtyard,
  courtyardProtectedCells,
  fountainSite,
  areaCells,
} from './courtyard-validation';
import { placeCollapsedWagon } from './courtyard-wagon';
import { ALL_DENSITIES, DENSITY_BUDGETS, indexOf } from './model';
import type { RuinedCourtyard } from './model';

function assertSpace(map: RuinedCourtyard) {
  const blocked = new Set<number>(),
    occupied = new Set<number>();
  for (const p of map.decoration.props) {
    const odd = (p.rotation ?? 0) % 2 === 1;
    const width = odd ? (p.footprint?.height ?? 1) : (p.footprint?.width ?? 1),
      height = odd ? (p.footprint?.width ?? 1) : (p.footprint?.height ?? 1);
    for (let dy = 0; dy < height; dy++)
      for (let dx = 0; dx < width; dx++) {
        const i = (p.y + dy) * 40 + p.x + dx;
        expect(occupied.has(i)).toBe(false);
        occupied.add(i);
        expect(map.layout.tiles[i]).toBe(true);
        if (p.blocking) blocked.add(i);
      }
  }
  const queue = [0],
    visited = new Set(queue);
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
  expect(blocked.size).toBeLessThanOrEqual(
    Math.floor(map.layout.tiles.filter(Boolean).length * DENSITY_BUDGETS[map.decoration.density]),
  );
  for (const i of courtyardProtectedCells(map.layout)) {
    expect(visited.has(i)).toBe(true);
    expect(occupied.has(i)).toBe(false);
  }
  const wagon = map.decoration.props.find((p) => p.kind === 'collapsed_wagon');
  if (!wagon) throw new Error('Missing wagon');
  const w = (wagon.rotation ?? 0) % 2 ? 2 : 3,
    h = (wagon.rotation ?? 0) % 2 ? 3 : 2;
  for (let y = wagon.y - 1; y <= wagon.y + h; y++)
    for (let x = wagon.x - 1; x <= wagon.x + w; x++)
      if (x === wagon.x - 1 || x === wagon.x + w || y === wagon.y - 1 || y === wagon.y + h)
        expect(blocked.has(y * 40 + x)).toBe(false);
}

test('wagons coexist with fountains across densities/seeds, preserve circulation and restore original decoration exactly', () => {
  const rotations = new Set<number>(),
    positions = new Set<string>();
  for (const density of ALL_DENSITIES)
    for (const fountain of [false, true]) {
      let successes = 0;
      for (let n = 0; n < 15; n++) {
        const settings = { seed: `wagon-${n}`, density, fountain };
        const original = generateCourtyard(settings);
        if (!original.ok) throw new Error(original.error);
        const before = structuredClone(original.map),
          r = generateCourtyard({ ...settings, wagon: true });
        if (!r.ok) {
          expect(r.error).toContain('could not fit');
          continue;
        }
        successes++;
        const map = r.map;
        expect(validateCourtyard(map)).toBeUndefined();
        assertSpace(map);
        expect(changeCourtyardAppearance(original.map, { ...settings, wagon: true })).toEqual(map);
        expect(changeCourtyardAppearance(map, { ...settings, wagon: false })).toEqual(original.map);
        const body = map.decoration.props.find((p) => p.kind === 'collapsed_wagon');
        if (!body) throw new Error('Missing wagon');
        rotations.add(body.rotation ?? 0);
        positions.add(`${body.x},${body.y}`);
        const shuffled = shuffleCourtyardDetails(map);
        expect(shuffled.layout).toBe(map.layout);
        expect(shuffled.surfaceSeed).toBe(map.surfaceSeed);
        assertSpace(shuffled);
        for (const p of map.decoration.props.filter((p) =>
          ['collapsed_wagon', 'wagon_wheel', 'spilled_crate', 'spilled_goods'].includes(p.kind),
        ))
          expect(shuffled.decoration.props).toContainEqual(p);
        const removed = changeCourtyardAppearance(shuffled, { ...settings, wagon: false });
        expect(removed).toEqual(shuffleCourtyardDetails(original.map));
        expect(original.map).toEqual(before);
      }
      expect(successes).toBeGreaterThanOrEqual(12);
    }
  expect(rotations).toEqual(new Set([0, 1]));
  expect(positions.size).toBeGreaterThan(5);
});

test('impossible sites and invalid settings refuse without a partial wagon', () => {
  const r = generateCourtyard({ seed: 'ivy-court', density: 'Balanced', fountain: true });
  if (!r.ok) throw new Error(r.error);
  expect(
    placeCollapsedWagon(
      r.map.layout,
      r.map.seed,
      new Set(Array.from({ length: 1200 }, (_, i) => i)),
    ),
  ).toBeUndefined();
  expect(
    generateCourtyard({
      seed: 'ivy-court',
      density: 'Balanced',
      fountain: false,
      wagon: 'yes' as never,
    }),
  ).toMatchObject({ ok: false });
  expect(
    changeCourtyardAppearance(r.map, {
      density: 'Balanced',
      fountain: true,
      wagon: 'yes' as never,
    }),
  ).toBe(r.map);
  const protectedCells = courtyardProtectedCells(r.map.layout),
    site = fountainSite(r.map.layout);
  for (const p of areaCells({ x: site.x - 1, y: site.y - 1, width: 5, height: 5 }))
    protectedCells.add(indexOf(p.x, p.y));
  expect(placeCollapsedWagon(r.map.layout, r.map.seed, protectedCells)?.props).toHaveLength(4);
});
