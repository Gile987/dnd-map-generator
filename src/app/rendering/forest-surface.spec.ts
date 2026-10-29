import { createHash } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from 'vitest';
import fixture from '../save/fixtures/forest-v4-surfaces.json';
import { parseBundle } from '../save/save-format';
import { ALL_DENSITIES, ALL_FOREST_CHARACTERS, indexOf, isWalkable } from '../engine/model';
import type { ForestCharacter, ForestClearing } from '../engine/model';
import {
  generateForestClearing,
  shuffleForestDetails,
  changeForestCharacter,
  changeForestDensity,
} from '../engine/forest-generate';
import { campReservations } from '../engine/forest-camp';
import { areaContains } from '../engine/feature-reservation';
import { circleReserve } from '../engine/forest-landmark';
import { forestSurfacePatches } from './forest-surface';
import { renderForest } from './forest-renderer';

function legacy(character: ForestCharacter): ForestClearing {
  const parsed = parseBundle(JSON.stringify(fixture));
  if (!parsed.ok) throw new Error(parsed.error);
  const map = parsed.maps.find(
    (record) => record.map.type === 'forest' && record.map.decoration.character === character,
  )?.map;
  if (!map || map.type !== 'forest') throw new Error('Missing captured forest');
  return map;
}

function pixels(map: ForestClearing, grid: boolean, scale = 64) {
  const canvas = createCanvas(40 * scale, 30 * scale),
    ctx = canvas.getContext('2d');
  renderForest(ctx, map, { grid, pixelsPerTile: scale });
  return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
}

test.each([
  ['Verdant', false, '5a231812535f19a5718a05b615b61a789983c7f820043d7a5f5e21510203c317'],
  ['Verdant', true, 'f54593e543ea9d7351e9236f239ab39638edd4a82e462392dfd813fa7afb18ce'],
  ['Autumn', false, '5f6878ddd89ef3006566c6be29763ead22e181e07eebf652d23e70e85ed8dd8e'],
  ['Autumn', true, 'a86229c40629f1dc13aa42a30cbaca3025749ab4ffc7ed4f047d00c1e17a98b4'],
  ['Pines', false, 'daace7d0c6dc9cddd95f3fda451063d0a2d9b30df82b5a3cde77d74b3c5d85d0'],
  ['Pines', true, '94677507d53825edb5920eb8de111a59375f3f933db12f31bb0d71bb59ded095'],
  ['Fey', false, 'f8ea803201661124a43a1310acc2bf543e2a6c21a05c553266a90012357de96b'],
  ['Fey', true, '6fbb86b0e66fb42846c7b3dd1b83d70a9fefa0b006b3ed7801bcc3c0f7d29141'],
] as const)('preserves captured %s camp/circle artwork, grid=%s', (character, grid, hash) => {
  const map = legacy(character);
  expect(map.decoration).not.toHaveProperty('forestSurface');
  expect(forestSurfacePatches(map)).toEqual([]);
  expect(createHash('sha256').update(pixels(map, grid)).digest('hex')).toBe(hash);
});

test.each(ALL_FOREST_CHARACTERS)(
  '%s new forests retain captured placement and consume no extra engine randomness',
  (character) => {
    const old = legacy(character);
    const result = generateForestClearing({
      seed: old.seed,
      character,
      density: 'Balanced',
      scene: 'Abandoned camp',
      landmark: 'standing-stone-circle',
    });
    if (!result.ok) throw new Error(result.error);
    const { forestSurface, ...decoration } = result.map.decoration;
    expect(forestSurface).toBe(1);
    expect({ ...result.map, decoration }).toEqual(old);
    const before = structuredClone(old);
    const shuffled = shuffleForestDetails(old);
    expect(shuffled.decoration.forestSurface).toBe(1);
    expect(shuffled.layout).toBe(old.layout);
    expect(shuffled.surfaceSeed).toBe(old.surfaceSeed);
    expect(
      changeForestCharacter(old, character === 'Fey' ? 'Autumn' : 'Fey').decoration.forestSurface,
    ).toBe(1);
    expect(changeForestDensity(old, 'Sparse').decoration.forestSurface).toBe(1);
    expect(old).toEqual(before);
  },
);

