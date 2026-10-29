import type { Point } from './model';
import type { Tower } from './tower';
export interface StairRoute {
  readonly id: string;
  readonly direction: 'up' | 'down';
  readonly destination: number;
}
export interface StairLanding extends Point {
  readonly floor: number;
  readonly routes: readonly StairRoute[];
}
/** Several inter-floor links can share one physical staircase. */
export function towerStairLandings(map: Tower): readonly StairLanding[] {
  const landings = new Map<string, { x: number; y: number; floor: number; routes: StairRoute[] }>();
  for (const c of map.layout.connections) {
    if (c.kind !== 'stairs') continue;
    for (const [p, floor, destination, direction] of [
      [c.departure, c.from, c.to, 'up'],
      [c.arrival, c.to, c.from, 'down'],
    ] as const) {
      const key = `${floor}:${p.x}:${p.y}`;
      let landing = landings.get(key);
      if (!landing) {
        landing = { ...p, floor, routes: [] };
        landings.set(key, landing);
      }
      landing.routes.push({ id: c.id, direction, destination });
    }
  }
  return [...landings.values()].map((l) => ({
    ...l,
    routes: l.routes.sort(
      (a, b) => Number(a.direction === 'down') - Number(b.direction === 'down'),
    ),
  }));
}
