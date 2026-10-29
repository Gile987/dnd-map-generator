import { expect, test } from 'vitest';
import { generateTower, TOWER_STAIR_STYLES } from './tower';
import { towerStairLandings } from './tower-landings';

test('a shared landing lists both directions and skips the portal-only floor', () => {
  for (let count = 3; count <= 8; count++)
    for (const portalFloor of [null, 1, count]) {
      const result = generateTower({
        seed: `landings-${count}`,
        floorCount: count,
        portalFloor,
        density: 'Balanced',
      });
      if (!result.ok) throw new Error(result.error);
      const map = result.map,
        before = structuredClone(map),
        regular = map.layout.floors.filter((f) => !f.secret),
        landings = towerStairLandings(map);
      expect(landings).toHaveLength(regular.length);
      for (const [i, floor] of regular.entries()) {
        const landing = landings.find((l) => l.floor === floor.number);
        if (!landing) throw new Error('Missing staircase');
        const up = regular[i + 1],
          down = regular[i - 1];
        expect(
          landing.routes.filter((r) => r.direction === 'up').map((r) => r.destination),
        ).toEqual(up ? [up.number] : []);
        expect(
          landing.routes.filter((r) => r.direction === 'down').map((r) => r.destination),
        ).toEqual(down ? [down.number] : []);
        for (const route of landing.routes) {
          const link = map.layout.connections.find((c) => c.id === route.id);
          expect(link?.kind).toBe('stairs');
          expect([link?.from, link?.to]).toContain(floor.number);
          expect([link?.from, link?.to]).toContain(route.destination);
        }
      }
      expect(map).toEqual(before);
    }
});

test('connection artwork and destination captions stay inside the circular floor, away from props', () => {
  for (const stairStyle of TOWER_STAIR_STYLES)
    for (let i = 0; i < 32; i++) {
      const result = generateTower({
        seed: `clearance-${i}`,
        stairStyle,
        floorCount: 8,
        portalFloor: 2,
        density: 'Cluttered',
      });
      if (!result.ok) throw new Error(result.error);
      const map = result.map;
      const endpoints = [
        ...towerStairLandings(map).map((l) => ({
          ...l,
          halfWidth: stairStyle === 'separate' ? 1.25 : 1.65,
          bottom: stairStyle === 'separate' ? 1.72 : 1.03 + l.routes.length * 0.75,
          radius: stairStyle === 'separate' ? 1.15 : 0.95,
        })),
        ...map.layout.connections
          .filter((c) => c.kind === 'portal')
          .flatMap((c) => [
            { ...c.departure, floor: c.from, halfWidth: 1.25, bottom: 1.72, radius: 0.8 },
            { ...c.arrival, floor: c.to, halfWidth: 1.25, bottom: 1.72, radius: 0.8 },
          ]),
      ];
      for (const p of endpoints) {
        const floor = map.layout.floors.find((f) => f.number === p.floor);
        if (!floor) throw new Error('Missing floor');
        const x = p.x + 0.5 - floor.x,
          y = p.y + 0.5 - floor.y;
        expect(Math.hypot(x - 7, y - 6.5) + p.radius).toBeLessThan(5.75);
        for (const dx of [-p.halfWidth, p.halfWidth])
          for (const dy of [1, p.bottom])
            expect(Math.hypot(x + dx - 7, y + dy - 6.5)).toBeLessThan(5.75);
        for (const prop of map.decoration.props) {
          if (
            prop.x < floor.x ||
            prop.x >= floor.x + floor.width ||
            prop.y < floor.y ||
            prop.y >= floor.y + floor.height
          )
            continue;
          // Reserve full prop cells against the destination-caption rectangle.
          const overlap =
            prop.x < p.x + 0.5 + p.halfWidth &&
            prop.x + 1 > p.x + 0.5 - p.halfWidth &&
            prop.y < p.y + 0.5 + p.bottom &&
            prop.y + 1 > p.y + 1.5;
          expect(overlap).toBe(false);
        }
      }
    }
});
