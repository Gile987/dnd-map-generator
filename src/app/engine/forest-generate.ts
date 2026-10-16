import { GENERATOR_VERSION, HEIGHT, WIDTH, indexOf, isBlockingProp, isWalkable } from './model';
import type {
  Density,
  ForestClearing,
  ForestDecoration,
  ForestGenerationResult,
  ForestLayout,
  ForestSettings,
  Point,
  Prop,
} from './model';
import { Random, streamSeed } from './random';

export interface ForestLimits {
  readonly retries: number;
}

const DEFAULT_LIMITS: ForestLimits = { retries: 16 };

type Edge = 'north' | 'south' | 'east' | 'west';

const NEIGHBORS_4: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const NEIGHBORS_8: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

interface ClearingCircle {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

function createClearing(random: Random): { tiles: boolean[]; center: Point } {
  const cx = random.int(13, 27);
  const cy = random.int(9, 21);
  const baseR = random.int(7, 10);

  const circles: ClearingCircle[] = [{ cx, cy, r: baseR }];
  const offsets = [
    { dx: random.int(-3, 3), dy: random.int(-3, 3) },
    { dx: random.int(-4, 4), dy: random.int(-2, 2) },
    { dx: random.int(-2, 2), dy: random.int(-4, 4) },
  ];
  for (const off of offsets) {
    const ncx = Math.max(6, Math.min(WIDTH - 7, cx + off.dx));
    const ncy = Math.max(5, Math.min(HEIGHT - 6, cy + off.dy));
    circles.push({ cx: ncx, cy: ncy, r: baseR + random.int(-2, 1) });
  }

  const tiles = Array<boolean>(WIDTH * HEIGHT).fill(false);
  for (let y = 1; y < HEIGHT - 1; y++) {
    for (let x = 1; x < WIDTH - 1; x++) {
      for (const circle of circles) {
        const dx = x - circle.cx;
        const dy = y - circle.cy;
        if (dx * dx + dy * dy <= circle.r * circle.r) {
          tiles[indexOf(x, y)] = true;
          break;
        }
      }
    }
  }
  return { tiles, center: { x: cx, y: cy } };
}

function pointOnEdge(edge: Edge, random: Random): Point {
  switch (edge) {
    case 'north':
      return { x: random.int(4, WIDTH - 5), y: 0 };
    case 'south':
      return { x: random.int(4, WIDTH - 5), y: HEIGHT - 1 };
    case 'east':
      return { x: WIDTH - 1, y: random.int(4, HEIGHT - 5) };
    case 'west':
      return { x: 0, y: random.int(4, HEIGHT - 5) };
  }
}

function oppositeEdge(edge: Edge): Edge {
  switch (edge) {
    case 'north':
      return 'south';
    case 'south':
      return 'north';
    case 'east':
      return 'west';
    case 'west':
      return 'east';
  }
}

function carve(
  tiles: boolean[],
  from: Point,
  to: Point,
  bend: 'horizontal-first' | 'vertical-first',
): number[] {
  const route: number[] = [];
  const step = (x: number, y: number): void => {
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        if (tx >= 0 && tx < WIDTH && ty >= 0 && ty < HEIGHT) {
          const idx = indexOf(tx, ty);
          tiles[idx] = true;
          route.push(idx);
        }
      }
    }
  };
  const corner = bend === 'horizontal-first' ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
  let { x, y } = from;
  step(x, y);
  while (x !== corner.x || y !== corner.y) {
    x += Math.sign(corner.x - x);
    y += Math.sign(corner.y - y);
    step(x, y);
  }
  while (x !== to.x || y !== to.y) {
    x += Math.sign(to.x - x);
    y += Math.sign(to.y - y);
    step(x, y);
  }
  return route;
}

