import { areaAround, areaContains, areasOverlap } from './feature-reservation';
import type { FeatureReservation } from './feature-reservation';
import { DENSITY_BUDGETS, HEIGHT, WIDTH, indexOf, isWalkable } from './model';
import type { Density, ForestLayout, ForestLandmark, Point, Prop } from './model';
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
  return areaContains(areaAround(center, 3, 3), point);
}

export function stoneCircleError(
  layout: ForestLayout,
  props: readonly Prop[],
  reservations: readonly FeatureReservation[] = [],
): string | undefined {
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
  if (reservations.some((reservation) => areasOverlap(areaAround(center, 3, 3), reservation.area)))
    return 'The scene and landmark need separate encounter space.';
  return undefined;
}

export function placeStoneCircle(
  layout: ForestLayout,
  props: readonly Prop[],
  seed: string,
  density: Density,
  revision: number,
  reservations: readonly FeatureReservation[] = [],
): readonly Prop[] | undefined {
  const random = new Random(streamSeed(seed, 'forest-landmark', 'v1', density, revision));
  const candidates: Point[] = [];
  for (let y = 3; y < HEIGHT - 3; y++)
    for (let x = 3; x < WIDTH - 3; x++) candidates.push({ x, y });
  shuffleInPlace(candidates, random);
  const budget = Math.floor(layout.tiles.filter(Boolean).length * DENSITY_BUDGETS[density]);
  const protectedProps = new Set(reservations.flatMap((reservation) => reservation.props));
  for (const center of candidates) {
    const stones: Prop[] = offsets.map((p) => ({
      x: center.x + p.x,
      y: center.y + p.y,
      kind: 'standing_stone',
      blocking: true,
      variation: random.next(),
    }));
    // Scene objects are never removed to make room for a landmark.
    let blockers = stones.length + props.filter((p) => p.blocking && protectedProps.has(p)).length;
    if (blockers > budget) continue;
    const retained = props.filter((p) => {
      if (protectedProps.has(p)) return true;
      if (circleReserve(center, p)) return false;
      return !p.blocking || ++blockers <= budget;
    });
    const placed = [...retained, ...stones];
    if (stoneCircleError(layout, placed, reservations)) continue;
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

// Map-specific rules stay separate from the shared presentation catalog.
export const FOREST_LANDMARK_RULES = {
  'standing-stone-circle': { place: placeStoneCircle, validate: stoneCircleError },
} satisfies Record<
  Exclude<ForestLandmark, 'None'>,
  {
    readonly place: typeof placeStoneCircle;
    readonly validate: typeof stoneCircleError;
  }
>;
