import { expect, test } from 'vitest';
import {
  generateTower,
  changeTowerAppearance,
  shuffleTowerDetails,
  isUsableTower,
  towerConnectionReserved,
  TOWER_STAIR_STYLES,
} from './tower';
import type { Tower, TowerSettings } from './tower';
import { towerObservatoryProps } from './tower-observatory';
import { DENSITY_BUDGETS } from './model';

function assertSpace(map: Tower, number: number) {
  const floor = map.layout.floors.find((f) => f.number === number);
  if (!floor) throw new Error('Missing floor');
  const cells = new Set<number>();
  for (let y = floor.y; y < floor.y + floor.height; y++)
    for (let x = floor.x; x < floor.x + floor.width; x++)
      if (map.layout.tiles[y * map.layout.width + x]) cells.add(y * map.layout.width + x);
  const blocked = new Set(
    map.decoration.props.filter((p) => p.blocking).map((p) => p.y * map.layout.width + p.x),
  );
  const free = [...cells].filter((i) => !blocked.has(i));
  const first = free[0];
  if (first === undefined) throw new Error('Blocked floor');
  const queue = [first],
    visited = new Set(queue);
  for (let i = 0; i < queue.length; i++) {
    const tile = queue[i];
    if (tile === undefined) continue;
    for (const next of [tile - 1, tile + 1, tile - map.layout.width, tile + map.layout.width])
      if (cells.has(next) && !blocked.has(next) && !visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
  }
  expect(visited.size).toBe(free.length);
  expect(cells.size - free.length).toBeLessThanOrEqual(
    Math.floor(cells.size * DENSITY_BUDGETS[map.decoration.density]),
  );
  expect(
    free.some((i) =>
      [i + 1, i + map.layout.width, i + map.layout.width + 1].every(
        (n) => cells.has(n) && !blocked.has(n),
      ),
    ),
  ).toBe(true);
  for (const c of map.layout.connections) {
    if (c.from === number)
      expect(visited.has(c.departure.y * map.layout.width + c.departure.x)).toBe(true);
    if (c.to === number)
      expect(visited.has(c.arrival.y * map.layout.width + c.arrival.x)).toBe(true);
  }
}

test('observatories preserve reachable space, unrelated floors and exact removal across styles, counts, densities and portals', () => {
  const covered = new Set<string>();
  for (const stairStyle of TOWER_STAIR_STYLES)
    for (let floorCount = 3; floorCount <= 8; floorCount++)
      for (const density of ['Sparse', 'Balanced', 'Cluttered'] as const)
        for (const portalFloor of [null, 2])
          for (let observatoryFloor = 1; observatoryFloor <= floorCount; observatoryFloor++) {
            const settings: TowerSettings = {
              seed: `observatory-${floorCount}`,
              floorCount,
              portalFloor,
              density,
              stairStyle,
              laboratoryFloor: observatoryFloor === 2 ? 1 : 2,
            };
            const base = generateTower(settings);
            if (!base.ok) continue;
            const before = structuredClone(base.map);
            const result = generateTower({ ...settings, observatoryFloor });
            if (!result.ok) {
              expect(result.error).toContain('could not fit');
              continue;
            }
            covered.add(`${stairStyle}-${observatoryFloor}`);
            const map = result.map;
            expect(map).toEqual(changeTowerAppearance(base.map, { ...settings, observatoryFloor }));
            expect(isUsableTower(map)).toBe(true);
            assertSpace(map, observatoryFloor);
            assertSpace(map, settings.laboratoryFloor ?? 2);
            const props = towerObservatoryProps(map.layout, observatoryFloor, (p) =>
              towerConnectionReserved(map.layout, p, map.version),
            );
            expect(props).toHaveLength(4);
            for (const prop of props ?? []) {
              expect(map.decoration.props).toContainEqual(prop);
              expect(towerConnectionReserved(map.layout, prop, map.version)).toBe(false);
            }
            const outside = (m: Tower) =>
              m.decoration.props.filter((p) => !props?.some((q) => p.x === q.x && p.y === q.y));
            // All ordinary and fixed objects outside this floor retain their exact values.
            const f = map.layout.floors[observatoryFloor - 1];
            if (!f) throw new Error('Missing floor');
            const others = (m: Tower) =>
              outside(m).filter(
                (p) => p.x < f.x || p.x >= f.x + f.width || p.y < f.y || p.y >= f.y + f.height,
              );
            expect(others(map)).toEqual(others(base.map));
            const removed = changeTowerAppearance(map, { ...settings, observatoryFloor: null });
            expect(removed).toEqual(base.map);
            const shuffled = shuffleTowerDetails(map);
            expect(shuffled.layout).toBe(map.layout);
            for (const prop of props ?? []) expect(shuffled.decoration.props).toContainEqual(prop);
            expect(isUsableTower(shuffled)).toBe(true);
            expect(base.map).toEqual(before);
          }
  for (const style of TOWER_STAIR_STYLES)
    for (let floor = 1; floor <= 8; floor++) expect(covered.has(`${style}-${floor}`)).toBe(true);
});

test('invalid or conflicting floor choices and impossible placement refuse without partial changes', () => {
  const settings: TowerSettings = {
    seed: 'astral-watch',
    floorCount: 4,
    portalFloor: null,
    density: 'Balanced',
    laboratoryFloor: 2,
  };
  const base = generateTower(settings);
  if (!base.ok) throw new Error(base.error);
  for (const observatoryFloor of [0, 5, -1, 1.5, NaN, Infinity, 2]) {
    expect(generateTower({ ...settings, observatoryFloor }).ok).toBe(false);
    expect(changeTowerAppearance(base.map, { ...settings, observatoryFloor })).toBe(base.map);
  }
  expect(towerObservatoryProps(base.map.layout, 4, () => true)).toBeUndefined();
});