function carvePath(
  tiles: boolean[],
  pathStart: Point,
  pathEnd: Point,
  center: Point,
  random: Random,
): number[] {
  const bend1 = random.next() < 0.5 ? 'horizontal-first' : 'vertical-first';
  const bend2 = random.next() < 0.5 ? 'horizontal-first' : 'vertical-first';
  const route1 = carve(tiles, pathStart, center, bend1);
  const route2 = carve(tiles, center, pathEnd, bend2);
  return [...new Set([...route1, ...route2])];
}

function forestDistances(
  tiles: readonly boolean[],
  start: Point,
  blocked: ReadonlySet<number> = new Set(),
): Map<number, number> {
  const first = indexOf(start.x, start.y);
  const result = new Map<number, number>();
  if (!tiles[first] || blocked.has(first)) return result;
  result.set(first, 0);
  const queue = [first];
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (current === undefined) continue;
    const x = current % WIDTH;
    const y = Math.floor(current / WIDTH);
    for (const [nx, ny] of NEIGHBORS_4) {
      const nnx = nx + x;
      const nny = ny + y;
      if (nnx < 0 || nny < 0 || nnx >= WIDTH || nny >= HEIGHT) continue;
      const next = indexOf(nnx, nny);
      if (tiles[next] && !blocked.has(next) && !result.has(next)) {
        result.set(next, (result.get(current) ?? 0) + 1);
        queue.push(next);
      }
    }
  }
  return result;
}

function isConnected(tiles: readonly boolean[]): boolean {
  let start = -1;
  let floorCount = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i]) {
      floorCount++;
      if (start === -1) start = i;
    }
  }
  if (start === -1 || floorCount === 0) return false;
  const sx = start % WIDTH;
  const sy = Math.floor(start / WIDTH);
  const reached = forestDistances(tiles, { x: sx, y: sy });
  return reached.size === floorCount;
}

function validateForestLayout(layout: ForestLayout): boolean {
  if (layout.tiles.length !== WIDTH * HEIGHT) return false;
  if (!isConnected(layout.tiles)) return false;
  if (!isWalkable(layout, layout.pathStart.x, layout.pathStart.y)) return false;
  if (!isWalkable(layout, layout.pathEnd.x, layout.pathEnd.y)) return false;
  const floorCount = layout.tiles.filter(Boolean).length;
  if (floorCount < 200) return false;
  return true;
}

const budgets: Readonly<Record<Density, number>> = { Sparse: 0.05, Balanced: 0.1, Cluttered: 0.15 };

function decorateForest(
  layout: ForestLayout,
  seed: string,
  density: Density,
  revision: number,
): ForestDecoration {
  const random = new Random(streamSeed(seed, 'forest-decoration', density, revision));
  const props: Prop[] = [];
  const blocked = new Set<number>();
  const routeSet = new Set(layout.route);
  const floorCount = layout.tiles.filter(Boolean).length;
  const maxBlocking = Math.floor(floorCount * budgets[density]);

  placeTrees(layout, random, props);
  placeClearingProps(layout, random, blocked, routeSet, maxBlocking, props);
  placeForestFloorProps(layout, random, density, blocked, routeSet, maxBlocking, props);

  const reachable = forestDistances(layout.tiles, layout.pathStart, blocked);
  if (!reachable.has(indexOf(layout.pathEnd.x, layout.pathEnd.y))) {
    return { props: props.filter((p) => !p.blocking), density, revision };
  }

  return { props, density, revision };
}

