import type { CourtyardCharacter, DecorationPreset, ForestCharacter, Prop } from '../engine/model';
import type { DrawingContext } from './drawing-context';
import { path } from './drawing-primitives';

interface ShrinePalette {
  readonly stone: string;
  readonly edge: string;
  readonly light: string;
  readonly carving: string;
  readonly weathering: string;
}

/** Matches the Courtyard characters' wall stone and weathering. */
const SHRINE_PALETTES: Readonly<Record<CourtyardCharacter, ShrinePalette>> = {
  Overgrown: {
    stone: '#aaa789',
    edge: '#535e49',
    light: '#ded4ac',
    carving: '#717b5d',
    weathering: '#557045',
  },
  Sunbleached: {
    stone: '#c4b78a',
    edge: '#6b6350',
    light: '#e9ddb6',
    carving: '#8d8668',
    weathering: '#a58f4b',
  },
  Frostbound: {
    stone: '#9ea6b0',
    edge: '#4a565c',
    light: '#d5dfe6',
    carving: '#6f7d82',
    weathering: '#c8dde0',
  },
  Desecrated: {
    stone: '#6e6c60',
    edge: '#3f4438',
    light: '#b7ab8d',
    carving: '#55604a',
    weathering: '#45503a',
  },
};

const DUNGEON_SHRINE_PALETTES: Readonly<Record<DecorationPreset, ShrinePalette>> = {
  Mosslit: SHRINE_PALETTES.Overgrown,
  Crypt: {
    stone: '#96998d',
    edge: '#424c49',
    light: '#c8c9b4',
    carving: '#646e62',
    weathering: '#6b7863',
  },
  Storehouse: {
    stone: '#b0a17d',
    edge: '#5e5242',
    light: '#d8c79e',
    carving: '#83745b',
    weathering: '#8c8056',
  },
  Sanctuary: {
    stone: '#aab3a0',
    edge: '#485b50',
    light: '#d9dfc5',
    carving: '#788978',
    weathering: '#809563',
  },
};
const FOREST_SHRINE_PALETTES: Readonly<Record<ForestCharacter, ShrinePalette>> = {
  Verdant: SHRINE_PALETTES.Overgrown,
  Autumn: {
    stone: '#ac9f85',
    edge: '#635440',
    light: '#dac9a7',
    carving: '#89755a',
    weathering: '#a8743a',
  },
  Pines: {
    stone: '#939e98',
    edge: '#465650',
    light: '#c6d1c5',
    carving: '#697c70',
    weathering: '#456b52',
  },
  Fey: {
    stone: '#a6a0b3',
    edge: '#514b68',
    light: '#dad1e5',
    carving: '#817395',
    weathering: '#81978d',
  },
};

/** Accepted map settings choose the same stone colors for catalog, ghost and exports.
 * Tower has no character setting and retains the original weathered stone.
 */
export function shrinePalette(
  preset?: DecorationPreset,
  forest?: ForestCharacter,
  courtyard: CourtyardCharacter = 'Overgrown',
): ShrinePalette {
  return preset
    ? DUNGEON_SHRINE_PALETTES[preset]
    : forest
      ? FOREST_SHRINE_PALETTES[forest]
      : SHRINE_PALETTES[courtyard];
}

/** Chipped altar, carved slab and broken rear plinth; all artwork fits one square. */
export function drawRuinedShrine(ctx: DrawingContext, prop: Prop, colors: ShrinePalette): void {
  ctx.fillStyle = '#17201666';
  ctx.fillRect(-0.4, -0.37, 0.85, 0.82);
  path(
    ctx,
    [
      [-0.43, -0.36],
      [0.32, -0.36],
      [0.43, -0.25],
      [0.43, 0.37],
      [0.3, 0.43],
      [-0.43, 0.43],
    ],
    colors.edge,
  );
  path(
    ctx,
    [
      [-0.39, -0.35],
      [0.3, -0.35],
      [0.4, -0.23],
      [0.4, 0.32],
      [0.28, 0.37],
      [-0.39, 0.37],
    ],
    colors.stone,
  );
  // The broken rear plinth gives the shrine a visible facing when rotated.
  path(
    ctx,
    [
      [-0.35, -0.4],
      [-0.1, -0.43],
      [0.02, -0.34],
      [0.13, -0.4],
      [0.35, -0.36],
      [0.35, -0.23],
      [-0.35, -0.23],
    ],
    colors.edge,
  );
  ctx.strokeStyle = colors.light;
  ctx.lineWidth = 0.022;
  ctx.beginPath();
  ctx.moveTo(-0.34, -0.38);
  ctx.lineTo(-0.1, -0.4);
  ctx.lineTo(-0.01, -0.32);
  ctx.stroke();
  ctx.fillStyle = colors.edge;
  ctx.fillRect(-0.31, -0.18, 0.62, 0.46);
  ctx.fillStyle = colors.stone;
  ctx.fillRect(-0.29, -0.18, 0.58, 0.4);
  ctx.strokeStyle = colors.light;
  ctx.lineWidth = 0.018;
  ctx.strokeRect(-0.26, -0.15, 0.52, 0.34);
  // Faded sun and diamond carving; no random draws or saved artwork state.
  ctx.strokeStyle = colors.carving;
  ctx.lineWidth = 0.021;
  ctx.beginPath();
  ctx.arc(0, 0.02, 0.12, 0.2, Math.PI * 1.8);
  ctx.moveTo(0, -0.07);
  ctx.lineTo(0.07, 0.02);
  ctx.lineTo(0, 0.11);
  ctx.lineTo(-0.07, 0.02);
  ctx.closePath();
  ctx.stroke();
  ctx.strokeStyle = colors.edge;
  ctx.lineWidth = 0.018;
  ctx.beginPath();
  ctx.moveTo(0.29, -0.18);
  ctx.lineTo(0.18, -0.08);
  ctx.lineTo(0.2, 0.02 + (prop.variation - 0.5) * 0.04);
  ctx.lineTo(0.12, 0.09);
  ctx.moveTo(-0.39, 0.25);
  ctx.lineTo(-0.31, 0.2);
  ctx.lineTo(-0.23, 0.25);
  ctx.stroke();
  ctx.fillStyle = colors.weathering;
  for (const [x, y, radius] of [
    [-0.34, 0.31, 0.04],
    [-0.29, 0.33, 0.025],
    [0.32, -0.29, 0.03],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
