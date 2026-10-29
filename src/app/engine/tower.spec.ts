import { expect, test } from 'vitest';
import { ALL_DENSITIES } from './model';
import {
  changeTowerDensity,
  generateTower,
  isUsableTower,
  shuffleTowerDetails,
  TOWER_STAIR_STYLES,
} from './tower';
import type { Tower, TowerSettings } from './tower';

const settings: TowerSettings = {
  seed: 'astral-watch',
  floorCount: 8,
  portalFloor: 2,
  density: 'Balanced',
};
function tower(s: TowerSettings = settings): Tower {
  const result = generateTower(s);
  if (!result.ok) throw new Error(result.error);
  return result.map;
}
function verifyMovement(map: Tower): void {
  const { width, tiles, floors, connections } = map.layout;
  const blocked = new Set(
    map.decoration.props.filter((p) => p.blocking).map((p) => p.y * width + p.x),
  );
  for (const f of floors) {
    const start = (f.y + 6) * width + f.x + 6;
    const visited = new Set([start]),
      queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const tile = queue[i];
      if (tile === undefined) continue;
      for (const next of [tile - 1, tile + 1, tile - width, tile + width])
        if (tiles[next] && !blocked.has(next) && !visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
    }
    expect(visited.size).toBeGreaterThan(80);
    for (const c of connections) {
      if (c.from === f.number)
        expect(visited.has(c.departure.y * width + c.departure.x)).toBe(true);
      if (c.to === f.number) expect(visited.has(c.arrival.y * width + c.arrival.x)).toBe(true);
    }
  }
  const reached = new Set([1]);
  for (let i = 0; i < floors.length; i++)
    for (const c of connections) if (reached.has(c.from)) reached.add(c.to);
  expect(reached.size).toBe(floors.length);
}
test('all counts, densities and portal source choices are deterministic, connected, bounded and immutable', () => {
  for (const stairStyle of TOWER_STAIR_STYLES)
    for (let count = 3; count <= 8; count++)
      for (const density of ALL_DENSITIES)
        for (const source of [null, ...Array.from({ length: count }, (_, i) => i + 1)]) {
          const input = Object.freeze({
            seed: `watch-${count}-${source}`,
            stairStyle,
            floorCount: count,
            portalFloor: source,
            density,
          });
          const map = tower(input),
            before = structuredClone(map);
          expect(tower(input)).toEqual(map);
          expect(isUsableTower(map)).toBe(true);
          expect(map.layout.floors).toHaveLength(count);
          expect(map.layout.connections.filter((c) => c.kind === 'portal')).toHaveLength(
            source === null ? 0 : 1,
          );
          expect(map.layout.floors.filter((f) => f.secret)).toHaveLength(source === null ? 0 : 1);
          if (source !== null) {
            expect(map.layout.connections.at(-1)).toMatchObject({
              from: source,
              to: map.layout.floors.find((f) => f.secret)?.number,
              kind: 'portal',
            });
            expect(
              map.layout.connections
                .filter((c) => c.kind === 'stairs')
                .some(
                  (c) =>
                    c.to === map.layout.floors.find((f) => f.secret)?.number ||
                    c.from === map.layout.floors.find((f) => f.secret)?.number,
                ),
            ).toBe(false);
          }
          verifyMovement(map);
          const shuffled = shuffleTowerDetails(map);
          expect(shuffled.layout).toBe(map.layout);
          expect(shuffled.surfaceSeed).toBe(map.surfaceSeed);
          expect(shuffled.decoration.revision).toBe(1);
          expect(isUsableTower(shuffled)).toBe(true);
          verifyMovement(shuffled);
          const sparse = changeTowerDensity(map, 'Sparse');
          expect(sparse.layout).toBe(map.layout);
          expect(sparse.decoration.revision).toBe(0);
          expect(isUsableTower(sparse)).toBe(true);
          expect(map).toEqual(before);
        }
});
test('rejects invalid settings before generation', () => {
  for (const changes of [
    { seed: '' },
    { seed: ' '.repeat(65) },
    { seed: 'x'.repeat(65) },
    { floorCount: 2 },
    { floorCount: 9 },
    { floorCount: 3.5 },
    { floorCount: NaN },
    { portalFloor: 0 },
    { portalFloor: 9 },
    { portalFloor: 1.5 },
    { portalFloor: NaN },
    { density: 'Unknown' },
    { stairStyle: 'Unknown' },
  ])
    expect(generateTower({ ...settings, ...changes } as TowerSettings).ok).toBe(false);
  expect(tower({ ...settings, seed: '  watch  ' }).seed).toBe('watch');
});
test('rejects malformed geometry, connections, destinations, sizes and decoration with a valid map still recoverable', () => {
  const map = tower();
  const invalid: unknown[] = [
    null,
    {},
    { ...map, version: '99.0.0' },
    { ...map, seed: '' },
    { ...map, surfaceSeed: NaN },
    { ...map, layout: { ...map.layout, width: 1e100 } },
    { ...map, layout: { ...map.layout, tiles: [] } },
    { ...map, layout: { ...map.layout, floors: Array(100).fill(map.layout.floors[0]) } },
    { ...map, layout: { ...map.layout, portalFloor: 9 } },
    { ...map, layout: { ...map.layout, connections: [] } },
    {
      ...map,
      layout: {
        ...map.layout,
        connections: map.layout.connections.map((c) => ({ ...c, kind: 'portal' })),
      },
    },
    {
      ...map,
      layout: { ...map.layout, floors: map.layout.floors.map((f) => ({ ...f, secret: false })) },
    },
    { ...map, decoration: { ...map.decoration, revision: -1 } },
    {
      ...map,
      decoration: {
        ...map.decoration,
        props: [{ kind: 'crate', x: 0, y: 0, blocking: true, variation: 0.5 }],
      },
    },
    {
      ...map,
      decoration: { ...map.decoration, props: [...map.decoration.props, ...map.decoration.props] },
    },
  ];
  for (const value of invalid) expect(isUsableTower(value)).toBe(false);
  expect(isUsableTower(map)).toBe(true);
});