function placeTrees(layout: ForestLayout, random: Random, props: Prop[]): void {
  const candidates: { x: number; y: number }[] = [];
  for (let y = 1; y < HEIGHT - 1; y++) {
    for (let x = 1; x < WIDTH - 1; x++) {
      if (isWalkable(layout, x, y)) continue;
      let nearClearing = false;
      for (const [dx, dy] of NEIGHBORS_8) {
        if (isWalkable(layout, x + dx, y + dy)) {
          nearClearing = true;
          break;
        }
      }
      if (nearClearing) {
        candidates.push({ x, y });
      }
    }
  }

  for (let i = candidates.length - 1; i > 0; i--) {
    const swap = random.int(0, i);
    const a = candidates[i];
    const b = candidates[swap];
    if (a && b) {
      candidates[i] = b;
      candidates[swap] = a;
    }
  }

  const treeCount = Math.min(candidates.length, 50 + random.int(0, 20));
  const step = Math.max(1, Math.floor(candidates.length / treeCount));
  for (
    let i = 0;
    i < candidates.length && props.filter((p) => p.kind === 'tree').length < treeCount;
    i += step
  ) {
    const c = candidates[i];
    if (!c) continue;
    let tooClose = false;
    for (const prop of props) {
      if (prop.kind === 'tree') {
        const dx = prop.x - c.x;
        const dy = prop.y - c.y;
        if (dx * dx + dy * dy < 4) {
          tooClose = true;
          break;
        }
      }
    }
    if (!tooClose) {
      props.push({ x: c.x, y: c.y, kind: 'tree', blocking: false, variation: random.next() });
    }
  }

  for (let y = 1; y < HEIGHT - 1; y++) {
    for (let x = 1; x < WIDTH - 1; x++) {
      if (isWalkable(layout, x, y)) continue;
      if (props.some((p) => p.kind === 'tree' && p.x === x && p.y === y)) continue;
      let nearWalkable = false;
      for (const [dx, dy] of NEIGHBORS_4) {
        if (isWalkable(layout, x + dx, y + dy)) {
          nearWalkable = true;
          break;
        }
      }
      if (!nearWalkable && random.next() < 0.35) {
        let tooClose = false;
        for (const prop of props) {
          if (prop.kind === 'tree') {
            const dx = prop.x - x;
            const dy = prop.y - y;
            if (dx * dx + dy * dy < 6) {
              tooClose = true;
              break;
            }
          }
        }
        if (!tooClose) {
          props.push({ x, y, kind: 'tree', blocking: false, variation: random.next() });
        }
      }
    }
  }
}

function placeClearingProps(
  layout: ForestLayout,
  random: Random,
  blocked: Set<number>,
  routeSet: ReadonlySet<number>,
  maxBlocking: number,
  props: Prop[],
): void {
  const edgeCandidates: { x: number; y: number }[] = [];
  for (let y = 2; y < HEIGHT - 2; y++) {
    for (let x = 2; x < WIDTH - 2; x++) {
      if (!isWalkable(layout, x, y)) continue;
      if (routeSet.has(indexOf(x, y))) continue;
      let nearForest = false;
      for (const [dx, dy] of NEIGHBORS_4) {
        if (!isWalkable(layout, x + dx, y + dy)) {
          nearForest = true;
          break;
        }
      }
      if (nearForest) edgeCandidates.push({ x, y });
    }
  }

  for (let i = edgeCandidates.length - 1; i > 0; i--) {
    const swap = random.int(0, i);
    const a = edgeCandidates[i];
    const b = edgeCandidates[swap];
    if (a && b) {
      edgeCandidates[i] = b;
      edgeCandidates[swap] = a;
    }
  }

  const interiorCandidates: { x: number; y: number }[] = [];
  for (let y = 2; y < HEIGHT - 2; y++) {
    for (let x = 2; x < WIDTH - 2; x++) {
      if (!isWalkable(layout, x, y)) continue;
      if (routeSet.has(indexOf(x, y))) continue;
      let nearForest = false;
      for (const [dx, dy] of NEIGHBORS_4) {
        if (!isWalkable(layout, x + dx, y + dy)) {
          nearForest = true;
          break;
        }
      }
      if (!nearForest) interiorCandidates.push({ x, y });
    }
  }
  for (let i = interiorCandidates.length - 1; i > 0; i--) {
    const swap = random.int(0, i);
    const a = interiorCandidates[i];
    const b = interiorCandidates[swap];
    if (a && b) {
      interiorCandidates[i] = b;
      interiorCandidates[swap] = a;
    }
  }

  for (const point of edgeCandidates) {
    if (blocked.size >= maxBlocking) break;
    const tile = indexOf(point.x, point.y);
    if (blocked.has(tile)) continue;

    const roll = random.next();
    let kind: Prop['kind'];
    if (roll < 0.3) kind = 'bush';
    else if (roll < 0.5) kind = 'boulder';
    else if (roll < 0.65) kind = 'fern';
    else if (roll < 0.75) kind = 'stump';
    else if (roll < 0.85) kind = 'mushroom';
    else kind = 'fern';

    const blocking = isBlockingProp(kind);
    if (blocking) {
      blocked.add(tile);
      const reachable = forestDistances(layout.tiles, layout.pathStart, blocked);
      const endIdx = indexOf(layout.pathEnd.x, layout.pathEnd.y);
      if (!reachable.has(endIdx)) {
        blocked.delete(tile);
        continue;
      }
    }
    props.push({ ...point, kind, blocking, variation: random.next() });
  }

  const interiorBlockingBudget = Math.max(0, maxBlocking - blocked.size);
  let placedInterior = 0;
  for (const point of interiorCandidates) {
    if (placedInterior >= interiorBlockingBudget) break;
    const tile = indexOf(point.x, point.y);
    if (blocked.has(tile)) continue;

    const roll = random.next();
    if (roll > 0.15) continue;

    let kind: Prop['kind'];
    const kindRoll = random.next();
    if (kindRoll < 0.4) kind = 'flower';
    else if (kindRoll < 0.7) kind = 'fern';
    else kind = 'mushroom';

    props.push({ ...point, kind, blocking: false, variation: random.next() });
    placedInterior++;
  }
}

