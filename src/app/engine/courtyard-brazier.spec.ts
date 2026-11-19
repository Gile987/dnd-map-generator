import { expect, test } from 'vitest';
import {
  generateCourtyard,
  changeCourtyardAppearance,
  shuffleCourtyardDetails,
} from './courtyard-generate';
import { validateCourtyard, courtyardProtectedCells } from './courtyard-validation';
import { ALL_COURTYARD_CHARACTERS, ALL_DENSITIES, WIDTH, indexOf } from './model';
import type { CourtyardSettings, Prop, RuinedCourtyard } from './model';

function courtyard(settings: Partial<CourtyardSettings> = {}): RuinedCourtyard {
  const result = generateCourtyard({
    seed: 'ivy-court',
    density: 'Balanced',
    character: 'Overgrown',
    fountain: false,
    ...settings,
  });
  if (!result.ok) throw new Error(result.error);
  return result.map;
}

function braziers(map: RuinedCourtyard): Prop[] {
  return map.decoration.props.filter((item) => item.kind === 'abandoned_brazier');
}

const EXPECTED = { Sparse: 1, Balanced: 2, Cluttered: 3 } as const;

test('braziers spawn beside ruined masonry like ordinary objects and keep every tile reachable', () => {
  for (const character of ALL_COURTYARD_CHARACTERS)
    for (const density of ALL_DENSITIES)
      for (const seed of ['ivy-court', 'fallen-crown', 'sunny-court'])
        for (const additions of [
          { fountain: false, wagon: false, well: false },
          { fountain: true, wagon: true, well: true },
        ]) {
          const settings = { seed, character, density, ...additions };
          const map = courtyard(settings);
          const spawned = braziers(map);
          if (additions.wagon || additions.well) {
            // Addition reserves may legitimately claim tiles a brazier would
            // have taken, so only the range is guaranteed there.
            expect(spawned.length, `${seed} ${character} ${density}`).toBeLessThanOrEqual(
              EXPECTED[density],
            );
            expect(spawned.length, `${seed} ${character} ${density}`).toBeGreaterThanOrEqual(
              EXPECTED[density] - 1,
            );
          } else {
            expect(spawned.length, `${seed} ${character} ${density}`).toBe(EXPECTED[density]);
          }
          for (const prop of spawned) {
            expect(prop.blocking).toBe(true);
            expect(map.layout.tiles[indexOf(prop.x, prop.y)]).toBe(true);
            expect(courtyardProtectedCells(map.layout).has(indexOf(prop.x, prop.y))).toBe(false);
            expect(
              [
                indexOf(prop.x - 1, prop.y),
                indexOf(prop.x + 1, prop.y),
                indexOf(prop.x, prop.y - 1),
                indexOf(prop.x, prop.y + 1),
              ].some((tile) => map.layout.tiles[tile] === false),
            ).toBe(true);
          }
          expect(validateCourtyard(map)).toBeUndefined();
          expect(courtyard(settings)).toEqual(map);
          const blocked = new Set(
            map.decoration.props
              .filter((item) => item.blocking)
              .flatMap((item) =>
                Array.from({ length: item.footprint?.height ?? 1 }, (_, dy) =>
                  Array.from({ length: item.footprint?.width ?? 1 }, (_, dx) =>
                    indexOf(item.x + dx, item.y + dy),
                  ),
                ).flat(),
              ),
          );
          const free = map.layout.tiles.findIndex((tile, index) => tile && !blocked.has(index));
          const seen = new Set([free]);
          const queue = [free];
          for (let cursor = 0; cursor < queue.length; cursor++) {
            const tile = queue[cursor];
            if (tile === undefined) continue;
            for (const next of [tile - 1, tile + 1, tile - WIDTH, tile + WIDTH]) {
              if (
                next < 0 ||
                next >= map.layout.tiles.length ||
                (Math.abs(next - tile) === 1 &&
                  Math.floor(next / WIDTH) !== Math.floor(tile / WIDTH)) ||
                seen.has(next) ||
                blocked.has(next) ||
                !map.layout.tiles[next]
              )
                continue;
              seen.add(next);
              queue.push(next);
            }
          }
          expect(seen.size).toBe(map.layout.tiles.filter(Boolean).length - blocked.size);
        }
});

test('braziers are ordinary objects: they shuffle with details and survive appearance changes', () => {
  const original = courtyard({ fountain: true, wagon: true, well: true });
  const spawned = braziers(original);
  expect(spawned.length).toBe(EXPECTED[original.decoration.density]);
  expect(original.decoration).not.toHaveProperty('brazier');
  const shuffled = shuffleCourtyardDetails(original);
  expect(shuffled.decoration.revision).not.toBe(original.decoration.revision);
  // Braziers re-decorate like every ordinary kind; count and placement may
  // change with the revision while validation still holds.
  expect(braziers(shuffled).length).toBe(EXPECTED[shuffled.decoration.density]);
  expect(validateCourtyard(shuffled)).toBeUndefined();
  const recolored = changeCourtyardAppearance(original, {
    density: original.decoration.density,
    character: 'Frostbound',
    fountain: original.decoration.fountain,
  });
  expect(validateCourtyard(recolored)).toBeUndefined();
  expect(braziers(recolored).length).toBe(EXPECTED[recolored.decoration.density]);
  for (const prop of braziers(recolored)) expect(prop.blocking).toBe(true);
});

test('braziers validate as ordinary blocking props with no canonical pinning', () => {
  const map = courtyard();
  const prop = braziers(map)[0];
  if (!prop) throw new Error('Missing spawned brazier');
  // An edited brazier position stays a valid ordinary object.
  const moved = {
    ...map,
    decoration: {
      ...map.decoration,
      props: map.decoration.props.map((item) => (item === prop ? { ...item, x: 1, y: 1 } : item)),
    },
  };
  expect(validateCourtyard(moved)).toBeUndefined();
  // A historical format-31 marker stays valid but changes nothing.
  expect(
    validateCourtyard({
      ...map,
      decoration: { ...map.decoration, brazier: true },
    }),
  ).toBeUndefined();
  expect(
    validateCourtyard({
      ...map,
      decoration: { ...map.decoration, brazier: false as unknown as true },
    }),
  ).toBe('Invalid abandoned brazier selection.');
});
