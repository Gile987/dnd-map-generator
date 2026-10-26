import type { Point, Prop, PropKind, QuarterTurn } from './model';
import type { ReservedArea } from './feature-reservation';

// Local, unrotated dimensions. Stored dimensions must match this definition.
export const MULTI_TILE_PROPS = {
  dining_table: { width: 2, height: 1 },
} as const;
export const QUARTER_TURNS: readonly QuarterTurn[] = [0, 1, 2, 3];

function isMultiTileKind(kind: PropKind): kind is keyof typeof MULTI_TILE_PROPS {
  return Object.hasOwn(MULTI_TILE_PROPS, kind);
}

export function propFootprintError(prop: Prop): string | undefined {
  if (!isMultiTileKind(prop.kind))
    return prop.footprint !== undefined || prop.rotation !== undefined
      ? 'This prop does not support an explicit footprint or rotation.'
      : undefined;
  const expected = MULTI_TILE_PROPS[prop.kind];
  if (
    prop.footprint?.width !== expected.width ||
    prop.footprint?.height !== expected.height ||
    prop.rotation === undefined ||
    !QUARTER_TURNS.includes(prop.rotation)
  )
    return 'A multi-tile prop needs its defined footprint and a quarter-turn rotation.';
  return undefined;
}

// x/y always anchor the top-left occupied tile, including after rotation.
export function propBounds(prop: Prop): ReservedArea {
  const footprint = prop.footprint ?? { width: 1, height: 1 };
  const sideways = (prop.rotation ?? 0) % 2 === 1;
  return {
    x: prop.x,
    y: prop.y,
    width: sideways ? footprint.height : footprint.width,
    height: sideways ? footprint.width : footprint.height,
  };
}

export function propCells(prop: Prop): readonly Point[] {
  const bounds = propBounds(prop);
  const cells: Point[] = [];
  for (let y = bounds.y; y < bounds.y + bounds.height; y++)
    for (let x = bounds.x; x < bounds.x + bounds.width; x++) cells.push({ x, y });
  return cells;
}
