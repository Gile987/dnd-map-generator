import { GENERATOR_VERSION, HEIGHT, WIDTH, indexOf } from './model';
import type {
  CourtyardCharacter,
  CourtyardLayout,
  CourtyardSettings,
  Prop,
  PropKind,
  RuinedCourtyard,
} from './model';
import { Random, shuffleInPlace, streamSeed } from './random';
import { nextDetailRevision } from './decoration-revision';
import { propCells } from './prop-footprint';
import { placeCollapsedWagon } from './courtyard-wagon';
import { placeStoneWell } from './courtyard-well';
import { DEFAULT_COURTYARD_CHARACTER } from './model';
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

// Accents only ever draw from the supported kinds. Overgrown keeps the original
// four-way roster, so its decoration stream and RNG consumption are exactly the
// historical ones; the other characters reweight the same kinds with their own.
const ACCENT_ROSTERS: Readonly<Record<CourtyardCharacter, readonly PropKind[]>> = {
  Overgrown: ['low_rubble', 'moss', 'fern', 'vine'],
  Sunbleached: [
    'low_rubble',
    'low_rubble',
    'moss',
    'low_rubble',
    'fern',
    'low_rubble',
    'moss',
    'low_rubble',
  ],
  Frostbound: [
    'low_rubble',
    'low_rubble',
    'fern',
    'low_rubble',
    'moss',
    'low_rubble',
    'fern',
    'low_rubble',
  ],
  Desecrated: ['vine', 'low_rubble', 'moss', 'vine', 'low_rubble', 'vine', 'fern', 'low_rubble'],
};

type DecorationInputs = Pick<CourtyardSettings, 'density' | 'fountain' | 'character'>;

function decorateBase(
  layout: CourtyardLayout,
  seed: string,
  settings: DecorationInputs,
  revision: number,
): RuinedCourtyard['decoration'] {
  const fountainFlag = settings.fountain ? 'fountain' : 'open';
  // Overgrown must reproduce historical courtyards, so it keeps the legacy
  // argument list. Other characters consume a distinct stream.
  const random = new Random(
    settings.character === DEFAULT_COURTYARD_CHARACTER
      ? streamSeed(seed, 'courtyard-decoration', settings.density, fountainFlag, revision)
      : streamSeed(
          seed,
          'courtyard-decoration',
          settings.character,
          settings.density,
          fountainFlag,
          revision,
        ),
  );
  const roster = ACCENT_ROSTERS[settings.character];
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
    const kind = roster[random.int(0, roster.length - 1)] ?? 'moss';
    props.push({ ...p, kind, blocking: false, variation: random.next() });
    occupied.add(tile);
    count++;
  }
  return {
    density: settings.density,
    character: settings.character,
    fountain: settings.fountain,
    props,
    revision,
  };
}

function decorate(
  layout: CourtyardLayout,
  seed: string,
  settings: Pick<CourtyardSettings, 'density' | 'fountain' | 'character' | 'wagon' | 'well'>,
  revision: number,
):
  | { ok: true; decoration: RuinedCourtyard['decoration'] }
  | { ok: false; missing: 'well' | 'wagon' } {
  const base = decorateBase(layout, seed, settings, revision);
  // The fountain reserve always stays clear, whether the fountain is selected or not.
  const reserve = courtyardProtectedCells(layout),
    site = fountainSite(layout);
  for (const p of areaCells({ x: site.x - 1, y: site.y - 1, width: 5, height: 5 }))
    reserve.add(indexOf(p.x, p.y));
  const well = settings.well ? placeStoneWell(layout, seed, reserve) : undefined;
  if (settings.well && !well) return { ok: false, missing: 'well' };
  for (const tile of well?.reserve ?? []) reserve.add(tile);
  const wagon = settings.wagon ? placeCollapsedWagon(layout, seed, reserve) : undefined;
  if (settings.wagon && !wagon) return { ok: false, missing: 'wagon' };
  const reserved = new Set<number>();
  for (const tile of well?.reserve ?? []) reserved.add(tile);
  for (const tile of wagon?.reserve ?? []) reserved.add(tile);
  let ordinary = base.props.filter(
    (p) => !propCells(p).some((cell) => reserved.has(indexOf(cell.x, cell.y))),
  );
  // A new blocking pack can expose a pinch point formed by ordinary columns.
  // Remove only ordinary blocking props, without consuming another random draw.
  while (true) {
    const props = [...ordinary, ...(well?.props ?? []), ...(wagon?.props ?? [])];
    const blocked = new Set(
      props
        .filter((p) => p.blocking)
        .flatMap((p) => propCells(p).map((cell) => indexOf(cell.x, cell.y))),
    );
    if (
      gridDistances(layout.tiles, { x: 0, y: 0 }, blocked).size ===
      layout.tiles.filter(Boolean).length - blocked.size
    )
      return {
        ok: true,
        decoration: {
          ...base,
          ...(well ? { well: true as const } : {}),
          ...(wagon ? { wagon: true as const } : {}),
          props,
        },
      };
    let last = -1;
    for (let i = ordinary.length - 1; i >= 0; i--)
      if (ordinary[i]?.kind === 'broken_column') {
        last = i;
        break;
      }
    if (last < 0) return { ok: false, missing: settings.wagon ? 'wagon' : 'well' };
    ordinary = ordinary.filter((_, i) => i !== last);
  }
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
    decoration: {
      density: settings.density,
      character: settings.character,
      fountain: settings.fountain,
      revision: 0,
      props: [],
    },
  };
  const attempt = decorate(map.layout, seed, settings, 0);
  if (!attempt.ok)
    return attempt.missing === 'well'
      ? {
          ok: false,
          error: 'The stone well could not fit. Try another seed or remove the well.',
        }
      : {
          ok: false,
          error: 'The collapsed wagon could not fit. Try another seed or remove the wagon.',
        };
  const next = { ...map, decoration: attempt.decoration };
  const invalid = validateCourtyard(next);
  return invalid ? { ok: false, error: invalid } : { ok: true, map: next };
}

export function changeCourtyardAppearance(
  map: RuinedCourtyard,
  settings: Pick<CourtyardSettings, 'density' | 'fountain' | 'character' | 'wagon' | 'well'>,
): RuinedCourtyard {
  if (
    validateCourtyardSettings({
      seed: map.seed,
      density: settings.density,
      character: settings.character,
      fountain: settings.fountain,
      wagon: settings.wagon,
      well: settings.well,
    })
  )
    return map;
  const attempt = decorate(map.layout, map.seed, settings, map.decoration.revision);
  if (!attempt.ok) return map;
  const next = { ...map, decoration: attempt.decoration };
  return validateCourtyard(next) ? map : next;
}

export function shuffleCourtyardDetails(map: RuinedCourtyard): RuinedCourtyard {
  const revision = nextDetailRevision(map.decoration.revision);
  const attempt = decorate(
    map.layout,
    map.seed,
    {
      density: map.decoration.density,
      character: map.decoration.character,
      fountain: map.decoration.fountain,
      wagon: map.decoration.wagon,
      well: map.decoration.well,
    },
    revision,
  );
  if (!attempt.ok) return map;
  const next = { ...map, decoration: attempt.decoration };
  return validateCourtyard(next) ? map : next;
}