function placeForestFloorProps(
  layout: ForestLayout,
  random: Random,
  density: Density,
  blocked: Set<number>,
  routeSet: ReadonlySet<number>,
  maxBlocking: number,
  props: Prop[],
): void {
  const nonWalkable: { x: number; y: number }[] = [];
  for (let y = 1; y < HEIGHT - 1; y++) {
    for (let x = 1; x < WIDTH - 1; x++) {
      if (isWalkable(layout, x, y)) continue;
      if (props.some((p) => p.x === x && p.y === y)) continue;
      nonWalkable.push({ x, y });
    }
  }
  for (let i = nonWalkable.length - 1; i > 0; i--) {
    const swap = random.int(0, i);
    const a = nonWalkable[i];
    const b = nonWalkable[swap];
    if (a && b) {
      nonWalkable[i] = b;
      nonWalkable[swap] = a;
    }
  }

  const fernCount = density === 'Sparse' ? 8 : density === 'Balanced' ? 16 : 24;
  let ferns = 0;
  for (const point of nonWalkable) {
    if (ferns >= fernCount) break;
    if (random.next() > 0.3) continue;
    props.push({ ...point, kind: 'fern', blocking: false, variation: random.next() });
    ferns++;
  }

  const mushroomCount = density === 'Sparse' ? 2 : density === 'Balanced' ? 5 : 8;
  let mushrooms = 0;
  for (const point of nonWalkable) {
    if (mushrooms >= mushroomCount) break;
    if (props.some((p) => p.x === point.x && p.y === point.y)) continue;
    if (random.next() > 0.15) continue;
    props.push({ ...point, kind: 'mushroom', blocking: false, variation: random.next() });
    mushrooms++;
  }

  const logCount = density === 'Sparse' ? 0 : density === 'Balanced' ? 1 : 2;
  const walkable: { x: number; y: number }[] = [];
  for (let y = 2; y < HEIGHT - 2; y++) {
    for (let x = 2; x < WIDTH - 2; x++) {
      if (!isWalkable(layout, x, y)) continue;
      if (routeSet.has(indexOf(x, y))) continue;
      if (props.some((p) => p.x === x && p.y === y)) continue;
      let nearForest = false;
      for (const [dx, dy] of NEIGHBORS_4) {
        if (!isWalkable(layout, x + dx, y + dy)) {
          nearForest = true;
          break;
        }
      }
      if (nearForest) walkable.push({ x, y });
    }
  }
  for (let i = walkable.length - 1; i > 0; i--) {
    const swap = random.int(0, i);
    const a = walkable[i];
    const b = walkable[swap];
    if (a && b) {
      walkable[i] = b;
      walkable[swap] = a;
    }
  }
  let logs = 0;
  for (const point of walkable) {
    if (logs >= logCount) break;
    if (blocked.size >= maxBlocking) break;
    const tile = indexOf(point.x, point.y);
    if (blocked.has(tile)) continue;

    blocked.add(tile);
    const reachable = forestDistances(layout.tiles, layout.pathStart, blocked);
    const endIdx = indexOf(layout.pathEnd.x, layout.pathEnd.y);
    if (!reachable.has(endIdx)) {
      blocked.delete(tile);
      continue;
    }
    props.push({ ...point, kind: 'log', blocking: true, variation: random.next() });
    logs++;
  }
}

