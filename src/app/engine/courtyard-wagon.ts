import { indexOf } from './model';
import type { CourtyardLayout, Prop, QuarterTurn } from './model';
import { Random, shuffleInPlace, streamSeed } from './random';
import { gridDistances } from './grid-traversal';
import { propCells } from './prop-footprint';

export interface CourtyardWagon {
  readonly props: readonly Prop[];
  readonly reserve: ReadonlySet<number>;
}

/** Frozen format-17 arrangement. A separate stream never advances ordinary decoration RNG. */
export function placeCollapsedWagon(
  layout: CourtyardLayout,
  seed: string,
  protectedCells: ReadonlySet<number>,
): CourtyardWagon | undefined {
  const sites: { x: number; y: number; rotation: QuarterTurn }[] = [];
  for (const rotation of [0, 1] as const) {
    const width = rotation ? 4 : 6,
      height = rotation ? 6 : 4;
    for (let y = layout.bounds.y + 2; y <= layout.bounds.y + layout.bounds.height - height - 2; y++)
      for (let x = layout.bounds.x + 2; x <= layout.bounds.x + layout.bounds.width - width - 2; x++)
        sites.push({ x, y, rotation });
  }
  shuffleInPlace(sites, new Random(streamSeed(seed, 'courtyard-wagon', 1)));
  const open = layout.tiles.filter(Boolean).length;
  for (const site of sites) {
    const width = site.rotation ? 4 : 6,
      height = site.rotation ? 6 : 4;
    const reserve = new Set<number>();
    for (let y = site.y; y < site.y + height; y++)
      for (let x = site.x; x < site.x + width; x++) reserve.add(indexOf(x, y));
    if ([...reserve].some((tile) => !layout.tiles[tile] || protectedCells.has(tile))) continue;
    const at = (x: number, y: number, height = 1) =>
      site.rotation
        ? { x: site.x + 4 - y - height, y: site.y + x }
        : { x: site.x + x, y: site.y + y };
    const props: Prop[] = [
      {
        ...at(1, 1, 2),
        kind: 'collapsed_wagon',
        footprint: { width: 3, height: 2 },
        rotation: site.rotation,
        blocking: true,
        variation: 0.35,
      },
      { ...at(5, 0), kind: 'spilled_crate', blocking: true, variation: 0.35 },
      { ...at(5, 3), kind: 'wagon_wheel', blocking: false, variation: 0.35 },
      { ...at(0, 0), kind: 'spilled_goods', blocking: false, variation: 0.35 },
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
