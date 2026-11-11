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

function brazier(map: RuinedCourtyard) {
  const prop = map.decoration.props.find((item) => item.kind === 'abandoned_brazier');
  if (!prop) throw new Error('Missing abandoned brazier');
  return prop;
}

test('one seeded brazier stays near masonry and leaves every free courtyard tile reachable', () => {
  for (const character of ALL_COURTYARD_CHARACTERS)
    for (const density of ALL_DENSITIES)
      for (const seed of ['ivy-court', 'fallen-crown', 'sunny-court'])
        for (const additions of [
          { fountain: false, wagon: false, well: false },
          { fountain: true, wagon: true, well: true },
        ]) {
          const settings = { seed, character, density, brazier: true, ...additions };
          const map = courtyard(settings);
          const prop = brazier(map);
          expect(map.decoration.props.filter((item) => item.kind === prop.kind)).toHaveLength(1);
          expect(map.decoration.brazier).toBe(true);
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

test('brazier selection changes appearance only, survives shuffle, and removes exactly', () => {
  const original = courtyard({ fountain: true, wagon: true, well: true });
  const before = structuredClone(original);
  const settings = {
    density: original.decoration.density,
    character: original.decoration.character,
    fountain: original.decoration.fountain,
    wagon: original.decoration.wagon,
    well: original.decoration.well,
    brazier: true,
  };
  const added = changeCourtyardAppearance(original, settings);
  expect(added).not.toBe(original);
  expect(added.layout).toBe(original.layout);
  expect(added.surfaceSeed).toBe(original.surfaceSeed);
  expect(added.decoration.revision).toBe(original.decoration.revision);
  const shuffled = shuffleCourtyardDetails(added);
  expect(brazier(shuffled)).toEqual(brazier(added));
  expect(validateCourtyard(shuffled)).toBeUndefined();
  const recolored = changeCourtyardAppearance(shuffled, { ...settings, character: 'Frostbound' });
  expect(brazier(recolored)).toEqual(brazier(shuffled));
  const removed = changeCourtyardAppearance(added, { ...settings, brazier: false });
  expect(removed).toEqual(original);
  expect(original).toEqual(before);
});

test('canonical brazier metadata and placement cannot be forged', () => {
  const map = courtyard({ brazier: true });
  const prop = brazier(map);
  const changes: Partial<Prop>[] = [
    { x: prop.x + 1 },
    { variation: 0.5 },
    { blocking: false },
    { rotation: 1 },
  ];
  for (const change of changes) {
    const changed = {
      ...map,
      decoration: {
        ...map.decoration,
        props: map.decoration.props.map((item) => (item === prop ? { ...item, ...change } : item)),
      },
    };
    expect(validateCourtyard(changed)).toBeDefined();
  }
  const { brazier: _selection, ...withoutSelection } = map.decoration;
  expect(validateCourtyard({ ...map, decoration: withoutSelection })).toBeDefined();
  expect(
    validateCourtyard({
      ...map,
      decoration: {
        ...map.decoration,
        props: map.decoration.props.filter((item) => item !== prop),
      },
    }),
  ).toBeDefined();
  expect(
    validateCourtyard({
      ...map,
      decoration: { ...map.decoration, props: [...map.decoration.props, prop] },
    }),
  ).toBeDefined();
});