function validateForest(map: ForestClearing): string | undefined {
  if (map.layout.tiles.length !== WIDTH * HEIGHT) return 'The tile field has incorrect dimensions.';
  if (!isConnected(map.layout.tiles)) return 'The forest floor is not connected.';
  if (!isWalkable(map.layout, map.layout.pathStart.x, map.layout.pathStart.y))
    return 'The path start is not on walkable ground.';
  if (!isWalkable(map.layout, map.layout.pathEnd.x, map.layout.pathEnd.y))
    return 'The path end is not on walkable ground.';

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
  return undefined;
}

export function generateForestClearing(
  settings: ForestSettings,
  limits: ForestLimits = DEFAULT_LIMITS,
): ForestGenerationResult {
  const settingsError = validateForestSettings(settings);
  if (settingsError) return { ok: false, error: settingsError };
  if (!Number.isInteger(limits.retries) || limits.retries < 1 || limits.retries > 16)
    return { ok: false, error: 'Generation limits must allow 1–16 retries.' };

  const seed = settings.seed.trim();
  for (let retry = 0; retry < limits.retries; retry++) {
    const random = new Random(streamSeed(seed, 'forest-layout', retry));

    const { tiles: clearingTiles, center } = createClearing(random);

    const allEdges: readonly Edge[] = ['north', 'south', 'east', 'west'];
    const startEdge = allEdges[random.int(0, 3)] ?? 'south';
    const endCandidates = allEdges.filter((e) => e !== startEdge);
    const endEdge =
      endCandidates[random.int(0, endCandidates.length - 1)] ?? oppositeEdge(startEdge);

    const pathStart = pointOnEdge(startEdge, random);
    const pathEnd = pointOnEdge(endEdge, random);

    const tiles = clearingTiles;
    const route = carvePath(tiles, pathStart, pathEnd, center, random);

    const layout: ForestLayout = { tiles, route, pathStart, pathEnd };

    if (!validateForestLayout(layout)) continue;

    const map: ForestClearing = {
      type: 'forest',
      version: GENERATOR_VERSION,
      seed,
      layout,
      surfaceSeed: streamSeed(seed, 'surface'),
      decoration: decorateForest(layout, seed, settings.density, 0),
    };

    const error = validateForest(map);
    if (!error) return { ok: true, map };
  }

  return {
    ok: false,
    error:
      'Could not generate a connected forest clearing within the generation limit. Try another seed or different density.',
  };
}

export function shuffleForestDetails(map: ForestClearing): ForestClearing {
  const revision = map.decoration.revision + 1;
  const decoration = decorateForest(map.layout, map.seed, map.decoration.density, revision);
  const updated: ForestClearing = { ...map, decoration };
  const error = validateForest(updated);
  if (error) return map;
  return updated;
}

export function changeForestDensity(map: ForestClearing, density: Density): ForestClearing {
  const decoration = decorateForest(map.layout, map.seed, density, map.decoration.revision);
  const updated: ForestClearing = { ...map, decoration };
  const error = validateForest(updated);
  if (error) return map;
  return updated;
}
