import { drawRuinedShrine, shrinePalette } from './ruined-shrine';
import {
  drawSmallTable,
  drawWoodenBed,
  drawWoodenBench,
  drawTreasureChest,
  drawSupplySacks,
  drawWeaponRack,
  portablePropPalette,
} from './portable-props';
import type { PortablePropPalette } from './portable-props';
import {
  drawFallenTrunk,
  drawFallenRoots,
  drawFallenBranch,
  drawFallenFungi,
} from './fallen-tree-props';
import {
  drawCollapsedWagon,
  drawWagonWheel,
  drawSpilledCrate,
  drawSpilledGoods,
} from './wagon-props';
import { drawDiningTable } from './furniture-props';
import { drawRitualAltar, drawRitualCandles, drawRitualOffering } from './ritual-props';
import {
  drawAbandonedBrazier,
  drawDryFountain,
  drawLowRubble,
  drawStoneWell,
} from './courtyard-props';
import { propBounds } from '../engine/prop-footprint';
import { drawStandingStone, drawWeatheredStatue } from './landmark-props';
import type { CourtyardCharacter, Prop, PropKind } from '../engine/model';
import type { DrawingContext } from './drawing-context';
import { drawTent, drawBedroll, drawFireRing, drawSupplyBundle } from './camp-props';
import { drawDesk, drawBookshelf, drawScrollCase } from './study-props';
import {
  drawTelescope,
  drawStarChartTable,
  drawInstrumentCabinet,
  drawStarCharts,
} from './observatory-props';
import { drawCauldron } from './laboratory-props';
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

type PropDrawer = (
  ctx: DrawingContext,
  prop: Prop,
  forest: ForestPalette,
  courtyard: CourtyardCharacter,
  portable: PortablePropPalette,
  shrine: ReturnType<typeof shrinePalette>,
) => void;

const PROP_DRAWERS: Readonly<Record<PropKind, PropDrawer>> = {
  ruined_shrine: (ctx, prop, _forest, _courtyard, _portable, shrine) =>
    drawRuinedShrine(ctx, prop, shrine),
  small_table: (ctx, prop, _forest, _courtyard, portable) => drawSmallTable(ctx, prop, portable),
  wooden_bed: (ctx, prop, _forest, _courtyard, portable) => drawWoodenBed(ctx, prop, portable),
  wooden_bench: (ctx, prop, _forest, _courtyard, portable) => drawWoodenBench(ctx, prop, portable),
  treasure_chest: (ctx, prop, _forest, _courtyard, portable) =>
    drawTreasureChest(ctx, prop, portable),
  supply_sacks: (ctx, prop, _forest, _courtyard, portable) => drawSupplySacks(ctx, prop, portable),
  weapon_rack: (ctx, prop, _forest, _courtyard, portable) => drawWeaponRack(ctx, prop, portable),
  ritual_altar: drawRitualAltar,
  ritual_candles: (ctx, prop) => drawRitualCandles(ctx, prop, prop.artRotation),
  ritual_offering: drawRitualOffering,
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
  standing_stone: drawStandingStone,
  weathered_statue: drawWeatheredStatue,
  dining_table: drawDiningTable,
  desk: drawDesk,
  bookshelf: drawBookshelf,
  scroll_case: drawScrollCase,
  dry_fountain: drawDryFountain,
  low_rubble: drawLowRubble,
  stone_well: drawStoneWell,
  abandoned_brazier: (ctx, prop, _forest, courtyard) => drawAbandonedBrazier(ctx, prop, courtyard),
  fallen_trunk: drawFallenTrunk,
  fallen_roots: drawFallenRoots,
  fallen_branch: drawFallenBranch,
  fallen_fungi: drawFallenFungi,
  collapsed_wagon: drawCollapsedWagon,
  wagon_wheel: drawWagonWheel,
  spilled_crate: drawSpilledCrate,
  spilled_goods: drawSpilledGoods,
  cauldron: drawCauldron,
  telescope: drawTelescope,
  star_chart_table: drawStarChartTable,
  instrument_cabinet: drawInstrumentCabinet,
  star_charts: drawStarCharts,
};

export function drawProp(
  ctx: DrawingContext,
  prop: Prop,
  forest: ForestPalette = VERDANT_PALETTE,
  courtyard: CourtyardCharacter = 'Overgrown',
  portable: PortablePropPalette = portablePropPalette(forest, courtyard),
  shrine = shrinePalette(undefined, undefined, courtyard),
): void {
  ctx.save();
  if (prop.footprint) {
    const bounds = propBounds(prop);
    ctx.translate(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    ctx.rotate(((prop.rotation ?? 0) * Math.PI) / 2);
  } else {
    ctx.translate(prop.x + 0.5, prop.y + (prop.kind === 'sconce' ? 0.18 : 0.5));
  }
  if (prop.artRotation && prop.kind !== 'ritual_candles')
    ctx.rotate((prop.artRotation * Math.PI) / 2);
  ctx.lineWidth = 0.025;
  PROP_DRAWERS[prop.kind](ctx, prop, forest, courtyard, portable, shrine);
  ctx.restore();
}