test.each(ALL_FOREST_CHARACTERS)(
  '%s drifts are deterministic and keep paths, props, camp objects and encounter areas clear',
  (character) => {
    for (const density of ALL_DENSITIES)
      for (const scene of ['None', 'Abandoned camp'] as const)
        for (const landmark of ['None', 'standing-stone-circle'] as const) {
          const result = generateForestClearing({
            seed: 'mosslit-sanctum',
            character,
            density,
            scene,
            landmark,
          });
          if (!result.ok) throw new Error(result.error);
          for (const map of [result.map, shuffleForestDetails(result.map)]) {
            const before = structuredClone(map),
              patches = forestSurfacePatches(map);
            expect(patches).toEqual(forestSurfacePatches(map));
            const natural = patches.filter((p) => p.kind !== 'ash');
            expect(natural.length).toBeGreaterThan(5);
            expect(new Set(natural.map((p) => p.kind))).toEqual(
              new Set([
                character === 'Pines' ? 'needles' : character === 'Fey' ? 'petals' : 'leaves',
              ]),
            );
            expect(patches.some((p) => p.kind === 'ash')).toBe(scene === 'Abandoned camp');
            const route = new Set(map.layout.route),
              camp = campReservations(map.decoration.props);
            const stones = map.decoration.props.filter((p) => p.kind === 'standing_stone');
            const center = {
              x: stones.reduce((sum, p) => sum + p.x, 0) / 6,
              y: stones.reduce((sum, p) => sum + p.y, 0) / 6,
            };
            const hearth = map.decoration.props.find((p) => p.kind === 'fire_ring');
            for (const patch of patches) {
              const point = { x: Math.floor(patch.x), y: Math.floor(patch.y) };
              expect(isWalkable(map.layout, point.x, point.y)).toBe(true);
              expect(route.has(indexOf(point.x, point.y))).toBe(false);
              if (stones.length) expect(circleReserve(center, point)).toBe(false);
              if (patch.kind === 'ash') {
                if (!hearth) throw new Error('Ash without hearth');
                expect(Math.hypot(point.x - hearth.x, point.y - hearth.y)).toBeLessThanOrEqual(1);
                expect(
                  map.decoration.props.some(
                    (p) => p.kind !== 'fire_ring' && p.x === point.x && p.y === point.y,
                  ),
                ).toBe(false);
              } else {
                expect(map.decoration.props.some((p) => p.x === point.x && p.y === point.y)).toBe(
                  false,
                );
                expect(camp.some((reserve) => areaContains(reserve.area, point))).toBe(false);
              }
            }
            expect(map).toEqual(before);
          }
        }
  },
);

test.each([64, 70, 100])(
  'surface pixels stay inside marked ground tiles and leave paths untouched at %s px/tile',
  (scale) => {
    const old = legacy('Autumn');
    const map: ForestClearing = { ...old, decoration: { ...old.decoration, forestSurface: 1 } };
    const patches = forestSurfacePatches(map);
    const allowed = new Set(patches.map((p) => indexOf(Math.floor(p.x), Math.floor(p.y))));
    const before = pixels(old, true, scale),
      after = pixels(map, true, scale);
    let changed = 0,
      outside = 0;
    for (let i = 0; i < before.length; i += 4) {
      if (
        before[i] === after[i] &&
        before[i + 1] === after[i + 1] &&
        before[i + 2] === after[i + 2]
      )
        continue;
      changed++;
      const p = i / 4,
        x = Math.floor((p % (40 * scale)) / scale),
        y = Math.floor(p / (40 * scale * scale));
      if (!allowed.has(indexOf(x, y))) outside++;
    }
    expect(changed).toBeGreaterThan(1000);
    expect(outside).toBe(0);
    expect(
      createHash('sha256')
        .update(pixels(map, true, scale))
        .digest('hex'),
    ).toBe(createHash('sha256').update(after).digest('hex'));
  },
);
