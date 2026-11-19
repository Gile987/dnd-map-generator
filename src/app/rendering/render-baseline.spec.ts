import { createHash } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, test } from 'vitest';
import { generateCourtyard } from '../engine/courtyard-generate';
import { generateForestClearing } from '../engine/forest-generate';
import { GENERATOR_VERSION, WIDTH } from '../engine/model';
import type {
  DecorationPreset,
  Dungeon,
  ForestCharacter,
  ForestClearing,
  Prop,
  PropKind,
  RuinedCourtyard,
} from '../engine/model';
import { ALL_COURTYARD_CHARACTERS } from '../engine/model';
import { hashSeed } from '../engine/random';
import { createLayout } from '../engine/topology';
import { showcaseDungeon } from '../engine/showcase';
import { renderCourtyard } from './courtyard-renderer';
import { renderDungeon } from './dungeon-renderer';
import { renderForest } from './forest-renderer';
import type { DrawingContext } from './drawing-context';
import { EXPORT_HEIGHT, EXPORT_WIDTH, PIXELS_PER_TILE } from './resolution';

function pixelHash(render: (ctx: DrawingContext) => void): string {
  const canvas = createCanvas(EXPORT_WIDTH, EXPORT_HEIGHT);
  const ctx = canvas.getContext('2d');
  render(ctx);
  const pixels = ctx.getImageData(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT).data;
  return createHash('sha256').update(pixels).digest('hex');
}

function dungeonHash(map: Dungeon, grid: boolean): string {
  return pixelHash((ctx) => renderDungeon(ctx, map, { grid, pixelsPerTile: PIXELS_PER_TILE }));
}

function forestHash(map: ForestClearing, grid: boolean): string {
  return pixelHash((ctx) => renderForest(ctx, map, { grid, pixelsPerTile: PIXELS_PER_TILE }));
}

function courtyardHash(map: RuinedCourtyard, grid: boolean): string {
  return pixelHash((ctx) => renderCourtyard(ctx, map, { grid, pixelsPerTile: PIXELS_PER_TILE }));
}

function generatedCourtyard(
  character: RuinedCourtyard['decoration']['character'],
  well = false,
): RuinedCourtyard {
  const result = generateCourtyard({
    seed: 'character-showcase',
    density: 'Balanced',
    fountain: true,
    character,
    well,
  });
  if (!result.ok) throw new Error(result.error);
  return result.map;
}

function completeDungeon(preset: DecorationPreset): Dungeon {
  const layout = createLayout(
    [
      { id: 0, x: 4, y: 4, width: 9, height: 7 },
      { id: 1, x: 24, y: 5, width: 8, height: 6 },
      { id: 2, x: 17, y: 20, width: 9, height: 6 },
    ],
    [
      { from: 0, to: 1, bend: 'vertical' },
      { from: 1, to: 2, bend: 'horizontal' },
    ],
  );
  const props: Prop[] = [
    { x: 18, y: 21, kind: 'crate', blocking: true, variation: 0.2 },
    { x: 19, y: 21, kind: 'barrel', blocking: true, variation: 0.6 },
    { x: 20, y: 21, kind: 'rubble', blocking: true, variation: 0.4 },
    { x: 21, y: 21, kind: 'rug', blocking: false, variation: 0.2 },
    { x: 23, y: 21, kind: 'sconce', blocking: false, variation: 0.1 },
    { x: 18, y: 22, kind: 'moss', blocking: false, variation: 0.4 },
    { x: 19, y: 22, kind: 'sarcophagus', blocking: true, variation: 0.5 },
    { x: 23, y: 22, kind: 'vine', blocking: false, variation: 0.3 },
    { x: 24, y: 22, kind: 'broken_column', blocking: true, variation: 0.7 },
  ];
  return {
    type: 'dungeon',
    version: GENERATOR_VERSION,
    seed: 'render-baseline',
    surfaceSeed: hashSeed('render-baseline:surface'),
    layout,
    decoration: { density: 'Balanced', preset, revision: 0, props },
  };
}

function generatedForest(character: ForestCharacter): ForestClearing {
  const result = generateForestClearing({
    seed: 'character-showcase',
    density: 'Balanced',
    character,
  });
  if (!result.ok) throw new Error(result.error);
  // These literal pixel baselines protect the original, unmarked forest artwork.
  const { forestSurface, ...decoration } = result.map.decoration;
  expect(forestSurface).toBe(1);
  return { ...result.map, decoration };
}

