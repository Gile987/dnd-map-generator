import { contains, DENSITY_BUDGETS, indexOf } from './model';
import type { Density, DecorationPreset, Layout, Point, Prop } from './model';
import { areaAround, areasOverlap, areaContains } from './feature-reservation';
import type { FeatureReservation } from './feature-reservation';
import { propCells } from './prop-footprint';
import { reservedTiles, isTraversable } from './dungeon-space';
import { Random, shuffleInPlace, streamSeed } from './random';

const arrangement = [
  { x: 0, y: -1, kind: 'ritual_altar', blocking: true },
  { x: -1, y: -1, kind: 'ritual_candles', blocking: false },
  { x: 1, y: -1, kind: 'ritual_candles', blocking: false },
  { x: -1, y: 1, kind: 'ritual_offering', blocking: false },
  { x: 1, y: 1, kind: 'ritual_offering', blocking: false },
] as const;

function rotate(point: Point, turn: number): Point {
  if (turn === 1) return { x: -point.y, y: point.x };
  if (turn === 2) return { x: -point.x, y: -point.y };
  if (turn === 3) return { x: point.y, y: -point.x };
  return point;
}

export function ritualCenter(altar: Prop): Point {
  const offset = rotate({ x: 0, y: -1 }, Math.floor(altar.variation * 4));
  return { x: altar.x - offset.x, y: altar.y - offset.y };
}

export function ritualError(
  layout: Layout,
  props: readonly Prop[],
  reservations: readonly FeatureReservation[],
): string | undefined {
  const objects = props.filter((p) => p.kind.startsWith('ritual_'));
  const altar = objects.find((p) => p.kind === 'ritual_altar');
  if (!altar || objects.length !== arrangement.length)
    return 'A complete ritual site could not fit. Try another seed or fewer additions.';
  const center = ritualCenter(altar),
    area = areaAround(center, 2, 2);
  const room = layout.rooms.find((room) => contains(room, center));
  const turn = Math.floor(altar.variation * 4);
  const reserved = reservedTiles(layout);
  if (
    !room ||
    room.id === layout.entrance.roomId ||
    room.id === layout.objective.roomId ||
    !contains(room, area) ||
    !contains(room, { x: area.x + 4, y: area.y + 4 }) ||
    arrangement.some((spec) => {
      const offset = rotate(spec, turn);
      return !objects.some(
        (p) =>
          p.kind === spec.kind &&
          p.x === center.x + offset.x &&
          p.y === center.y + offset.y &&
          Math.floor(p.variation * 4) === turn,
      );
    }) ||
    objects.some((p) => reserved.has(indexOf(p.x, p.y)))
  )
    return 'The ritual site needs a clear 5 × 5 area away from doors, entrance, and objective.';
  if (
    reservations.some((reservation) => areasOverlap(area, reservation.area)) ||
    props.some((p) => !objects.includes(p) && propCells(p).some((cell) => areaContains(area, cell)))
  )
    return 'The ritual site needs separate clear space from other additions and objects.';
  return undefined;
}

export function placeRitual(
  layout: Layout,
  props: readonly Prop[],
  seed: string,
  density: Density,
  preset: DecorationPreset,
  revision: number,
  reservations: readonly FeatureReservation[],
): readonly Prop[] | undefined {
  const random = new Random(streamSeed(seed, 'dungeon-ritual', 'v1', preset, density, revision));
  const candidates: { center: Point; turn: number }[] = [];
  for (const room of layout.rooms) {
    if (room.id === layout.entrance.roomId || room.id === layout.objective.roomId) continue;
    for (let y = room.y + 2; y < room.y + room.height - 2; y++)
      for (let x = room.x + 2; x < room.x + room.width - 2; x++)
        for (let turn = 0; turn < 4; turn++) candidates.push({ center: { x, y }, turn });
  }
  shuffleInPlace(candidates, random);
  const protectedProps = new Set(reservations.flatMap((reservation) => reservation.props));
  for (const { center, turn } of candidates) {
    const room = layout.rooms.find((room) => contains(room, center));
    if (!room) continue;
    const area = areaAround(center, 2, 2);
    if (reservations.some((reservation) => areasOverlap(area, reservation.area))) continue;
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
    const objects: readonly Prop[] = arrangement.map((spec) => {
      const offset = rotate(spec, turn);
      return {
        ...spec,
        x: center.x + offset.x,
        y: center.y + offset.y,
        variation: turn / 4 + random.next() * 0.2,
      };
    });
    const placed = [...retained, ...objects];
    if (ritualError(layout, placed, reservations)) continue;
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
