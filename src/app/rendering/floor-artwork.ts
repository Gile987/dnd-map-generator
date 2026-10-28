import { isFloor } from '../engine/model';
import type { Layout, Point } from '../engine/model';

/** Solid dungeon walls stroke 0.32 tiles into floor; leave room for antialiasing. */
export function exposedTileBounds(layout: Pick<Layout, 'tiles'>, tile: Point) {
  const inset = 0.36;
  return {
    left: tile.x + (isFloor(layout, tile.x - 1, tile.y) ? 0 : inset),
    right: tile.x + 1 - (isFloor(layout, tile.x + 1, tile.y) ? 0 : inset),
    top: tile.y + (isFloor(layout, tile.x, tile.y - 1) ? 0 : inset),
    bottom: tile.y + 1 - (isFloor(layout, tile.x, tile.y + 1) ? 0 : inset),
  };
}
