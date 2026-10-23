import { describe, expect, test } from 'vitest';
import { ALL_DENSITIES, ALL_FOREST_CHARACTERS, DENSITY_BUDGETS, WIDTH, indexOf } from './model';
import type { ForestClearing, ForestSettings } from './model';
import { CAMP_PROP_KINDS } from './forest-camp';
import {
  changeForestAppearance,
  changeForestScene,
  generateForestClearing,
  shuffleForestDetails,
} from './forest-generate';
import { validateForest } from './forest-validation';

function generated(settings: ForestSettings): ForestClearing {
  const result = generateForestClearing(settings);
  if (!result.ok) throw new Error(`${settings.seed}: ${result.error}`);
  return result.map;
}

describe('abandoned camp scenes', () => {
  test('adding and removing a scene preserves layout, surface and revision', () => {
    const original = generated({
      seed: 'mosslit-sanctum',
      density: 'Balanced',
      character: 'Verdant',
    });
    const snapshot = structuredClone(original);
    expect(
      generated({
        seed: 'mosslit-sanctum',
        density: 'Balanced',
        character: 'Verdant',
        scene: 'None',
      }),
    ).toEqual(original);
    const camp = changeForestScene(original, 'Abandoned camp');
    expect(camp).not.toBe(original);
    expect(camp.decoration.scene).toBe('Abandoned camp');
    expect(camp.layout).toBe(original.layout);
    expect(camp.surfaceSeed).toBe(original.surfaceSeed);
    expect(camp.decoration.revision).toBe(original.decoration.revision);
    expect(changeForestScene(camp, 'None')).toEqual(original);
    expect(original).toEqual(snapshot);
    expect(changeForestScene(original, 'Abandoned camp')).toEqual(camp);
    const shuffled = shuffleForestDetails(camp);
    expect(shuffled.decoration.revision).toBe(1);
    expect(shuffled.decoration.scene).toBe('Abandoned camp');
    expect(shuffled.layout).toBe(original.layout);
    expect(shuffled.decoration.props).not.toEqual(camp.decoration.props);
    const changed = changeForestAppearance(shuffled, {
      scene: 'Abandoned camp',
      character: 'Fey',
      density: 'Sparse',
    });
    expect(changed.decoration).toMatchObject({
      scene: 'Abandoned camp',
      character: 'Fey',
      density: 'Sparse',
      revision: 1,
    });
    expect(changed.layout).toBe(original.layout);
  });

  test('camp settings generate deterministically across characters, densities and seeds', () => {
    for (const character of ALL_FOREST_CHARACTERS)
      for (const density of ALL_DENSITIES) {
        for (let seed = 0; seed < 8; seed++) {
          const settings: ForestSettings = {
            seed: `camp-${seed}`,
            character,
            density,
            scene: 'Abandoned camp',
          };
          const map = generated(settings);
          expect(generated(settings)).toEqual(map);
          const shuffled = shuffleForestDetails(map);
          expect(shuffled.decoration.revision).toBe(1);
          for (const current of [map, shuffled]) {
            expect(validateForest(current)).toBeUndefined();
            expect(current.decoration.scene).toBe('Abandoned camp');
            const camp = current.decoration.props.filter((p) => CAMP_PROP_KINDS.includes(p.kind));
            expect(camp.map((p) => p.kind).sort()).toEqual([
              'bedroll',
              'bedroll',
              'fire_ring',
              'supply_bundle',
              'tent',
              'tent',
            ]);
            const blocked = new Set(
              current.decoration.props.filter((p) => p.blocking).map((p) => indexOf(p.x, p.y)),
            );
            expect(blocked.size).toBeLessThanOrEqual(
              Math.floor(current.layout.tiles.filter(Boolean).length * DENSITY_BUDGETS[density]),
            );
            for (const prop of camp) {
              const tile = indexOf(prop.x, prop.y);
              expect(current.layout.tiles[tile]).toBe(true);
              expect(current.layout.route).not.toContain(tile);
              expect(
                current.decoration.props.filter((p) => p.x === prop.x && p.y === prop.y),
              ).toHaveLength(1);
            }
            // Independent flood fill checks all free floor, rather than endpoint reachability alone.
            const reached = new Set<number>();
            const queue = [indexOf(current.layout.pathStart.x, current.layout.pathStart.y)];
            for (let i = 0; i < queue.length; i++) {
              const tile = queue[i];
              if (
                tile === undefined ||
                reached.has(tile) ||
                blocked.has(tile) ||
                !current.layout.tiles[tile]
              )
                continue;
              reached.add(tile);
              const x = tile % WIDTH,
                y = Math.floor(tile / WIDTH);
              for (const [dx, dy] of [
                [-1, 0],
                [1, 0],
                [0, -1],
                [0, 1],
              ] as const) {
                if (x + dx >= 0 && x + dx < WIDTH && y + dy >= 0 && y + dy < 30)
                  queue.push(indexOf(x + dx, y + dy));
              }
            }
            expect(reached.size).toBe(current.layout.tiles.filter(Boolean).length - blocked.size);
          }
        }
      }
  });

  test('a layout without a camp-sized space rejects the scene without changing the map', () => {
    const base = generated({ seed: 'mosslit-sanctum', character: 'Verdant', density: 'Balanced' });
    const cramped = {
      ...base,
      decoration: { ...base.decoration, props: [] },
      layout: {
        ...base.layout,
        route: base.layout.tiles.flatMap((floor, tile) => (floor ? [tile] : [])),
      },
    };
    expect(validateForest(cramped)).toBeUndefined();
    const snapshot = structuredClone(cramped);
    expect(changeForestScene(cramped, 'Abandoned camp')).toBe(cramped);
    expect(cramped).toEqual(snapshot);
  });
});
