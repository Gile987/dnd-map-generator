import { fallenTreeSite } from './forest-fallen-tree';
import { areaContains } from './feature-reservation';
import { propFootprintError, propCells } from './prop-footprint';
import {
  ALL_DENSITIES,
  FALLEN_TREE_PROP_KINDS,
  ALL_FOREST_CHARACTERS,
  ALL_FOREST_SCENES,
  ALL_FOREST_LANDMARKS,
  DENSITY_BUDGETS,
  HEIGHT,
  WIDTH,
  indexOf,
  isBlockingProp,
  isForestPropKind,
  isTilePosition,
  isWalkable,
} from './model';
import type { ForestClearing, ForestLayout, ForestSettings, Point } from './model';
import { isConnected, forestDistances } from './forest-layout';
import type { Edge } from './forest-layout';
import { isDetailRevision } from './decoration-revision';
import { FOREST_LANDMARK_RULES } from './forest-landmark';
import { CAMP_PROP_KINDS, campReservations } from './forest-camp';

function edgeOf(point: Point): Edge | undefined {
  if (!isTilePosition(point.x, point.y)) return undefined;
  if (point.x === 0) return 'west';
  if (point.x === WIDTH - 1) return 'east';
  if (point.y === 0) return 'north';
  if (point.y === HEIGHT - 1) return 'south';
  return undefined;
}

function forestLayoutError(layout: ForestLayout): string | undefined {
  if (layout.tiles.length !== WIDTH * HEIGHT) return 'The tile field has incorrect dimensions.';
  if (!isConnected(layout.tiles)) return 'The forest floor is not connected.';
  if (layout.tiles.filter(Boolean).length < 200)
    return 'The clearing needs at least 200 walkable tiles.';
  const startEdge = edgeOf(layout.pathStart);
  const endEdge = edgeOf(layout.pathEnd);
  if (!startEdge || !endEdge || startEdge === endEdge)
    return 'The forest path must connect two different map edges.';
  if (!isWalkable(layout, layout.pathStart.x, layout.pathStart.y))
    return 'The path start is not on walkable ground.';
  if (!isWalkable(layout, layout.pathEnd.x, layout.pathEnd.y))
    return 'The path end is not on walkable ground.';
  if (!routeIsValid(layout)) return 'The forest path is missing or does not connect the clearing.';
  return undefined;
}

export function validateForestLayout(layout: ForestLayout): boolean {
  return forestLayoutError(layout) === undefined;
}

function routeIsValid(layout: ForestLayout): boolean {
  const start = indexOf(layout.pathStart.x, layout.pathStart.y);
  const end = indexOf(layout.pathEnd.x, layout.pathEnd.y);
  if (layout.route.length === 0 || layout.route.length > WIDTH * HEIGHT) return false;
  const routeSet = new Set(layout.route);
  if (routeSet.size !== layout.route.length) return false;
  if (
    layout.route.some(
      (tile) =>
        !Number.isInteger(tile) || tile < 0 || tile >= WIDTH * HEIGHT || !layout.tiles[tile],
    )
  )
    return false;
  if (!routeSet.has(start) || !routeSet.has(end)) return false;
  const blocked = new Set<number>();
  for (let tile = 0; tile < layout.tiles.length; tile++) {
    if (layout.tiles[tile] && !routeSet.has(tile)) blocked.add(tile);
  }
  const reached = forestDistances(layout.tiles, layout.pathStart, blocked);
  return reached.has(end) && reached.size === routeSet.size;
}

