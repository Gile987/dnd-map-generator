import { propCells } from './prop-footprint';
import { contains, DENSITY_BUDGETS, indexOf } from './model';
import type { Density, DecorationPreset, DungeonLandmark, Layout, Point, Prop } from './model';
import { areaAround, areaContains, areasOverlap } from './feature-reservation';
import type { FeatureReservation, ReservedArea } from './feature-reservation';
import { reservedTiles, isTraversable } from './dungeon-space';
import { Random, shuffleInPlace, streamSeed } from './random';

export function statueArea(center: Point): ReservedArea {
  return areaAround(center, 2, 2);
}

export function statueReservations(props: readonly Prop[]): readonly FeatureReservation[] {
  return props
    .filter((p) => p.kind === 'weathered_statue')
    .map((statue) => ({ area: statueArea(statue), props: [statue] }));
}

function statueError(
  layout: Layout,
  props: readonly Prop[],
  reservations: readonly FeatureReservation[],
): string | undefined {
  const statues = props.filter((p) => p.kind === 'weathered_statue');
  const statue = statues[0];
  if (statues.length !== 1 || !statue)
    return 'A weathered statue could not fit. Try another seed or remove the study.';
  const room = layout.rooms.find((room) => contains(room, statue));
  const area = statueArea(statue);
  if (
    !room ||
    room.id === layout.entrance.roomId ||
    room.id === layout.objective.roomId ||
    !contains(room, area) ||
    !contains(room, { x: area.x + area.width - 1, y: area.y + area.height - 1 }) ||
    reservedTiles(layout).has(indexOf(statue.x, statue.y))
  )
    return 'The statue needs a clear 5 × 5 area away from doors, entrance, and objective.';
  if (
    props.some((p) => p !== statue && propCells(p).some((cell) => areaContains(area, cell))) ||
    reservations.some((reservation) => areasOverlap(area, reservation.area))
  )
    return 'The statue and scene need separate clear encounter space.';
  return undefined;
}

function placeStatue(
  layout: Layout,
  props: readonly Prop[],
  seed: string,
  density: Density,
  preset: DecorationPreset,
  revision: number,
  reservations: readonly FeatureReservation[],
): readonly Prop[] | undefined {
  const random = new Random(
    streamSeed(seed, 'dungeon-landmark', 'weathered-statue', 'v1', preset, density, revision),
  );
  const candidates: Point[] = [];
  for (const room of layout.rooms)
    for (let y = room.y + 2; y < room.y + room.height - 2; y++)
      for (let x = room.x + 2; x < room.x + room.width - 2; x++) candidates.push({ x, y });
  shuffleInPlace(candidates, random);
  const protectedProps = new Set(reservations.flatMap((reservation) => reservation.props));
  for (const center of candidates) {
    const room = layout.rooms.find((room) => contains(room, center));
    if (!room) continue;
    const area = statueArea(center);
    const budget = Math.floor(room.width * room.height * DENSITY_BUDGETS[density]);
    let blockers =
      1 +
      props
        .filter((p) => p.blocking && contains(room, p) && protectedProps.has(p))
        .flatMap(propCells).length;
    if (blockers > budget) continue;
    const retained = props.filter((p) => {
      if (protectedProps.has(p)) return true;
      if (propCells(p).some((cell) => areaContains(area, cell))) return false;
      if (!contains(room, p) || !p.blocking) return true;
      blockers += propCells(p).length;
      return blockers <= budget;
    });
    const placed: readonly Prop[] = [
      ...retained,
      { ...center, kind: 'weathered_statue', blocking: true, variation: random.next() },
    ];
    if (statueError(layout, placed, reservations)) continue;
    const blocked = new Set(
      placed
        .filter((p) => p.blocking)
        .flatMap(propCells)
        .map((p) => indexOf(p.x, p.y)),
    );
    if (isTraversable(layout, blocked)) return placed;
  }
  return undefined;
}

export const DUNGEON_LANDMARK_RULES = {
  'weathered-statue': { place: placeStatue, validate: statueError },
} satisfies Record<
  Exclude<DungeonLandmark, 'None'>,
  {
    readonly place: typeof placeStatue;
    readonly validate: typeof statueError;
  }
>;
