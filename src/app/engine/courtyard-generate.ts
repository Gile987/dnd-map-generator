import { GENERATOR_VERSION, HEIGHT, WIDTH, indexOf } from './model';
import type { CourtyardLayout, CourtyardSettings, Prop, RuinedCourtyard } from './model';
import { Random, shuffleInPlace, streamSeed } from './random';
import { nextDetailRevision } from './decoration-revision';
import { gridDistances } from './grid-traversal';
import {
  areaCells,
  courtyardProtectedCells,
  fountainSite,
  validateCourtyard,
  validateCourtyardSettings,
} from './courtyard-validation';

function createLayout(random: Random): CourtyardLayout {
  const bounds = {
    x: random.int(4, 7),
    y: random.int(3, 5),
    width: random.int(26, 29),
    height: random.int(20, 22),
  };
  const b = bounds;
  const approaches = [
    { x: random.int(b.x + 6, b.x + b.width - 7), y: b.y },
    { x: b.x + b.width - 1, y: random.int(b.y + 6, b.y + b.height - 7) },
    { x: random.int(b.x + 6, b.x + b.width - 7), y: b.y + b.height - 1 },
    { x: b.x, y: random.int(b.y + 6, b.y + b.height - 7) },
  ];
  const layout: CourtyardLayout = {
    bounds,
    approaches,
    encounter: { x: b.x + 6, y: b.y + Math.floor(b.height / 2) - 3, width: 6, height: 6 },
    tiles: [],
  };
  const protectedCells = courtyardProtectedCells(layout);
  const site = fountainSite(layout);
  for (const p of areaCells({ x: site.x - 1, y: site.y - 1, width: 5, height: 5 }))
    protectedCells.add(indexOf(p.x, p.y));
  const tiles = Array<boolean>(WIDTH * HEIGHT).fill(true);
  for (const p of areaCells(b)) {
    const edge =
      p.x === b.x || p.y === b.y || p.x === b.x + b.width - 1 || p.y === b.y + b.height - 1;
    if (edge && !protectedCells.has(indexOf(p.x, p.y))) tiles[indexOf(p.x, p.y)] = false;
  }
  // Detached wall remnants sit near opposite corners, away from all approaches.
  for (const anchor of [
    { x: b.x + 3, y: b.y + 3 },
    { x: b.x + b.width - 7, y: b.y + b.height - 4 },
  ]) {
    const length = random.int(3, 5);
    for (let dx = 0; dx < length; dx++) {
      const tile = indexOf(anchor.x + dx, anchor.y);
      if (!protectedCells.has(tile)) tiles[tile] = false;
    }
  }
  // Small additional breaches make the perimeter visibly broken rather than sealed.
  for (const x of [b.x + 3, b.x + b.width - 5]) {
    tiles[indexOf(x, b.y)] = true;
    tiles[indexOf(x + 1, b.y)] = true;
  }
  return { ...layout, tiles };
}

function decorate(
  layout: CourtyardLayout,
  seed: string,
  settings: Pick<CourtyardSettings, 'density' | 'fountain'>,
  revision: number,
): RuinedCourtyard['decoration'] {
  const random = new Random(
    streamSeed(
      seed,
      'courtyard-decoration',
      settings.density,
      settings.fountain ? 'fountain' : 'open',
      revision,
    ),
  );
  const protectedCells = courtyardProtectedCells(layout);
  const props: Prop[] = [];
  const blocked = new Set<number>();
  if (settings.fountain) {
    const site = fountainSite(layout);
    props.push({
      ...site,
      kind: 'dry_fountain',
      blocking: true,
      variation: random.next(),
      footprint: { width: 3, height: 3 },
      rotation: 0,
    });
    for (const p of areaCells({ ...site, width: 3, height: 3 })) blocked.add(indexOf(p.x, p.y));
    for (const p of areaCells({ x: site.x - 1, y: site.y - 1, width: 5, height: 5 }))
      protectedCells.add(indexOf(p.x, p.y));
  }
  const candidates = areaCells({
    x: layout.bounds.x + 2,
    y: layout.bounds.y + 2,
    width: layout.bounds.width - 4,
    height: layout.bounds.height - 4,
  });
  shuffleInPlace(candidates, random);
  const target = { Sparse: 6, Balanced: 10, Cluttered: 16 }[settings.density];
  for (const p of candidates) {
    if (props.filter((prop) => prop.kind === 'broken_column').length >= target) break;
    const tile = indexOf(p.x, p.y);
    if (!layout.tiles[tile] || protectedCells.has(tile)) continue;
    if (
      areaCells({ x: p.x - 1, y: p.y - 1, width: 3, height: 3 }).some(
        (cell) => !layout.tiles[indexOf(cell.x, cell.y)] || blocked.has(indexOf(cell.x, cell.y)),
      )
    )
      continue;
    blocked.add(tile);
    if (
      gridDistances(layout.tiles, { x: 0, y: 0 }, blocked).size !==
      layout.tiles.filter(Boolean).length - blocked.size
    ) {
      blocked.delete(tile);
      continue;
    }
    props.push({ ...p, kind: 'broken_column', blocking: true, variation: random.next() });
  }
  const occupied = new Set(props.map((p) => indexOf(p.x, p.y)));
  const accents = { Sparse: 24, Balanced: 42, Cluttered: 64 }[settings.density];
  let count = 0;
  for (const p of candidates) {
    const tile = indexOf(p.x, p.y);
    if (count >= accents) break;
    if (!layout.tiles[tile] || protectedCells.has(tile) || occupied.has(tile)) continue;
    const kind = (['low_rubble', 'moss', 'fern', 'vine'] as const)[random.int(0, 3)] ?? 'moss';
    props.push({ ...p, kind, blocking: false, variation: random.next() });
    occupied.add(tile);
    count++;
  }
  return { density: settings.density, fountain: settings.fountain, props, revision };
}

export function generateCourtyard(
  settings: CourtyardSettings,
):
  | { readonly ok: true; readonly map: RuinedCourtyard }
  | { readonly ok: false; readonly error: string } {
  const error = validateCourtyardSettings(settings);
  if (error) return { ok: false, error };
  const seed = settings.seed.trim();
  const map: RuinedCourtyard = {
    type: 'courtyard',
    version: GENERATOR_VERSION,
    seed,
    layout: createLayout(new Random(streamSeed(seed, 'courtyard-layout'))),
    surfaceSeed: streamSeed(seed, 'courtyard-surface'),
    decoration: { density: settings.density, fountain: settings.fountain, revision: 0, props: [] },
  };
  const next = {
    ...map,
    decoration: decorate(
      map.layout,
      seed,
      { density: settings.density, fountain: settings.fountain },
      0,
    ),
  };
  const invalid = validateCourtyard(next);
  return invalid ? { ok: false, error: invalid } : { ok: true, map: next };
}

export function changeCourtyardAppearance(
  map: RuinedCourtyard,
  settings: Pick<CourtyardSettings, 'density' | 'fountain'>,
): RuinedCourtyard {
  const next = {
    ...map,
    decoration: decorate(map.layout, map.seed, settings, map.decoration.revision),
  };
  return validateCourtyard(next) ? map : next;
}

export function shuffleCourtyardDetails(map: RuinedCourtyard): RuinedCourtyard {
  const revision = nextDetailRevision(map.decoration.revision);
  const next = {
    ...map,
    decoration: decorate(
      map.layout,
      map.seed,
      { density: map.decoration.density, fountain: map.decoration.fountain },
      revision,
    ),
  };
  return validateCourtyard(next) ? map : next;
}
