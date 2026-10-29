import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import {
  generateTower,
  changeTowerAppearance,
  shuffleTowerDetails,
  TOWER_STAIR_STYLES,
  isUsableTower,
  towerConnectionReserved,
} from './tower';
import type { Tower } from './tower';
import { towerLaboratoryProps } from './tower-laboratory';

function map(seed = 'laboratory', stairStyle: 'separate' | 'spiral' = 'separate'): Tower {
  const r = generateTower({
    seed,
    floorCount: 8,
    portalFloor: 2,
    density: 'Cluttered',
    stairStyle,
  });
  if (!r.ok) throw new Error(r.error);
  return r.map;
}
test('laboratory requests either fit exactly or report failure without a partial success', () => {
  const covered = new Set<string>();
  for (const stairStyle of TOWER_STAIR_STYLES)
    for (let i = 0; i < 16; i++)
      for (let laboratoryFloor = 1; laboratoryFloor <= 8; laboratoryFloor++) {
        const result = generateTower({
          seed: `laboratory-${i}`,
          floorCount: 8,
          portalFloor: 2,
          density: 'Cluttered',
          stairStyle,
          laboratoryFloor,
        });
        if (!result.ok) {
          expect(result).toEqual({
            ok: false,
            error: 'That laboratory could not fit on that floor. Try another floor or seed.',
          });
          continue;
        }
        covered.add(`${stairStyle}-${laboratoryFloor}`);
        expect(result.map.decoration.laboratoryFloor).toBe(laboratoryFloor);
        expect(isUsableTower(result.map)).toBe(true);
      }
  for (const style of TOWER_STAIR_STYLES)
    for (let floor = 1; floor <= 8; floor++) expect(covered.has(`${style}-${floor}`)).toBe(true);
});
test('adding a laboratory preserves unrelated floor decoration and removing it restores the original model', () => {
  for (const stairStyle of TOWER_STAIR_STYLES)
    for (let i = 0; i < 16; i++) {
      const original = map(`laboratory-${i}`, stairStyle),
        before = structuredClone(original);
      for (const floor of original.layout.floors) {
        const changed = changeTowerAppearance(original, {
          seed: original.seed,
          floorCount: 8,
          portalFloor: 2,
          stairStyle,
          density: 'Cluttered',
          laboratoryFloor: floor.number,
        });
        if (changed.decoration.laboratoryFloor !== floor.number) {
          expect(changed).toBe(original);
          continue;
        }
        const outside = (m: Tower) =>
          m.decoration.props.filter(
            (p) =>
              p.x < floor.x ||
              p.x >= floor.x + floor.width ||
              p.y < floor.y ||
              p.y >= floor.y + floor.height,
          );
        expect(outside(changed)).toEqual(outside(original));
        expect(changed.layout).toBe(original.layout);
        expect(changed.surfaceSeed).toBe(original.surfaceSeed);
        const removed = changeTowerAppearance(changed, {
          seed: original.seed,
          floorCount: 8,
          portalFloor: 2,
          stairStyle,
          density: 'Cluttered',
          laboratoryFloor: null,
        });
        expect(removed).toEqual(original);
        const shuffled = shuffleTowerDetails(changed);
        expect(shuffled.decoration.laboratoryFloor).toBe(floor.number);
        const laboratoryProps = towerLaboratoryProps(changed.layout, floor.number, (p) =>
          towerConnectionReserved(changed.layout, p, changed.version),
        );
        expect(laboratoryProps).toHaveLength(5);
        for (const prop of laboratoryProps ?? [])
          expect(shuffled.decoration.props).toContainEqual(prop);
      }
      expect(original).toEqual(before);
    }
});
test('placement refuses a layout with all connections reserved', () => {
  const original = map();
  expect(towerLaboratoryProps(original.layout, 2, () => true)).toBeUndefined();
});

test('laboratories preserve reachable floor space, connection access and shared blocking budgets', () => {
  for (const stairStyle of TOWER_STAIR_STYLES)
    for (const density of ['Sparse', 'Balanced', 'Cluttered'] as const)
      for (let floorCount = 3; floorCount <= 8; floorCount++)
        for (const portalFloor of [null, 1, floorCount])
          for (let laboratoryFloor = 1; laboratoryFloor <= floorCount; laboratoryFloor++) {
            const r = generateTower({
              seed: `lab-${floorCount}-${portalFloor}`,
              floorCount,
              portalFloor,
              density,
              stairStyle,
              laboratoryFloor,
            });
            if (!r.ok) throw new Error(r.error);
            const m = r.map;
            const f = m.layout.floors.find((f) => f.number === laboratoryFloor);
            if (!f) throw new Error('Missing laboratory floor');
            const cells = new Set<number>();
            for (let y = f.y; y < f.y + f.height; y++)
              for (let x = f.x; x < f.x + f.width; x++)
                if (m.layout.tiles[y * m.layout.width + x]) cells.add(y * m.layout.width + x);
            const blocked = new Set(
              m.decoration.props.filter((p) => p.blocking).map((p) => p.y * m.layout.width + p.x),
            );
            const available = [...cells].filter((i) => !blocked.has(i));
            const first = available[0];
            if (first === undefined) throw new Error('Blocked floor');
            const reached = new Set([first]),
              queue = [first];
            for (let i = 0; i < queue.length; i++) {
              const tile = queue[i];
              if (tile === undefined) continue;
              for (const next of [tile - 1, tile + 1, tile - m.layout.width, tile + m.layout.width])
                if (cells.has(next) && !blocked.has(next) && !reached.has(next)) {
                  reached.add(next);
                  queue.push(next);
                }
            }
            expect(reached.size).toBe(available.length);
            expect([...cells].filter((i) => blocked.has(i)).length).toBeLessThanOrEqual(
              Math.floor(cells.size * { Sparse: 0.05, Balanced: 0.1, Cluttered: 0.15 }[density]),
            );
            for (const c of m.layout.connections) {
              if (c.from === laboratoryFloor)
                expect(reached.has(c.departure.y * m.layout.width + c.departure.x)).toBe(true);
              if (c.to === laboratoryFloor)
                expect(reached.has(c.arrival.y * m.layout.width + c.arrival.x)).toBe(true);
            }
            expect(
              available.some((i) =>
                [i + 1, i + m.layout.width, i + m.layout.width + 1].every(
                  (n) => cells.has(n) && !blocked.has(n),
                ),
              ),
            ).toBe(true);
          }
});

test('maps without a laboratory match the committed pre-feature generator exactly', () => {
  const hashes = {
    separate: '8d35cf9f26c46394ea77221edc5847d7608261763b81e838c91b0921c52a4fce',
    spiral: '1d265bad26e3da0c4766f51dffac39619981b7887a040a86d115a543763d0b08',
  };
  for (const stairStyle of TOWER_STAIR_STYLES) {
    const result = generateTower({
      seed: 'before-laboratory',
      floorCount: 8,
      portalFloor: 2,
      density: 'Cluttered',
      stairStyle,
    });
    expect(createHash('sha256').update(JSON.stringify(result)).digest('hex')).toBe(
      hashes[stairStyle],
    );
    if (result.ok) expect(result.map.decoration).not.toHaveProperty('laboratoryFloor');
  }
});