function completeForest(character: ForestCharacter): ForestClearing {
  const map = generatedForest(character);
  const route = map.layout.route;
  const step = Math.max(1, Math.floor(route.length / 8));
  const kinds: PropKind[] = [
    'tree',
    'boulder',
    'fern',
    'mushroom',
    'bush',
    'log',
    'stump',
    'flower',
  ];
  const variations = [0.1, 0.3, 0.5, 0.7, 0.9, 0.25, 0.45, 0.65];
  const props = kinds.map((kind, i) => {
    const tile = route[i * step] ?? 0;
    return {
      x: tile % WIDTH,
      y: Math.floor(tile / WIDTH),
      kind,
      blocking: false,
      variation: variations[i] ?? 0.5,
    };
  });
  return { ...map, decoration: { ...map.decoration, props } };
}

describe('current artwork baselines', () => {
  test.each([
    {
      name: 'showcase',
      preset: null,
      grid: true,
      expected: '508ca0351d9a778fd52cfab83d52c5765bcb11399a3fd85c74f9c72a37b8ae82',
    },
    {
      name: 'showcase',
      preset: null,
      grid: false,
      expected: '4d848870042a692d58a5581ab20123511ccdf816d3f5d5e4e69ff4ac3ac8510d',
    },
    {
      name: 'complete dungeon',
      preset: 'Mosslit',
      grid: true,
      expected: '473b33daca207df50cecc169586dc75dc6d1cf38f1e49ddeac58babb310de488',
    },
    {
      name: 'complete dungeon',
      preset: 'Crypt',
      grid: true,
      expected: 'd2e3aa255d65e1b720e8c5cb458c0c2f4e35922b853ce83133d9f66b2b7160b8',
    },
    {
      name: 'complete dungeon',
      preset: 'Storehouse',
      grid: true,
      expected: '063954b42414d628fad4aba49ed54586e2ef5c4b6a22b1bb8aa8e5a9bf9ce867',
    },
    {
      name: 'complete dungeon',
      preset: 'Sanctuary',
      grid: true,
      expected: '2b52dc9b2d2d29a4030e4b453f58f27bbb690a9c4549dd4c168f339d0127b5ad',
    },
  ] as const)('dungeon pixels are unchanged: $name, grid=$grid', ({ preset, grid, expected }) => {
    const map = preset ? completeDungeon(preset) : showcaseDungeon();
    expect(dungeonHash(map, grid)).toBe(expected);
  });

  test.each([
    [
      'complete-forest',
      'Verdant',
      true,
      '7135e26803091661f7bc9487ea220925b1e71050686e679a92eeee1e4e939dda',
    ],
    [
      'complete-forest',
      'Autumn',
      true,
      '497e865bf40a636e9a183baed15f54548aa74da392d058ccd3448d718e20210a',
    ],
    [
      'complete-forest',
      'Pines',
      true,
      '59df0efa4b5d3f354dab94fc970b817706f1b50eba287a636d6d96665022be6a',
    ],
    [
      'complete-forest',
      'Fey',
      true,
      'ca8c6e6887c81702f6189e04d54c401d16414a8ebf3fe0ef41b8df217b35d3dd',
    ],
    [
      'generated-forest',
      'Verdant',
      true,
      '043450949de4fc29c7ec43a669d542810f1eca0b136fca12d4865ca4d64a0a8f',
    ],
    [
      'generated-forest',
      'Autumn',
      true,
      '4b71dedc40a360036da7a7deee2bbf7ad43d41c7ae67ebfebaa793e46ed5d795',
    ],
    [
      'generated-forest',
      'Pines',
      true,
      '1ceb17dc3debdc9e2632ba2659897eb2c2f8839dad870898cd1f61285625e14e',
    ],
    [
      'generated-forest',
      'Fey',
      true,
      '111a3dc9872f9214870e3fc3bb4a9c2a0023fabe5d3c9c6d89ec3f8ccbdb4932',
    ],
    [
      'complete-forest',
      'Verdant',
      false,
      'e41217581f5c108796a7e7d95e0aa0f5d13289baf1772e7a80adc5ab1cb12a96',
    ],
  ] as const)(
    'forest pixels are unchanged for %s (%s) with grid=%s',
    (kind, character, grid, expected) => {
      const map =
        kind === 'complete-forest' ? completeForest(character) : generatedForest(character);
      expect(forestHash(map, grid)).toBe(expected);
    },
  );

  // Committed with the courtyard character release; regenerated for courtyard
  // generator 5.0.0, whose decoration spawns ordinary braziers beside masonry.
  test.each([
    [
      'generated-courtyard',
      'Overgrown',
      true,
      '411364a9a77ebe2f3c4df7efb8c0171f20a099614df7786035362cfb0e4c6f82',
    ],
    [
      'generated-courtyard',
      'Overgrown',
      false,
      '24c5b0bbb55e0e0d38fa6b50d9cc910e0e9ccac5329e6f02678ce5c2139d0360',
    ],
    [
      'generated-courtyard',
      'Sunbleached',
      true,
      '1069f875e2532db55c7322589925276c0dfa27e4a93e22f4e216e9a6b59462ae',
    ],
    [
      'generated-courtyard',
      'Sunbleached',
      false,
      '2377dd7b90d903ebadf0b935777eaa59964a63b20fe535450fcd8c922b7adfda',
    ],
    [
      'generated-courtyard',
      'Frostbound',
      true,
      '1f51d8767e60bb8035abe3e9f948d310eb93629fd086f4d56c5ac970fecbf1f1',
    ],
    [
      'generated-courtyard',
      'Frostbound',
      false,
      '671dd5abdc9219e953c3f950847fff9a63108f28cca7108b5f290f7e94c31a6a',
    ],
    [
      'generated-courtyard',
      'Desecrated',
      true,
      'bdfbd10cb20d961c3e9f468bce17a96609d8997063169cbf20fb6abfe35836a5',
    ],
    [
      'generated-courtyard',
      'Desecrated',
      false,
      'a6f076854cc3806dabb9a5577a3adc2ec66dff25b34e9c35550e1e1a63aa6626',
    ],
  ] as const)(
    'courtyard pixels are unchanged for %s (%s) with grid=%s',
    (_kind, character, grid, expected) => {
      expect(courtyardHash(generatedCourtyard(character), grid)).toBe(expected);
    },
  );

  // Committed with the stone-well release; regenerated for courtyard
  // generator 5.0.0 alongside the plain rows.
  test.each([
    [
      'courtyard-well',
      'Overgrown',
      true,
      '2e594f037b29d4897b98cfa56ce2da69803eec579cf68d57f02d631bc0288960',
    ],
    [
      'courtyard-well',
      'Overgrown',
      false,
      'a8689fa8b06c90b5faea6d007e2cf54d696343d9f4598124b1ab7c45706d6276',
    ],
    [
      'courtyard-well',
      'Sunbleached',
      true,
      'ed51835fcfdfd5ef6a39259a6fbae988d0684c1be7cd9d8782d4d66eb3495250',
    ],
    [
      'courtyard-well',
      'Sunbleached',
      false,
      '6a1fe4db1ae7d16bd6a1dc5d36599da19b98dde981675603323063180cca36a5',
    ],
    [
      'courtyard-well',
      'Frostbound',
      true,
      '9df2835a07929bece7126544affd78f737b538b605d5bf0083db729cf1c26527',
    ],
    [
      'courtyard-well',
      'Frostbound',
      false,
      'b5585b7777d2d341ac8fcd8133b483a65522dd8cf9a697c640660f9d2367762f',
    ],
    [
      'courtyard-well',
      'Desecrated',
      true,
      'becf145eb1f6f3f157bb5bb67a6c7fc75673ccf02008a7b62082e5173ba70e2e',
    ],
    [
      'courtyard-well',
      'Desecrated',
      false,
      '557165c1862363b6ae326863a84ff5f84bd78ad04bcbf7fdedcad2dd8fb55aa0',
    ],
  ] as const)(
    'courtyard well pixels are unchanged for %s (%s) with grid=%s',
    (_kind, character, grid, expected) => {
      expect(courtyardHash(generatedCourtyard(character, true), grid)).toBe(expected);
    },
  );

  test.each(ALL_COURTYARD_CHARACTERS)(
    'renders the same %s courtyard twice to identical PNG bytes',
    (character) => {
      const canvas = createCanvas(EXPORT_WIDTH, EXPORT_HEIGHT);
      const map = generatedCourtyard(character);
      renderCourtyard(canvas.getContext('2d'), map, { grid: true, pixelsPerTile: PIXELS_PER_TILE });
      const again = createCanvas(EXPORT_WIDTH, EXPORT_HEIGHT);
      renderCourtyard(again.getContext('2d'), map, {
        grid: true,
        pixelsPerTile: PIXELS_PER_TILE,
      });
      expect(canvas.toBuffer('image/png').equals(again.toBuffer('image/png'))).toBe(true);
    },
  );
});
