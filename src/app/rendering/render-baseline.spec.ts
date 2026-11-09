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

  // Committed with the courtyard character release; Overgrown reproduces the
  // historical renderer byte for byte.
  test.each([
    [
      'generated-courtyard',
      'Overgrown',
      true,
      'ae67666fc92c9cedf30ef334d0a31a9b02a347d4554dba3cd80ec1f00479d8eb',
    ],
    [
      'generated-courtyard',
      'Overgrown',
      false,
      '5e9f2e25449cb0ad1024e3489a19c601b5c08ecd1c5c409817977bd9294fd103',
    ],
    [
      'generated-courtyard',
      'Sunbleached',
      true,
      '0d1a39a8afa89c94a76ded579bc70894813d4a1f195da873524f6b9826db2db0',
    ],
    [
      'generated-courtyard',
      'Sunbleached',
      false,
      '339ee47586c4c70f28cedba50dd226ce86becbead3108341610357dacb87abea',
    ],
    [
      'generated-courtyard',
      'Frostbound',
      true,
      '46b693fa4ac820af93451b8581ebdf1694fce162d4b54058bc167307320da20d',
    ],
    [
      'generated-courtyard',
      'Frostbound',
      false,
      'c33e0c15aa7a6bbd7604b0c80715e47deecf16834b2ed2b53c847c789303133a',
    ],
    [
      'generated-courtyard',
      'Desecrated',
      true,
      'ce57d658b19b10bf6b1fc8b43879f5c4614c465c863ffa5296b65249ac112da9',
    ],
    [
      'generated-courtyard',
      'Desecrated',
      false,
      '28d2c0adb285accecba392ce0708da4064104077dc7e5872fff1247b04de7392',
    ],
  ] as const)(
    'courtyard pixels are unchanged for %s (%s) with grid=%s',
    (_kind, character, grid, expected) => {
      expect(courtyardHash(generatedCourtyard(character), grid)).toBe(expected);
    },
  );

  // Committed with the stone-well release; each hash below pins one
  // character's well render both with and without the grid overlay.
  test.each([
    [
      'courtyard-well',
      'Overgrown',
      true,
      'f203956cfb0e4be13a362bf87e6c21f90f0e60099b90b16f1e86b4b0db00f651',
    ],
    [
      'courtyard-well',
      'Overgrown',
      false,
      'cf49a5c9d7af335eca8f14020efb65f0b544c5a26352ab31411bec68c5b79106',
    ],
    [
      'courtyard-well',
      'Sunbleached',
      true,
      '783f898067849e3853e38cb0a6b4fbb5746e25f0fdfbff8f21dae3ba8d1ec434',
    ],
    [
      'courtyard-well',
      'Sunbleached',
      false,
      '1aa5319c248054e399ada5f2fc07274294ca1e271380f67d4c1b83f4458c9667',
    ],
    [
      'courtyard-well',
      'Frostbound',
      true,
      'ed0372827e8521213fd9ad9c734354368299861f1507b095aaa261b3186d0280',
    ],
    [
      'courtyard-well',
      'Frostbound',
      false,
      '9fa7aa2aea84e0f3185a0187bc522388e2c1f881cdc9e09f05626e4863ae48e3',
    ],
    [
      'courtyard-well',
      'Desecrated',
      true,
      '47b252405e0c46e23082952f6dc9dca914147bce8ce6fbbbf9646d1b01db6bd6',
    ],
    [
      'courtyard-well',
      'Desecrated',
      false,
      'c18e8f2df17cb487a471ff72404a4afc0c5f412a5ebc9d95a03710e4837c2e94',
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
