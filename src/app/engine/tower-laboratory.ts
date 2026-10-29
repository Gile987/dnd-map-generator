import type { Point, Prop, Density } from './model';
import { isBlockingProp, DENSITY_BUDGETS } from './model';
import type { Tower } from './tower';

// The laboratory fills the central encounter area of one floor, the way a dungeon
// ritual site fills a chamber. Perimeter objects stay out in their ring.
const ARRANGEMENT = [
  { x: 7, y: 5, kind: 'cauldron' },
  { x: 5, y: 6, kind: 'desk' },
  { x: 9, y: 6, kind: 'bookshelf' },
  { x: 6, y: 8, kind: 'scroll_case' },
  { x: 8, y: 8, kind: 'ritual_candles' },
] as const satisfies readonly (Point & { readonly kind: Prop['kind'] })[];

// Tried in order so the placement is deterministic in the layout alone; saves,
// shuffles and imports agree without storing extra geometry.
const SHIFTS: readonly Point[] = [
  { x: 0, y: 0 },
  { x: 0, y: -2 },
  { x: 0, y: 2 },
  { x: -2, y: 0 },
  { x: 2, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: -2 },
  { x: 1, y: -2 },
  { x: -1, y: 2 },
  { x: 1, y: 2 },
  { x: -2, y: -1 },
  { x: 2, y: -1 },
  { x: -2, y: 1 },
  { x: 2, y: 1 },
];

/**
 * Places the fixed laboratory arrangement inside one floor's central area, or
 * returns undefined when stairs and floor edges leave no clear spot. The chosen
 * shift is the first clear one, so the result depends on the layout alone.
 */
export function towerLaboratoryProps(
  layout: Tower['layout'],
  floorNumber: number,
  reserved: (p: Point) => boolean,
): readonly Prop[] | undefined {
  const floor = layout.floors.find((f) => f.number === floorNumber);
  if (!floor) return undefined;
  for (let turn = 0; turn < 4; turn++)
    for (const shift of SHIFTS) {
      const placed = ARRANGEMENT.map((tile) => {
        let x = tile.x - 7,
          y = tile.y - 6;
        for (let i = 0; i < turn; i++) [x, y] = [-y, x];
        return { x: floor.x + 7 + x + shift.x, y: floor.y + 6 + y + shift.y, kind: tile.kind };
      });
      const clear = placed.every(
        (p) =>
          layout.tiles[p.y * layout.width + p.x] === true &&
          Math.hypot(p.x + 0.5 - (floor.x + 7), p.y + 0.5 - (floor.y + 6.5)) <= 5 &&
          !reserved(p),
      );
      if (clear) {
        const props = placed.map((p) => ({
          x: p.x,
          y: p.y,
          kind: p.kind,
          blocking: isBlockingProp(p.kind),
          variation: 0.25,
        }));
        if (laboratoryFloorUsable(layout, floorNumber, props)) return props;
      }
    }
  return undefined;
}

/** All floor cells and links remain reachable, with room for a small encounter. */
export function laboratoryFloorUsable(
  layout: Tower['layout'],
  floorNumber: number,
  props: readonly Pick<Prop, 'x' | 'y' | 'blocking'>[],
  density?: Density,
): boolean {
  const floor = layout.floors.find((f) => f.number === floorNumber);
  if (!floor) return false;
  const cells = new Set<number>();
  for (let y = floor.y; y < floor.y + floor.height; y++)
    for (let x = floor.x; x < floor.x + floor.width; x++)
      if (layout.tiles[y * layout.width + x]) cells.add(y * layout.width + x);
  const blocked = new Set(
    props
      .filter((p) => p.blocking && cells.has(p.y * layout.width + p.x))
      .map((p) => p.y * layout.width + p.x),
  );
  if (density !== undefined && blocked.size > Math.floor(cells.size * DENSITY_BUDGETS[density]))
    return false;
  const available = [...cells].filter((i) => !blocked.has(i)),
    first = available[0];
  if (first === undefined) return false;
  const reached = new Set([first]),
    queue = [first];
  for (let i = 0; i < queue.length; i++) {
    const tile = queue[i];
    if (tile === undefined) continue;
    for (const next of [tile - 1, tile + 1, tile - layout.width, tile + layout.width])
      if (cells.has(next) && !blocked.has(next) && !reached.has(next)) {
        reached.add(next);
        queue.push(next);
      }
  }
  if (reached.size !== available.length) return false;
  for (const link of layout.connections) {
    if (
      link.from === floorNumber &&
      !reached.has(link.departure.y * layout.width + link.departure.x)
    )
      return false;
    if (link.to === floorNumber && !reached.has(link.arrival.y * layout.width + link.arrival.x))
      return false;
  }
  return available.some((i) =>
    [i + 1, i + layout.width, i + layout.width + 1].every((n) => cells.has(n) && !blocked.has(n)),
  );
}
