import { indexOf } from './model';
import type { CourtyardLayout, Prop } from './model';
import { Random, shuffleInPlace, streamSeed } from './random';
import { gridDistances } from './grid-traversal';
import { propCells } from './prop-footprint';

export interface CourtyardWell {
  readonly props: readonly Prop[];
  readonly reserve: ReadonlySet<number>;
}

/** A 2 × 2 blocking well body with one clear circulation tile on every side. */
export const WELL_RESERVE_WIDTH = 4;

/** Frozen format-30 placement. A separate stream never advances ordinary decoration RNG. */
export function placeStoneWell(
  layout: CourtyardLayout,
  seed: string,
  protectedCells: ReadonlySet<number>,
): CourtyardWell | undefined {
  const sites: { x: number; y: number }[] = [];
  for (
    let y = layout.bounds.y + 2;
    y <= layout.bounds.y + layout.bounds.height - WELL_RESERVE_WIDTH - 2;
    y++
  )
    for (
      let x = layout.bounds.x + 2;
      x <= layout.bounds.x + layout.bounds.width - WELL_RESERVE_WIDTH - 2;
      x++
    )
      sites.push({ x, y });
  shuffleInPlace(sites, new Random(streamSeed(seed, 'courtyard-well', 1)));
  const open = layout.tiles.filter(Boolean).length;
  for (const site of sites) {
    const reserve = new Set<number>();
    for (let y = site.y; y < site.y + WELL_RESERVE_WIDTH; y++)
      for (let x = site.x; x < site.x + WELL_RESERVE_WIDTH; x++) reserve.add(indexOf(x, y));
    if ([...reserve].some((tile) => !layout.tiles[tile] || protectedCells.has(tile))) continue;
    const props: Prop[] = [
      {
        x: site.x + 1,
        y: site.y + 1,
        kind: 'stone_well',
        footprint: { width: 2, height: 2 },
        rotation: 0,
        blocking: true,
        variation: 0.35,
      },
    ];
    const blocked = new Set(
      props
        .filter((p) => p.blocking)
        .flatMap((p) => propCells(p).map((cell) => indexOf(cell.x, cell.y))),
    );
    if (gridDistances(layout.tiles, { x: 0, y: 0 }, blocked).size === open - blocked.size)
      return { props, reserve };
  }
  return undefined;
}
