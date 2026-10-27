import {
  ALL_DENSITIES,
  COURTYARD_PROP_KINDS,
  DENSITY_BUDGETS,
  HEIGHT,
  WIDTH,
  indexOf,
  isBlockingProp,
  isTilePosition,
} from './model';
import type { CourtyardLayout, CourtyardSettings, Point, RuinedCourtyard, TileArea } from './model';
import { gridDistances } from './grid-traversal';
import { isDetailRevision } from './decoration-revision';
import { propCells, propFootprintError } from './prop-footprint';

export function areaCells(area: TileArea): Point[] {
  const cells: Point[] = [];
  for (let y = area.y; y < area.y + area.height; y++)
    for (let x = area.x; x < area.x + area.width; x++) cells.push({ x, y });
  return cells;
}

export function fountainSite(layout: CourtyardLayout): Point {
  const b = layout.bounds;
  return { x: b.x + b.width - 9, y: b.y + Math.floor(b.height / 2) - 1 };
}

// Wide approaches and a six-by-six gathering space are never decorated.
export function courtyardProtectedCells(layout: CourtyardLayout): Set<number> {
  const result = new Set(areaCells(layout.encounter).map((p) => indexOf(p.x, p.y)));
  const b = layout.bounds;
  layout.approaches.forEach((p, side) => {
    const area =
      side === 0
        ? { x: p.x - 1, y: 0, width: 3, height: b.y + 5 }
        : side === 1
          ? { x: b.x + b.width - 5, y: p.y - 1, width: WIDTH - (b.x + b.width - 5), height: 3 }
          : side === 2
            ? { x: p.x - 1, y: b.y + b.height - 5, width: 3, height: HEIGHT - (b.y + b.height - 5) }
            : { x: 0, y: p.y - 1, width: b.x + 5, height: 3 };
    for (const cell of areaCells(area)) result.add(indexOf(cell.x, cell.y));
  });
  return result;
}

function validArea(area: TileArea): boolean {
  return (
    isTilePosition(area.x, area.y) &&
    Number.isInteger(area.width) &&
    Number.isInteger(area.height) &&
    area.width > 0 &&
    area.height > 0 &&
    area.x + area.width <= WIDTH &&
    area.y + area.height <= HEIGHT
  );
}

export function validateCourtyardSettings(settings: CourtyardSettings): string | undefined {
  if (!settings.seed.trim() || settings.seed.trim().length > 64)
    return 'Enter a seed between 1 and 64 characters.';
  if (!ALL_DENSITIES.includes(settings.density)) return 'Choose a valid decoration density.';
  if (typeof settings.fountain !== 'boolean') return 'Choose whether to add a dry fountain.';
  return undefined;
}

export function validateCourtyardLayout(layout: CourtyardLayout): string | undefined {
  const b = layout.bounds;
  const e = layout.encounter;
  if (
    !validArea(b) ||
    b.x < 3 ||
    b.y < 3 ||
    b.x + b.width > WIDTH - 3 ||
    b.y + b.height > HEIGHT - 3 ||
    b.width < 24 ||
    b.height < 18
  )
    return 'The courtyard needs an open approach around its perimeter.';
  if (
    !validArea(e) ||
    e.width !== 6 ||
    e.height !== 6 ||
    e.x <= b.x + 1 ||
    e.y <= b.y + 1 ||
    e.x + e.width >= b.x + b.width - 1 ||
    e.y + e.height >= b.y + b.height - 1
  )
    return 'The courtyard needs a clear six-by-six encounter space.';
  if (layout.tiles.length !== WIDTH * HEIGHT || !layout.tiles.every((t) => typeof t === 'boolean'))
    return 'Invalid courtyard tile grid.';
  if (layout.approaches.length !== 4) return 'The courtyard needs four broad openings.';
  for (const [side, p] of layout.approaches.entries()) {
    if (!isTilePosition(p.x, p.y)) return 'Invalid courtyard approach.';
    if (
      (side === 0 && p.y !== b.y) ||
      (side === 2 && p.y !== b.y + b.height - 1) ||
      (side === 1 && p.x !== b.x + b.width - 1) ||
      (side === 3 && p.x !== b.x) ||
      ((side === 0 || side === 2) && (p.x < b.x + 3 || p.x > b.x + b.width - 4)) ||
      ((side === 1 || side === 3) && (p.y < b.y + 3 || p.y > b.y + b.height - 4))
    )
      return 'An approach must pass through its courtyard wall.';
  }
  const protectedCells = courtyardProtectedCells(layout);
  if ([...protectedCells].some((t) => !layout.tiles[t]))
    return 'Standing walls obstruct a courtyard approach or encounter space.';
  let walls = 0;
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      if (layout.tiles[indexOf(x, y)]) continue;
      walls++;
      if (x < b.x || y < b.y || x >= b.x + b.width || y >= b.y + b.height)
        return 'Standing walls must stay within the ruin.';
    }
  if (walls < 40 || walls > 160) return 'The ruin needs broken perimeter walls and open ground.';
  const open = layout.tiles.filter(Boolean).length;
  if (gridDistances(layout.tiles, { x: 0, y: 0 }).size !== open)
    return 'Courtyard walls disconnect open ground.';
  return undefined;
}