test('each regular floor uses one aligned staircase, with a seed-dependent position', () => {
  const sites = new Set<string>();
  for (let i = 0; i < 24; i++) {
    const map = tower({ ...settings, seed: `stairs-${i}`, portalFloor: null });
    const relative = new Set<string>();
    for (const floor of map.layout.floors) {
      const landings = map.layout.connections
        .filter((c) => c.kind === 'stairs')
        .flatMap((c) =>
          c.from === floor.number ? [c.departure] : c.to === floor.number ? [c.arrival] : [],
        );
      expect(new Set(landings.map((p) => `${p.x},${p.y}`)).size).toBe(1);
      for (const p of landings) relative.add(`${p.x - floor.x},${p.y - floor.y}`);
    }
    expect(relative.size).toBe(1);
    for (const p of relative) sites.add(p);
  }
  expect(sites.size).toBeGreaterThan(4);
});

test('seed varies the secret floor and both portal ends while excluding entrance and source', () => {
  const destinations = new Set<number>(),
    departures = new Set<string>(),
    arrivals = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const map = tower({ ...settings, seed: `portals-${i}` });
    const portal = map.layout.connections.find((c) => c.kind === 'portal'),
      secret = map.layout.floors.find((f) => f.secret),
      source = map.layout.floors.find((f) => f.number === settings.portalFloor);
    if (!portal || !secret || !source) throw new Error('Missing portal');
    expect(secret.number).not.toBe(1);
    expect(secret.number).not.toBe(source.number);
    expect(portal.from).toBe(source.number);
    expect(portal.to).toBe(secret.number);
    destinations.add(secret.number);
    departures.add(`${portal.departure.x - source.x},${portal.departure.y - source.y}`);
    arrivals.add(`${portal.arrival.x - secret.x},${portal.arrival.y - secret.y}`);
    verifyMovement(map);
  }
  expect(destinations.size).toBeGreaterThan(3);
  expect(departures.size).toBeGreaterThan(4);
  expect(arrivals.size).toBeGreaterThan(4);
});

test('separate staircase style retains distinct up and down flights on intermediate floors', () => {
  const result = generateTower({
    ...settings,
    portalFloor: null,
    stairStyle: 'separate',
  } as TowerSettings);
  if (!result.ok) throw new Error(result.error);
  const map = result.map;
  for (const floor of map.layout.floors.slice(1, -1)) {
    const points = map.layout.connections.flatMap((c) =>
      c.kind !== 'stairs'
        ? []
        : c.from === floor.number
          ? [c.departure]
          : c.to === floor.number
            ? [c.arrival]
            : [],
    );
    expect(new Set(points.map((p) => `${p.x},${p.y}`)).size).toBe(2);
  }
});
