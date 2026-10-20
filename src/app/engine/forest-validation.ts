import { ALL_FOREST_CHARACTERS, HEIGHT, WIDTH, indexOf, isBlockingProp, isWalkable } from './model';
import type { ForestClearing, ForestLayout, ForestSettings } from './model';
import { isConnected, forestDistances } from './forest-layout';

export function validateForestLayout(layout: ForestLayout): boolean {
  if (layout.tiles.length !== WIDTH * HEIGHT) return false;
  if (!isConnected(layout.tiles)) return false;
  if (!isWalkable(layout, layout.pathStart.x, layout.pathStart.y)) return false;
  if (!isWalkable(layout, layout.pathEnd.x, layout.pathEnd.y)) return false;
  const floorCount = layout.tiles.filter(Boolean).length;
  if (floorCount < 200) return false;
  return true;
}

function routeIsValid(layout: ForestLayout): boolean {
  const start = indexOf(layout.pathStart.x, layout.pathStart.y);
  const end = indexOf(layout.pathEnd.x, layout.pathEnd.y);
  if (layout.route.length === 0) return false;
  const routeSet = new Set(layout.route);
  if (layout.route.some((tile) => !layout.tiles[tile])) return false;
  if (!routeSet.has(start) || !routeSet.has(end)) return false;
  const blocked = new Set<number>();
  for (let tile = 0; tile < layout.tiles.length; tile++) {
    if (layout.tiles[tile] && !routeSet.has(tile)) blocked.add(tile);
  }
  return forestDistances(layout.tiles, layout.pathStart, blocked).has(end);
}

export function validateForest(map: ForestClearing): string | undefined {
  if (map.layout.tiles.length !== WIDTH * HEIGHT) return 'The tile field has incorrect dimensions.';
  if (!isConnected(map.layout.tiles)) return 'The forest floor is not connected.';
  if (!isWalkable(map.layout, map.layout.pathStart.x, map.layout.pathStart.y))
    return 'The path start is not on walkable ground.';
  if (!isWalkable(map.layout, map.layout.pathEnd.x, map.layout.pathEnd.y))
    return 'The path end is not on walkable ground.';
  if (!routeIsValid(map.layout))
    return 'The forest path is missing or does not connect the clearing.';

  const blocked = new Set<number>();
  for (const prop of map.decoration.props) {
    if (prop.x < 0 || prop.y < 0 || prop.x >= WIDTH || prop.y >= HEIGHT)
      return 'A prop is outside the map.';
    if (prop.blocking !== isBlockingProp(prop.kind))
      return 'A prop has an invalid movement classification.';
    if (!prop.blocking) continue;
    const tile = indexOf(prop.x, prop.y);
    if (blocked.has(tile)) return 'A blocking prop overlaps another prop.';
    if (!isWalkable(map.layout, prop.x, prop.y))
      return 'A blocking prop is outside walkable ground.';
    blocked.add(tile);
  }

  const reachable = forestDistances(map.layout.tiles, map.layout.pathStart, blocked);
  if (!reachable.has(indexOf(map.layout.pathEnd.x, map.layout.pathEnd.y)))
    return 'Decoration blocks the path through the clearing.';
  if (reachable.size !== map.layout.tiles.filter(Boolean).length - blocked.size)
    return 'Decoration disconnects walkable ground.';

  return undefined;
}

export function validateForestSettings(settings: ForestSettings): string | undefined {
  if (!settings.seed.trim() || settings.seed.trim().length > 64)
    return 'Enter a seed between 1 and 64 characters.';
  if (!['Sparse', 'Balanced', 'Cluttered'].includes(settings.density))
    return 'Choose a valid decoration density.';
  if (!ALL_FOREST_CHARACTERS.includes(settings.character))
    return 'Choose a valid forest character.';
  return undefined;
}
