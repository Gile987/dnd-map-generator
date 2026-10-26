import { createHash } from 'node:crypto';
import baseline from './fixtures/forest-landmark-baseline.json';
import { expect, test } from 'vitest';
import { ALL_DENSITIES, ALL_FOREST_CHARACTERS, indexOf } from './model';
import type { ForestSettings } from './model';
import {
  changeForestAppearance,
  generateForestClearing,
  shuffleForestDetails,
} from './forest-generate';
import { validateForest, validateForestSettings } from './forest-validation';
import { circleReserve } from './forest-landmark';
import { forestDistances } from './forest-layout';

function generated(settings: ForestSettings) {
  const result = generateForestClearing(settings);
  if (!result.ok) throw new Error(`${settings.seed}: ${result.error}`);
  return result.map;
}

test('adding and removing a landmark preserves the clearing and historical output', () => {
  const settings: ForestSettings = {
    seed: 'mosslit-sanctum',
    density: 'Balanced',
    character: 'Verdant',
  };
  const base = generated(settings);
  const snapshot = structuredClone(base);
  expect(generated({ ...settings, landmark: 'None' })).toEqual(base);
  const marked = changeForestAppearance(base, { ...settings, landmark: 'standing-stone-circle' });
  expect(marked.decoration.landmark).toBe('standing-stone-circle');
  expect(marked.layout).toBe(base.layout);
  expect(marked.surfaceSeed).toBe(base.surfaceSeed);
  expect(marked.decoration.revision).toBe(0);
  expect(changeForestAppearance(marked, { ...settings, landmark: 'None' })).toEqual(base);
  expect(base).toEqual(snapshot);
});

test.each(ALL_FOREST_CHARACTERS)(
  '%s landmarks compose with camps at every density',
  (character) => {
    for (const density of ALL_DENSITIES)
      for (const scene of ['None', 'Abandoned camp'] as const)
        for (let seed = 0; seed < 4; seed++) {
          const settings: ForestSettings = {
            seed: `landmark-${seed}`,
            density,
            character,
            scene,
            landmark: 'standing-stone-circle',
          };
          const map = generated(settings);
          expect(generated(settings)).toEqual(map);
          const shuffled = shuffleForestDetails(map);
          expect(shuffled.decoration.revision).toBe(1);
          for (const current of [map, shuffled]) {
            expect(validateForest(current)).toBeUndefined();
            const stones = current.decoration.props.filter((p) => p.kind === 'standing_stone');
            expect(stones).toHaveLength(6);
            const center = {
              x: stones.reduce((n, p) => n + p.x, 0) / 6,
              y: stones.reduce((n, p) => n + p.y, 0) / 6,
            };
            for (const stone of stones) {
              expect(stone.blocking).toBe(true);
              expect(current.layout.route).not.toContain(indexOf(stone.x, stone.y));
            }
            expect(current.decoration.props.filter((p) => circleReserve(center, p))).toEqual(
              stones,
            );
            const blocked = new Set(
              current.decoration.props.filter((p) => p.blocking).map((p) => indexOf(p.x, p.y)),
            );
            expect(
              forestDistances(current.layout.tiles, current.layout.pathStart, blocked).size,
            ).toBe(current.layout.tiles.filter(Boolean).length - blocked.size);
            if (scene === 'Abandoned camp')
              expect(current.decoration.props.filter((p) => p.kind === 'tent')).toHaveLength(2);
          }
        }
  },
);

test('no-fit changes reject immutably; invalid or incomplete landmarks are rejected', () => {
  const base = generated({ seed: 'landmark-reject', character: 'Verdant', density: 'Sparse' });
  const cramped = {
    ...base,
    layout: {
      ...base.layout,
      route: base.layout.tiles.flatMap((floor, tile) => (floor ? [tile] : [])),
    },
    decoration: { ...base.decoration, props: [] },
  };
  expect(validateForest(cramped)).toBeUndefined();
  expect(
    changeForestAppearance(cramped, { ...cramped.decoration, landmark: 'standing-stone-circle' }),
  ).toBe(cramped);
  expect(
    validateForestSettings({
      seed: 'x',
      density: 'Balanced',
      character: 'Verdant',
      landmark: 'Unknown' as never,
    }),
  ).toContain('landmark');
  const map = generated({
    seed: 'landmark-reject',
    character: 'Verdant',
    density: 'Sparse',
    landmark: 'standing-stone-circle',
  });
  expect(
    validateForest({
      ...map,
      decoration: { ...map.decoration, props: map.decoration.props.slice(0, -1) },
    }),
  ).toContain('complete');
  expect(validateForest({ ...map, decoration: { ...map.decoration, landmark: 'None' } })).toContain(
    'require',
  );
});

test('catalog and reservation changes preserve existing placements and RNG consumption', () => {
  for (const character of ALL_FOREST_CHARACTERS)
    for (const density of ALL_DENSITIES)
      for (const scene of ['None', 'Abandoned camp'] as const) {
        const map = generated({
          seed: 'mosslit-sanctum',
          character,
          density,
          scene,
          landmark: 'standing-stone-circle',
        });
        const maps = [map, shuffleForestDetails(map)].map((current) => {
          const { landmark, ...decoration } = current.decoration;
          return { ...current, decoration };
        });
        expect(createHash('sha256').update(JSON.stringify(maps)).digest('hex')).toBe(
          baseline[`${character}/${density}/${scene}`],
        );
      }
});
