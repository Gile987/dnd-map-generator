import { HEIGHT, WIDTH, indexOf } from '../engine/model';
import type { CourtyardCharacter } from '../engine/model';
import type { CourtyardDrawing } from '../engine/object-editor/courtyard-document';
import { orderedObjects } from '../engine/object-editor/drawing-order';
import { Random, deriveSeed } from '../engine/random';
import type { DrawingContext } from './drawing-context';
import type { RenderOptions } from './render-options';
import { drawGrid, path } from './drawing-primitives';
import { drawEditorProp } from './editor-prop';

interface CourtyardAtmosphere {
  readonly grass: readonly [number, number, number];
  readonly bladeLight: string;
  readonly bladeDark: string;
  readonly missingPatch: string;
  readonly paving: readonly [number, number, number];
  readonly pavingBorder: string;
  readonly fleckLight: string;
  readonly fleckDark: string;
  readonly seam: string;
  readonly crack: string;
  readonly leafA: string;
  readonly leafB: string;
  readonly wallShadow: string;
  readonly wallBase: string;
  readonly wallFace: readonly [number, number, number];
  readonly wallHighlight: string;
  readonly wallJoint: string;
  readonly wallFleckA: string;
  readonly wallFleckB: string;
  readonly wallMoss: string;
  readonly wallBreak: string;
}

// Overgrown keeps the original literal artwork; the other characters re-tint the
// same shapes. Random consumption and geometry never depend on the character, so
// each atmosphere's shapes stay identical and renders stay deterministic.
const OVERGROWN: CourtyardAtmosphere = {
  grass: [78, 102, 60],
  bladeLight: '#b5c37c33',
  bladeDark: '#304c3529',
  missingPatch: '#9caa6a28',
  paving: [146, 150, 125],
  pavingBorder: '#55654d60',
  fleckLight: '#e1d8b126',
  fleckDark: '#344f3424',
  seam: '#ddd7b232',
  crack: '#53614b77',
  leafA: '#496b3e66',
  leafB: '#78935455',
  wallShadow: '#28382a70',
  wallBase: '#535e49',
  wallFace: [170, 167, 137],
  wallHighlight: '#ded4ac',
  wallJoint: '#525d47',
  wallFleckA: '#f0e0b332',
  wallFleckB: '#384e3435',
  wallMoss: '#55704580',
  wallBreak: '#717b5d',
};

const SUNBLEACHED: CourtyardAtmosphere = {
  grass: [150, 138, 88],
  bladeLight: '#d8c98a33',
  bladeDark: '#6b5b3329',
  missingPatch: '#b3a67228',
  paving: [186, 176, 142],
  pavingBorder: '#6b5f4760',
  fleckLight: '#efe3b926',
  fleckDark: '#7a674224',
  seam: '#e6dcb432',
  crack: '#71624677',
  leafA: '#a58f4b66',
  leafB: '#c8b47455',
  wallShadow: '#3a342670',
  wallBase: '#6b6350',
  wallFace: [196, 183, 138],
  wallHighlight: '#e9ddb6',
  wallJoint: '#6b6350',
  wallFleckA: '#f4e6bb32',
  wallFleckB: '#6b5a3535',
  wallMoss: '#8a7a3f80',
  wallBreak: '#8d8668',
};

const FROSTBOUND: CourtyardAtmosphere = {
  grass: [128, 146, 140],
  bladeLight: '#cfe0dc33',
  bladeDark: '#3c50492b',
  missingPatch: '#a4b4ac28',
  paving: [142, 152, 160],
  pavingBorder: '#4a556360',
  fleckLight: '#dde8ee26',
  fleckDark: '#33424a24',
  seam: '#c2d2d832',
  crack: '#4c5a5e77',
  leafA: '#9fb8be66',
  leafB: '#c8dde055',
  wallShadow: '#232d3170',
  wallBase: '#4a565c',
  wallFace: [158, 166, 176],
  wallHighlight: '#d5dfe6',
  wallJoint: '#45525a',
  wallFleckA: '#eef4fa32',
  wallFleckB: '#31414b35',
  wallMoss: '#5f7d8a80',
  wallBreak: '#6f7d82',
};

