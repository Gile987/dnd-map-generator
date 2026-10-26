import { DENSITY_BUDGETS, HEIGHT, WIDTH, indexOf, isWalkable } from './model';
import type { Density, ForestLayout, Point, Prop } from './model';
import { forestDistances } from './forest-layout';
import { Random, shuffleInPlace, streamSeed } from './random';

// Six one-tile blockers surround a clear 3 × 3 center. The 7 × 7 reserve
// includes a circulation margin; the stored path can pass through the gaps.
const offsets: readonly Point[] = [
  { x: 0, y: -2 },
  { x: 2, y: -1 },
  { x: 2, y: 1 },
  { x: 0, y: 2 },
  { x: -2, y: 1 },
  { x: -2, y: -1 },
];

export function circleReserve(center: Point, point: Point): boolean {
  return Math.abs(point.x - center.x) <= 3 && Math.abs(point.y - center.y) <= 3;
}

export function stoneCircleError(layout: ForestLayout, props: readonly Prop[]): string | undefined {
  const stones = props.filter((p) => p.kind === 'standing_stone');
  const center = {
    x: stones.reduce((sum, p) => sum + p.x, 0) / 6,
    y: stones.reduce((sum, p) => sum + p.y, 0) / 6,
  };
  if (
    stones.length !== 6 ||
    !Number.isInteger(center.x) ||
    !Number.isInteger(center.y) ||
    offsets.some(
      (offset) =>
        stones.filter((p) => p.x === center.x + offset.x && p.y === center.y + offset.y).length !==
        1,
    )
  )
    return 'A complete standing-stone circle could not fit. Try another seed or remove the camp.';
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++)
      if (!isWalkable(layout, center.x + dx, center.y + dy))
        return 'The standing-stone circle needs a clear 7 × 7 area.';
  if (
    stones.some((p) => layout.route.includes(indexOf(p.x, p.y))) ||
    props.some((p) => p.kind !== 'standing_stone' && circleReserve(center, p))
  )
    return 'The standing-stone circle needs clear ground and an open path.';
  // Keep the camp's entire reserved area separate, including empty space.
  const hearth = props.find((p) => p.kind === 'fire_ring');
  if (hearth && Math.abs(hearth.x - center.x) <= 6 && Math.abs(hearth.y - center.y) <= 5)
    return 'The camp and landmark need separate encounter space.';
  return undefined;
}

export function placeStoneCircle(
  layout: ForestLayout,
  props: readonly Prop[],
  seed: string,
  density: Density,
  revision: number,
): readonly Prop[] | undefined {
  const random = new Random(streamSeed(seed, 'forest-landmark', 'v1', density, revision));
  const candidates: Point[] = [];
  for (let y = 3; y < HEIGHT - 3; y++)
    for (let x = 3; x < WIDTH - 3; x++) candidates.push({ x, y });
  shuffleInPlace(candidates, random);
  const budget = Math.floor(layout.tiles.filter(Boolean).length * DENSITY_BUDGETS[density]);
  for (const center of candidates) {
    const stones: Prop[] = offsets.map((p) => ({
      x: center.x + p.x,
      y: center.y + p.y,
      kind: 'standing_stone',
      blocking: true,
      variation: random.next(),
    }));
    // Scene objects are never removed to make room for a landmark.
    let blockers =
      stones.length +
      props.filter((p) => (p.blocking && p.kind === 'tent') || p.kind === 'supply_bundle').length;
    if (blockers > budget) continue;
    const retained = props.filter((p) => {
      if (
        p.kind === 'tent' ||
        p.kind === 'bedroll' ||
        p.kind === 'fire_ring' ||
        p.kind === 'supply_bundle'
      )
        return true;
      if (circleReserve(center, p)) return false;
      return !p.blocking || ++blockers <= budget;
    });
    const placed = [...retained, ...stones];
    if (stoneCircleError(layout, placed)) continue;
    const blocked = new Set(placed.filter((p) => p.blocking).map((p) => indexOf(p.x, p.y)));
    if (
      forestDistances(layout.tiles, layout.pathStart, blocked).size !==
      layout.tiles.filter(Boolean).length - blocked.size
    )
      continue;
    return placed;
  }
  return undefined;
}
