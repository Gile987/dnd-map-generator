import type { Prop, PropKind } from '../engine/model';
import type { DrawingContext } from './drawing-context';
import { drawTent, drawBedroll, drawFireRing, drawSupplyBundle } from './camp-props';
import { drawDesk, drawBookshelf, drawScrollCase } from './study-props';
import {
  drawBarrel,
  drawBrokenColumn,
  drawCrate,
  drawMoss,
  drawRug,
  drawRubble,
  drawSarcophagus,
  drawSconce,
  drawVine,
} from './dungeon-props';
import { VERDANT_PALETTE } from './forest-palette';
import type { ForestPalette } from './forest-palette';
import {
  drawBoulder,
  drawBush,
  drawFern,
  drawFlower,
  drawLog,
  drawMushroom,
  drawStump,
  drawTree,
} from './forest-props';

type PropDrawer = (ctx: DrawingContext, prop: Prop, forest: ForestPalette) => void;

const PROP_DRAWERS: Readonly<Record<PropKind, PropDrawer>> = {
  crate: drawCrate,
  barrel: drawBarrel,
  rubble: drawRubble,
  rug: drawRug,
  moss: drawMoss,
  sarcophagus: drawSarcophagus,
  vine: drawVine,
  broken_column: drawBrokenColumn,
  sconce: drawSconce,
  tree: (ctx, prop, forest) => drawTree(ctx, prop, forest.trees(prop.variation)),
  boulder: (ctx, prop, forest) => drawBoulder(ctx, prop, forest.boulderMoss),
  fern: drawFern,
  mushroom: drawMushroom,
  bush: drawBush,
  log: drawLog,
  stump: drawStump,
  flower: drawFlower,
  tent: drawTent,
  bedroll: drawBedroll,
  fire_ring: drawFireRing,
  supply_bundle: drawSupplyBundle,
  desk: drawDesk,
  bookshelf: drawBookshelf,
  scroll_case: drawScrollCase,
};

export function drawProp(
  ctx: DrawingContext,
  prop: Prop,
  forest: ForestPalette = VERDANT_PALETTE,
): void {
  ctx.save();
  ctx.translate(prop.x + 0.5, prop.y + (prop.kind === 'sconce' ? 0.18 : 0.5));
  ctx.lineWidth = 0.025;
  PROP_DRAWERS[prop.kind](ctx, prop, forest);
  ctx.restore();
}