const DESECRATED: CourtyardAtmosphere = {
  grass: [64, 66, 52],
  bladeLight: '#77854d33',
  bladeDark: '#22271c29',
  missingPatch: '#4a4a3a28',
  paving: [98, 96, 88],
  pavingBorder: '#3a3d3160',
  fleckLight: '#bdb49326',
  fleckDark: '#222b2024',
  seam: '#a89f8632',
  crack: '#3a403a77',
  leafA: '#45503a66',
  leafB: '#68764f55',
  wallShadow: '#151a1270',
  wallBase: '#3f4438',
  wallFace: [110, 108, 96],
  wallHighlight: '#b7ab8d',
  wallJoint: '#373c30',
  wallFleckA: '#c9ba9132',
  wallFleckB: '#20291f35',
  wallMoss: '#3f5a3080',
  wallBreak: '#55604a',
};

const atmospheres: Readonly<Record<CourtyardCharacter, CourtyardAtmosphere>> = {
  Overgrown: OVERGROWN,
  Sunbleached: SUNBLEACHED,
  Frostbound: FROSTBOUND,
  Desecrated: DESECRATED,
};

function ground(ctx: DrawingContext, map: CourtyardDrawing, theme: CourtyardAtmosphere): void {
  const [gr, gg, gb] = theme.grass;
  const [pr, pg, pb] = theme.paving;
  const b = map.layout.bounds;
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      const random = new Random(deriveSeed(map.surfaceSeed, x, y));
      const paved = x > b.x && y > b.y && x < b.x + b.width - 1 && y < b.y + b.height - 1;
      const patch = new Random(
        deriveSeed(map.surfaceSeed, 'patch', Math.floor(x / 4), Math.floor(y / 4)),
      ).int(-5, 5);
      const tone = random.int(-5, 5) + patch;
      ctx.fillStyle = `rgb(${gr + tone} ${gg + tone} ${gb + tone})`;
      ctx.fillRect(x, y, 1, 1);
      for (let i = 0; i < 9; i++) {
        const gx = x + random.next(),
          gy = y + random.next();
        ctx.strokeStyle = i % 2 ? theme.bladeLight : theme.bladeDark;
        ctx.lineWidth = 0.018;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + 0.04, gy - 0.1);
        ctx.stroke();
      }
      if (!paved) continue;
      const missing = random.next() < 0.13;
      if (missing) {
        ctx.fillStyle = theme.missingPatch;
        ctx.fillRect(x + 0.1, y + 0.1, 0.8, 0.8);
        continue;
      }
      const chip = 0.03 + random.next() * 0.08;
      path(
        ctx,
        [
          [x + chip, y + 0.045],
          [x + 0.96, y + chip],
          [x + 0.96, y + 0.9],
          [x + 0.9, y + 0.96],
          [x + 0.04, y + 0.94],
        ],
        `rgb(${pr + tone} ${pg + tone} ${pb + tone})`,
        theme.pavingBorder,
      );
      for (let fleck = 0; fleck < 12; fleck++) {
        ctx.fillStyle = fleck % 2 ? theme.fleckLight : theme.fleckDark;
        ctx.fillRect(
          x + 0.1 + random.next() * 0.8,
          y + 0.1 + random.next() * 0.8,
          0.015 + random.next() * 0.035,
          0.012,
        );
      }
      ctx.strokeStyle = theme.seam;
      ctx.lineWidth = 0.025;
      ctx.beginPath();
      ctx.moveTo(x + 0.09, y + 0.88);
      ctx.lineTo(x + 0.09, y + 0.1);
      ctx.lineTo(x + 0.86, y + 0.08);
      ctx.stroke();
      if (random.next() < 0.18) {
        ctx.strokeStyle = theme.crack;
        ctx.lineWidth = 0.017;
        ctx.beginPath();
        ctx.moveTo(x + 0.05, y + 0.65);
        ctx.lineTo(x + 0.38, y + 0.5);
        ctx.lineTo(x + 0.43, y + 0.23);
        ctx.stroke();
      }
      if (random.next() < 0.25) {
        for (let leaf = 0; leaf < 7; leaf++) {
          ctx.fillStyle = leaf % 2 ? theme.leafA : theme.leafB;
          ctx.beginPath();
          ctx.ellipse(
            x + 0.04 + random.next() * 0.1,
            y + 0.1 + random.next() * 0.8,
            0.04,
            0.07,
            random.next() * 3,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
    }
}

function walls(ctx: DrawingContext, map: CourtyardDrawing, theme: CourtyardAtmosphere): void {
  const [fr, fg, fb] = theme.wallFace;
  const solid = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT && !map.layout.tiles[indexOf(x, y)];
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      if (!solid(x, y)) continue;
      ctx.fillStyle = theme.wallShadow;
      ctx.fillRect(x + 0.09, y + 0.12, 1.05, 1.08);
    }
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      if (!solid(x, y)) continue;
      const random = new Random(deriveSeed(map.surfaceSeed, 'wall', x, y));
      const tone = random.int(-6, 6);
      ctx.fillStyle = theme.wallBase;
      ctx.fillRect(x, y, 1, 1);
      const inset = 0.07;
      ctx.fillStyle = `rgb(${fr + tone} ${fg + tone} ${fb + tone})`;
      ctx.fillRect(x + inset, y + inset, 1 - inset * 2, 1 - inset * 2);
      ctx.strokeStyle = theme.wallHighlight;
      ctx.lineWidth = 0.04;
      ctx.beginPath();
      ctx.moveTo(x + 0.08, y + 0.9);
      ctx.lineTo(x + 0.08, y + 0.08);
      ctx.lineTo(x + 0.9, y + 0.08);
      ctx.stroke();
      ctx.strokeStyle = theme.wallJoint;
      ctx.lineWidth = 0.035;
      const joint = 0.35 + random.next() * 0.3;
      ctx.beginPath();
      ctx.moveTo(x + joint, y + 0.07);
      ctx.lineTo(x + joint - 0.03, y + 0.48);
      ctx.lineTo(x + 0.92, y + 0.5);
      ctx.stroke();
      for (let fleck = 0; fleck < 9; fleck++) {
        ctx.fillStyle = fleck % 2 ? theme.wallFleckA : theme.wallFleckB;
        ctx.fillRect(
          x + 0.12 + random.next() * 0.75,
          y + 0.12 + random.next() * 0.75,
          0.025,
          0.015,
        );
      }
      if (random.next() < 0.65) {
        ctx.fillStyle = theme.wallMoss;
        ctx.beginPath();
        ctx.ellipse(x + 0.2, y + 0.8, 0.15, 0.07, -0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      // Broken ends expose darker fractured stone, while the occupied tile stays legible.
      if ((!solid(x - 1, y) && !solid(x + 1, y)) || (!solid(x, y - 1) && !solid(x, y + 1))) {
        path(
          ctx,
          [
            [x + 0.65, y + 0.8],
            [x + 0.9, y + 0.65],
            [x + 0.85, y + 0.9],
          ],
          theme.wallBreak,
        );
      }
    }
}

export function renderCourtyard(
  ctx: DrawingContext,
  map: CourtyardDrawing,
  options: RenderOptions,
): void {
  const theme = atmospheres[map.decoration.character];
  ctx.save();
  ctx.setTransform(options.pixelsPerTile, 0, 0, options.pixelsPerTile, 0, 0);
  ground(ctx, map, theme);
  const items =
    map.objectEdits === 'resolved'
      ? map.instances
      : map.decoration.props.map((prop, i) => ({ id: `base-${i}`, prop }));
  const defaults = [
    ...items.filter((item) => !item.prop.blocking),
    ...items.filter((item) => item.prop.blocking),
  ];
  const ordered = orderedObjects(defaults, map.objectEdits === 'resolved' ? map.order : []);
  const firstBlocking = ordered.findIndex((item) => item.prop.blocking),
    split = firstBlocking < 0 ? ordered.length : firstBlocking;
  for (const item of ordered.slice(0, split)) drawEditorProp(ctx, item.prop, map);
  walls(ctx, map, theme);
  for (const item of ordered.slice(split)) drawEditorProp(ctx, item.prop, map);
  if (options.grid) drawGrid(ctx, '#233b2b30', options.gridOpacity);
  ctx.restore();
}
