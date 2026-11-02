import { areaAround, areaContains, areasOverlap } from './feature-reservation';
import type { ReservedArea } from './feature-reservation';
import { CAMP_PROP_KINDS, campReservations } from './forest-camp';
import { DENSITY_BUDGETS, HEIGHT, WIDTH, indexOf } from './model';
import type { Density, ForestLayout, Prop } from './model';
import { forestDistances } from './forest-layout';
import { propCells } from './prop-footprint';
import { Random, shuffleInPlace, streamSeed } from './random';

export interface FallenTreeSite {
  readonly props: readonly Prop[];
  readonly area: ReservedArea;
}
function protectedProp(p: Prop) {
  return CAMP_PROP_KINDS.includes(p.kind) || p.kind === 'standing_stone';
}

/** Format-18 geometry and stream. Existing camp, circle and ordinary RNG streams stay intact. */
export function fallenTreeSite(
  layout: ForestLayout,
  props: readonly Prop[],
  seed: string,
  density: Density,
  revision: number,
): FallenTreeSite | undefined {
  const reserved = campReservations(props).map((r) => r.area);
  const stones = props.filter((p) => p.kind === 'standing_stone');
  if (stones.length) {
    if (stones.length !== 6) return undefined;
    reserved.push(
      areaAround(
        { x: stones.reduce((s, p) => s + p.x, 0) / 6, y: stones.reduce((s, p) => s + p.y, 0) / 6 },
        3,
        3,
      ),
    );
  }
  const fixed = props.filter(protectedProp),
    hardBlocked = new Set(fixed.filter((p) => p.blocking).map((p) => indexOf(p.x, p.y)));
  if (
    hardBlocked.size + 5 >
    Math.floor(layout.tiles.filter(Boolean).length * DENSITY_BUDGETS[density])
  )
    return undefined;
  const candidates: { x: number; y: number; rotation: 0 | 1 }[] = [];
  for (const rotation of [0, 1] as const) {
    const width = rotation ? 3 : 6,
      height = rotation ? 6 : 3;
    for (let y = 1; y < HEIGHT - height; y++)
      for (let x = 1; x < WIDTH - width; x++) candidates.push({ x, y, rotation });
  }
  shuffleInPlace(
    candidates,
    new Random(streamSeed(seed, 'forest-fallen-tree', 'v1', density, revision)),
  );
  const route = new Set(layout.route),
    open = layout.tiles.filter(Boolean).length,
    nearRoute = new Set<number>();
  for (const tile of route)
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = (tile % WIDTH) + dx,
          y = Math.floor(tile / WIDTH) + dy;
        if (Math.abs(dx) + Math.abs(dy) <= 4 && x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT)
          nearRoute.add(indexOf(x, y));
      }
  for (const site of candidates) {
    const area = {
      x: site.x,
      y: site.y,
      width: site.rotation ? 3 : 6,
      height: site.rotation ? 6 : 3,
    };
    if (reserved.some((r) => areasOverlap(r, area))) continue;
    let clear = true,
      nearPath = false;
    for (let y = area.y; y < area.y + area.height && clear; y++)
      for (let x = area.x; x < area.x + area.width; x++) {
        const tile = indexOf(x, y);
        if (!layout.tiles[tile] || route.has(tile)) {
          clear = false;
          break;
        }
        if (nearRoute.has(tile)) nearPath = true;
      }
    if (!clear || !nearPath) continue;
    const at = (x: number, y: number, height = 1) =>
      site.rotation
        ? { x: site.x + 3 - y - height, y: site.y + x }
        : { x: site.x + x, y: site.y + y };
    const pack: Prop[] = [
      {
        ...at(1, 1),
        kind: 'fallen_trunk',
        blocking: true,
        variation: 0.4,
        footprint: { width: 4, height: 1 },
        rotation: site.rotation,
      },
      { ...at(0, 1), kind: 'fallen_roots', blocking: true, variation: 0.4 },
      { ...at(5, 0), kind: 'fallen_branch', blocking: false, variation: 0.4 },
      { ...at(4, 2), kind: 'fallen_fungi', blocking: false, variation: 0.4 },
    ];
    const blocked = new Set(hardBlocked);
    for (const p of pack.filter((p) => p.blocking))
      for (const cell of propCells(p)) blocked.add(indexOf(cell.x, cell.y));
    if (forestDistances(layout.tiles, layout.pathStart, blocked).size === open - blocked.size)
      return { props: pack, area };
  }
  return undefined;
}

export function placeFallenTree(
  layout: ForestLayout,
  props: readonly Prop[],
  seed: string,
  density: Density,
  revision: number,
): readonly Prop[] | undefined {
  const site = fallenTreeSite(layout, props, seed, density, revision);
  if (!site) return undefined;
  const fixed = new Set(props.filter(protectedProp));
  const budget = Math.floor(layout.tiles.filter(Boolean).length * DENSITY_BUDGETS[density]);
  let blockers = 5 + props.filter((p) => p.blocking && fixed.has(p)).length;
  let retained = props.filter((p) => {
    if (fixed.has(p)) return true;
    if (areaContains(site.area, p)) return false;
    return !p.blocking || ++blockers <= budget;
  });
  while (true) {
    const placed = [...retained, ...site.props],
      blocked = new Set<number>();
    for (const p of placed.filter((p) => p.blocking))
      for (const cell of propCells(p)) blocked.add(indexOf(cell.x, cell.y));
    if (
      forestDistances(layout.tiles, layout.pathStart, blocked).size ===
      layout.tiles.filter(Boolean).length - blocked.size
    )
      return placed;
    let index = -1;
    for (let i = retained.length - 1; i >= 0; i--) {
      const p = retained[i];
      if (p?.blocking && !fixed.has(p)) {
        index = i;
        break;
      }
    }
    if (index < 0) return undefined;
    retained = retained.filter((_, i) => i !== index);
  }
}
