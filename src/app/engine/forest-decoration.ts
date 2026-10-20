import { HEIGHT, WIDTH, indexOf, isBlockingProp, isWalkable } from './model';
import type { Density, ForestCharacter, ForestDecoration, ForestLayout, Prop } from './model';
import { Random, shuffleInPlace, streamSeed } from './random';
import { NEIGHBORS_4, forestDistances } from './forest-layout';

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

const budgets: Readonly<Record<Density, number>> = { Sparse: 0.05, Balanced: 0.1, Cluttered: 0.15 };

interface EdgeRolls {
  readonly bush: number;
  readonly boulder: number;
  readonly fern: number;
  readonly stump: number;
  readonly mushroom: number;
}

interface InteriorRolls {
  readonly flower: number;
  readonly fern: number;
}

interface CharacterProfile {
  readonly trees: (random: Random) => number;
  readonly edge: EdgeRolls;
  readonly interior: InteriorRolls;
  readonly undergrowth: Readonly<Record<Density, number>>;
  readonly mushrooms: Readonly<Record<Density, number>>;
  readonly logs: Readonly<Record<Density, number>>;
}

const VERDANT_EDGE: EdgeRolls = { bush: 0.3, boulder: 0.2, fern: 0.15, stump: 0.1, mushroom: 0.1 };
const VERDANT_INTERIOR: InteriorRolls = { flower: 0.4, fern: 0.3 };

const profiles: Readonly<Record<ForestCharacter, CharacterProfile>> = {
  Verdant: {
    trees: (random) => 50 + random.int(0, 20),
    edge: VERDANT_EDGE,
    interior: VERDANT_INTERIOR,
    undergrowth: { Sparse: 8, Balanced: 16, Cluttered: 24 },
    mushrooms: { Sparse: 2, Balanced: 5, Cluttered: 8 },
    logs: { Sparse: 0, Balanced: 1, Cluttered: 2 },
  },
  Autumn: {
    trees: (random) => 50 + random.int(0, 20),
    edge: { bush: 0.25, boulder: 0.15, fern: 0.2, stump: 0.05, mushroom: 0.2 },
    interior: { flower: 0.2, fern: 0.35 },
    undergrowth: { Sparse: 12, Balanced: 18, Cluttered: 26 },
    mushrooms: { Sparse: 4, Balanced: 8, Cluttered: 12 },
    logs: { Sparse: 1, Balanced: 1, Cluttered: 2 },
  },
  Pines: {
    trees: (random) => 70 + random.int(0, 25),
    edge: { bush: 0.1, boulder: 0.3, fern: 0.05, stump: 0.25, mushroom: 0.1 },
    interior: { flower: 0.05, fern: 0.55 },
    undergrowth: { Sparse: 10, Balanced: 16, Cluttered: 22 },
    mushrooms: { Sparse: 3, Balanced: 6, Cluttered: 9 },
    logs: { Sparse: 1, Balanced: 2, Cluttered: 3 },
  },
  Fey: {
    trees: (random) => 45 + random.int(0, 20),
    edge: { bush: 0.2, boulder: 0.1, fern: 0.25, stump: 0.05, mushroom: 0.25 },
    interior: { flower: 0.6, fern: 0.2 },
    undergrowth: { Sparse: 10, Balanced: 18, Cluttered: 26 },
    mushrooms: { Sparse: 4, Balanced: 9, Cluttered: 14 },
    logs: { Sparse: 0, Balanced: 1, Cluttered: 2 },
  },
};

export function decorateForest(
  layout: ForestLayout,
  seed: string,
  character: ForestCharacter,
  density: Density,
  revision: number,
): ForestDecoration {
  const random = new Random(streamSeed(seed, 'forest-decoration', character, density, revision));
  const profile = profiles[character];
  const props: Prop[] = [];
  const blocked = new Set<number>();
  const routeSet = new Set(layout.route);
  const floorCount = layout.tiles.filter(Boolean).length;
  const maxBlocking = Math.floor(floorCount * budgets[density]);

  placeTrees(layout, random, props, profile);
  placeClearingProps(layout, random, blocked, routeSet, maxBlocking, props, profile);
  placeForestFloorProps(layout, random, density, blocked, routeSet, maxBlocking, props, profile);

  const reachable = forestDistances(layout.tiles, layout.pathStart, blocked);
  if (!reachable.has(indexOf(layout.pathEnd.x, layout.pathEnd.y))) {
    return { props: props.filter((p) => !p.blocking), density, character, revision };
  }

  return { props, density, character, revision };
}

function placeTrees(
  layout: ForestLayout,
  random: Random,
  props: Prop[],
  profile: CharacterProfile,
): void {
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

  shuffleInPlace(candidates, random);

  const treeCount = Math.min(candidates.length, profile.trees(random));
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
  profile: CharacterProfile,
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

  shuffleInPlace(edgeCandidates, random);

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
  shuffleInPlace(interiorCandidates, random);

  for (const point of edgeCandidates) {
    if (blocked.size >= maxBlocking) break;
    const tile = indexOf(point.x, point.y);
    if (blocked.has(tile)) continue;

    const roll = random.next();
    const { edge } = profile;
    let kind: Prop['kind'];
    if (roll < edge.bush) kind = 'bush';
    else if (roll < edge.bush + edge.boulder) kind = 'boulder';
    else if (roll < edge.bush + edge.boulder + edge.fern) kind = 'fern';
    else if (roll < edge.bush + edge.boulder + edge.fern + edge.stump) kind = 'stump';
    else if (roll < edge.bush + edge.boulder + edge.fern + edge.stump + edge.mushroom)
      kind = 'mushroom';
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
    if (kindRoll < profile.interior.flower) kind = 'flower';
    else if (kindRoll < profile.interior.flower + profile.interior.fern) kind = 'fern';
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
  profile: CharacterProfile,
): void {
  const nonWalkable: { x: number; y: number }[] = [];
  for (let y = 1; y < HEIGHT - 1; y++) {
    for (let x = 1; x < WIDTH - 1; x++) {
      if (isWalkable(layout, x, y)) continue;
      if (props.some((p) => p.x === x && p.y === y)) continue;
      nonWalkable.push({ x, y });
    }
  }
  shuffleInPlace(nonWalkable, random);

  const fernCount = profile.undergrowth[density];
  let ferns = 0;
  for (const point of nonWalkable) {
    if (ferns >= fernCount) break;
    if (random.next() > 0.3) continue;
    props.push({ ...point, kind: 'fern', blocking: false, variation: random.next() });
    ferns++;
  }

  const mushroomCount = profile.mushrooms[density];
  let mushrooms = 0;
  for (const point of nonWalkable) {
    if (mushrooms >= mushroomCount) break;
    if (props.some((p) => p.x === point.x && p.y === point.y)) continue;
    if (random.next() > 0.15) continue;
    props.push({ ...point, kind: 'mushroom', blocking: false, variation: random.next() });
    mushrooms++;
  }

  const logCount = profile.logs[density];
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
  shuffleInPlace(walkable, random);
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
