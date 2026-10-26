import { contains, DENSITY_BUDGETS, indexOf } from './model';
import type { Density, DecorationPreset, Layout, Prop } from './model';
import { areaAround, areasOverlap } from './feature-reservation';
import type { FeatureReservation, ReservedArea } from './feature-reservation';
import { propBounds, propCells, MULTI_TILE_PROPS, QUARTER_TURNS } from './prop-footprint';
import { reservedTiles, isTraversable } from './dungeon-space';
import { Random, shuffleInPlace, streamSeed } from './random';

export function furnitureArea(prop: Prop): ReservedArea {
  const bounds = propBounds(prop);
  return { x: bounds.x - 1, y: bounds.y - 1, width: bounds.width + 2, height: bounds.height + 2 };
}

export function furnitureError(
  layout: Layout,
  props: readonly Prop[],
  reservations: readonly FeatureReservation[],
): string | undefined {
  const tables = props.filter((p) => p.kind === 'dining_table');
  const table = tables[0];
  if (!table || tables.length !== 1)
    return 'A dining table could not fit. Try another seed, density, or fewer features.';
  const room = layout.rooms.find((room) => contains(room, table));
  const area = furnitureArea(table);
  if (
    !room ||
    !contains(room, area) ||
    !contains(room, { x: area.x + area.width - 1, y: area.y + area.height - 1 })
  )
    return 'The entire table needs a room with one clear tile of circulation on every side.';
  const reserved = reservedTiles(layout);
  if (
    propCells(table).some((p) => reserved.has(indexOf(p.x, p.y))) ||
    [layout.entrance, layout.objective].some((point) =>
      areasOverlap(area, areaAround(point, 1, 1)),
    ) ||
    reservations.some((reservation) => areasOverlap(area, reservation.area)) ||
    props.some((p) => p !== table && areasOverlap(area, propBounds(p)))
  )
    return 'Furniture needs clear space away from doors, other objects, and reserved features.';
  return undefined;
}

export function placeDiningTable(
  layout: Layout,
  props: readonly Prop[],
  seed: string,
  density: Density,
  preset: DecorationPreset,
  revision: number,
  reservations: readonly FeatureReservation[],
): readonly Prop[] | undefined {
  const random = new Random(
    streamSeed(seed, 'dungeon-furniture', 'dining-table', 'v1', preset, density, revision),
  );
  const candidates: Prop[] = [];
  for (const room of layout.rooms)
    for (let y = room.y + 1; y < room.y + room.height - 1; y++)
      for (let x = room.x + 1; x < room.x + room.width - 1; x++)
        for (const rotation of QUARTER_TURNS)
          candidates.push({
            x,
            y,
            kind: 'dining_table',
            blocking: true,
            footprint: MULTI_TILE_PROPS.dining_table,
            rotation,
            variation: 0,
          });
  shuffleInPlace(candidates, random);
  const protectedProps = new Set(reservations.flatMap((reservation) => reservation.props));
  for (const candidate of candidates) {
    const room = layout.rooms.find((room) => contains(room, candidate));
    if (!room) continue;
    const area = furnitureArea(candidate);
    const budget = Math.floor(room.width * room.height * DENSITY_BUDGETS[density]);
    let blockers =
      propCells(candidate).length +
      props
        .filter((p) => p.blocking && contains(room, p) && protectedProps.has(p))
        .flatMap(propCells).length;
    if (blockers > budget) continue;
    const retained = props.filter((p) => {
      if (protectedProps.has(p)) return true;
      if (areasOverlap(area, propBounds(p))) return false;
      if (!contains(room, p) || !p.blocking) return true;
      blockers += propCells(p).length;
      return blockers <= budget;
    });
    const table = { ...candidate, variation: random.next() };
    const placed = [...retained, table];
    if (furnitureError(layout, placed, reservations)) continue;
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