export function validateCourtyard(map: RuinedCourtyard): string | undefined {
  const settingsError = validateCourtyardSettings({
    seed: map.seed,
    density: map.decoration.density,
    fountain: map.decoration.fountain,
  });
  if (settingsError) return settingsError;
  const layoutError = validateCourtyardLayout(map.layout);
  if (layoutError) return layoutError;
  if (!isDetailRevision(map.decoration.revision))
    return 'The detail revision must be a nonnegative safe integer.';
  const protectedCells = courtyardProtectedCells(map.layout);
  const blocked = new Set<number>();
  const occupied = new Set<number>();
  const fountains = map.decoration.props.filter((p) => p.kind === 'dry_fountain');
  if (fountains.length !== (map.decoration.fountain ? 1 : 0))
    return 'The selected dry fountain must be present exactly once.';
  const site = fountainSite(map.layout);
  const fountainReserve = new Set(
    areaCells({ x: site.x - 1, y: site.y - 1, width: 5, height: 5 }).map((p) => indexOf(p.x, p.y)),
  );
  if (map.decoration.fountain && [...fountainReserve].some((tile) => !map.layout.tiles[tile]))
    return 'The fountain needs clear ground and circulation on every side.';
  for (const prop of map.decoration.props) {
    const footprintError = propFootprintError(prop);
    if (footprintError) return footprintError;
    if (!COURTYARD_PROP_KINDS.some((kind) => kind === prop.kind))
      return 'A prop is not supported by courtyard maps.';
    if (prop.blocking !== isBlockingProp(prop.kind))
      return 'A prop has an invalid movement classification.';
    if (
      prop.kind === 'dry_fountain' &&
      (prop.x !== site.x || prop.y !== site.y || prop.rotation !== 0)
    )
      return 'The fountain must occupy its reserved three-by-three site.';
    for (const cell of propCells(prop)) {
      const tile = indexOf(cell.x, cell.y);
      if (
        !isTilePosition(cell.x, cell.y) ||
        !map.layout.tiles[tile] ||
        protectedCells.has(tile) ||
        occupied.has(tile)
      )
        return 'Courtyard objects need clear ground outside approaches and the encounter space.';
      if (map.decoration.fountain && prop.kind !== 'dry_fountain' && fountainReserve.has(tile))
        return 'The fountain needs a clear tile on every side.';
      occupied.add(tile);
      if (prop.blocking) blocked.add(tile);
    }
  }
  if (
    blocked.size >
    Math.floor(map.layout.tiles.filter(Boolean).length * DENSITY_BUDGETS[map.decoration.density])
  )
    return 'Courtyard decoration exceeds its blocking budget.';
  if (
    gridDistances(map.layout.tiles, { x: 0, y: 0 }, blocked).size !==
    map.layout.tiles.filter(Boolean).length - blocked.size
  )
    return 'Courtyard decoration disconnects open ground.';
  return undefined;
}