export function validateForest(map: ForestClearing): string | undefined {
  if (map.decoration.fallenTree !== undefined && map.decoration.fallenTree !== true)
    return 'Invalid fallen ancient tree selection.';
  if (map.decoration.forestSurface !== undefined && map.decoration.forestSurface !== 1)
    return 'Choose supported forest surface artwork.';
  const layoutError = forestLayoutError(map.layout);
  if (layoutError) return layoutError;
  if (!ALL_FOREST_SCENES.includes(map.decoration.scene ?? 'None'))
    return 'Choose a valid forest scene.';
  if (!ALL_FOREST_LANDMARKS.includes(map.decoration.landmark ?? 'None'))
    return 'Choose a valid forest landmark.';
  const landmark = map.decoration.landmark ?? 'None';
  if (landmark !== 'None') {
    const error = FOREST_LANDMARK_RULES[landmark].validate(
      map.layout,
      map.decoration.props,
      campReservations(map.decoration.props),
    );
    if (error) return error;
  } else if (map.decoration.props.some((p) => p.kind === 'standing_stone'))
    return 'Standing stones require a suggested landmark.';
  const camp = map.decoration.props.filter((prop) => CAMP_PROP_KINDS.includes(prop.kind));
  if (map.decoration.scene === 'Abandoned camp') {
    if (
      camp.length !== 6 ||
      camp.filter((p) => p.kind === 'tent').length !== 2 ||
      camp.filter((p) => p.kind === 'bedroll').length !== 2 ||
      camp.filter((p) => p.kind === 'fire_ring').length !== 1 ||
      camp.filter((p) => p.kind === 'supply_bundle').length !== 1
    )
      return 'A complete camp could not fit beside the path. Try another seed.';
    for (const prop of camp) {
      if (
        !isWalkable(map.layout, prop.x, prop.y) ||
        map.layout.route.includes(indexOf(prop.x, prop.y)) ||
        map.decoration.props.some(
          (other) => other !== prop && other.x === prop.x && other.y === prop.y,
        )
      )
        return 'Camp objects need clear ground beside the path.';
    }
  } else if (camp.length) return 'Camp objects require an abandoned camp scene.';
  if (!isDetailRevision(map.decoration.revision))
    return 'The detail revision must be a nonnegative safe integer.';
  const treeSite = map.decoration.fallenTree
    ? fallenTreeSite(
        map.layout,
        map.decoration.props,
        map.seed,
        map.decoration.density,
        map.decoration.revision,
      )
    : undefined;
  if (map.decoration.fallenTree && !treeSite)
    return 'The fallen ancient tree could not fit beside the path and other additions.';
  const expectedTree = new Map(treeSite?.props.map((p) => [p.kind, p]) ?? []),
    seenTree = new Set<string>();
  const route = new Set(map.layout.route);
  const blocked = new Set<number>();
  for (const prop of map.decoration.props) {
    const footprintError = propFootprintError(prop);
    if (footprintError) return footprintError;
    if (!isTilePosition(prop.x, prop.y)) return 'A prop is outside the tile grid.';
    if (!isForestPropKind(prop.kind)) return 'A prop is not supported by forest maps.';
    if (prop.kind === 'tree' && isWalkable(map.layout, prop.x, prop.y))
      return 'A tree is on walkable ground.';
    if (prop.blocking !== isBlockingProp(prop.kind))
      return 'A prop has an invalid movement classification.';
    const treeProp = FALLEN_TREE_PROP_KINDS.some((kind) => kind === prop.kind);
    if (treeProp) {
      const expected = expectedTree.get(prop.kind);
      if (
        !expected ||
        seenTree.has(prop.kind) ||
        prop.x !== expected.x ||
        prop.y !== expected.y ||
        prop.blocking !== expected.blocking ||
        prop.variation !== expected.variation ||
        prop.rotation !== expected.rotation ||
        prop.footprint?.width !== expected.footprint?.width ||
        prop.footprint?.height !== expected.footprint?.height
      )
        return 'The fallen ancient tree must retain its complete canonical arrangement.';
      seenTree.add(prop.kind);
    } else if (treeSite && areaContains(treeSite.area, prop))
      return 'The fallen ancient tree needs separate space from ordinary decoration.';
    if (!prop.blocking) continue;

    for (const cell of propCells(prop)) {
      if (!isTilePosition(cell.x, cell.y)) return 'A prop footprint leaves the tile grid.';
      const tile = indexOf(cell.x, cell.y);
      if (route.has(tile)) return 'A blocking prop overlaps the forest path.';
      if (blocked.has(tile)) return 'A blocking prop overlaps another prop.';
      if (!isWalkable(map.layout, cell.x, cell.y))
        return 'A blocking prop is outside walkable ground.';
      blocked.add(tile);
    }
  }

  if (seenTree.size !== expectedTree.size)
    return 'The selected fallen ancient tree must be complete.';
  if (
    blocked.size >
    Math.floor(map.layout.tiles.filter(Boolean).length * DENSITY_BUDGETS[map.decoration.density])
  )
    return 'Forest decoration exceeds its blocking budget.';
  const reachable = forestDistances(map.layout.tiles, map.layout.pathStart, blocked);
  if (!reachable.has(indexOf(map.layout.pathEnd.x, map.layout.pathEnd.y)))
    return 'Decoration blocks the path through the clearing.';
  if (reachable.size !== map.layout.tiles.filter(Boolean).length - blocked.size)
    return 'Decoration disconnects walkable ground.';

  return undefined;
}

export function validateForestSettings(settings: ForestSettings): string | undefined {
  if (settings.fallenTree !== undefined && typeof settings.fallenTree !== 'boolean')
    return 'Choose whether to add a fallen ancient tree.';
  if (!settings.seed.trim() || settings.seed.trim().length > 64)
    return 'Enter a seed between 1 and 64 characters.';
  if (!ALL_FOREST_LANDMARKS.includes(settings.landmark ?? 'None'))
    return 'Choose a valid forest landmark.';
  if (!ALL_DENSITIES.includes(settings.density)) return 'Choose a valid decoration density.';
  if (!ALL_FOREST_CHARACTERS.includes(settings.character))
    return 'Choose a valid forest character.';
  if (!ALL_FOREST_SCENES.includes(settings.scene ?? 'None')) return 'Choose a valid forest scene.';
  return undefined;
}
