import type { Density, Point, Prop, TileArea } from './model';
import { ALL_DENSITIES, DENSITY_BUDGETS, isBlockingProp } from './model';
import { isDetailRevision, nextDetailRevision } from './decoration-revision';
import { Random, hashSeed } from './random';
import { towerLaboratoryProps, laboratoryFloorUsable } from './tower-laboratory';

// Tower has its own stream version: existing generators and artwork stay unchanged.
export const TOWER_GENERATOR_VERSION = '3.0.0';
export const TOWER_MIN_FLOORS = 3;
export const TOWER_MAX_FLOORS = 8;
export const TOWER_STAIR_STYLES = ['separate', 'spiral'] as const;
export type TowerStairStyle = (typeof TOWER_STAIR_STYLES)[number];
export const DEFAULT_TOWER_STAIR_STYLE: TowerStairStyle = 'spiral';
export const TOWER_STAIR_LABELS: Readonly<Record<TowerStairStyle, string>> = {
  separate: 'Separate stairs',
  spiral: 'Shared spiral',
};
export interface TowerSettings {
  readonly stairStyle?: TowerStairStyle;
  readonly seed: string;
  readonly floorCount: number;
  readonly portalFloor: number | null;
  readonly laboratoryFloor?: number | null;
  readonly density: Density;
}
export interface TowerFloor extends TileArea {
  readonly number: number;
  readonly purpose: string;
  readonly secret: boolean;
}
export interface TowerConnection {
  readonly id: string;
  readonly kind: 'stairs' | 'portal';
  readonly from: number;
  readonly to: number;
  readonly departure: Point;
  readonly arrival: Point;
}
export interface Tower {
  readonly type: 'tower';
  readonly version: string;
  readonly seed: string;
  readonly surfaceSeed: number;
  readonly layout: {
    readonly stairStyle?: TowerStairStyle;
    readonly width: number;
    readonly height: number;
    readonly floors: readonly TowerFloor[];
    readonly connections: readonly TowerConnection[];
    readonly portalFloor: number | null;
    readonly tiles: readonly boolean[];
  };
  readonly decoration: {
    readonly density: Density;
    readonly revision: number;
    readonly laboratoryFloor?: number;
    readonly props: readonly Prop[];
  };
}
export function towerStairStyle(map: Pick<Tower, 'layout' | 'version'>): TowerStairStyle {
  return map.layout.stairStyle ?? (map.version === '1.0.0' ? 'separate' : 'spiral');
}
const PURPOSES = [
  'Entrance hall',
  'Library',
  'Alchemist’s workshop',
  'Living quarters',
  'Archive',
  'Summoning chamber',
  'Observatory',
  'Astral sanctum',
];
export function validateTowerSettings(settings: TowerSettings): string | undefined {
  if (
    typeof settings.seed !== 'string' ||
    !settings.seed.trim() ||
    settings.seed.trim().length > 64
  )
    return 'Enter a world seed from 1 to 64 characters.';
  if (
    !Number.isInteger(settings.floorCount) ||
    settings.floorCount < TOWER_MIN_FLOORS ||
    settings.floorCount > TOWER_MAX_FLOORS
  )
    return 'Choose a whole number of floors from 3 to 8.';
  if (
    settings.portalFloor !== null &&
    (!Number.isInteger(settings.portalFloor) ||
      settings.portalFloor < 1 ||
      settings.portalFloor > settings.floorCount)
  )
    return 'Choose a portal source from the tower’s floors.';
  if (
    settings.stairStyle !== undefined &&
    !TOWER_STAIR_STYLES.some((style) => style === settings.stairStyle)
  )
    return 'Choose a supported staircase style.';
  if (
    settings.laboratoryFloor != null &&
    (!Number.isInteger(settings.laboratoryFloor) ||
      settings.laboratoryFloor < 1 ||
      settings.laboratoryFloor > settings.floorCount)
  )
    return 'Choose a floor for the laboratory.';
  if (!ALL_DENSITIES.includes(settings.density)) return 'Choose a supported decoration density.';
  return undefined;
}
function towerLayout(
  count: number,
  portalFloor: number | null,
  seed: string,
  version: string,
  stairStyle: TowerStairStyle = DEFAULT_TOWER_STAIR_STYLE,
): Tower['layout'] {
  const random = new Random(
    hashSeed(`tower:${version}:${seed}:connections:${count}:${portalFloor}`),
  );
  const destinations = Array.from({ length: count - 1 }, (_, i) => i + 2).filter(
    (n) => n !== portalFloor,
  );
  const secretNumber =
    portalFloor === null
      ? null
      : version === '1.0.0'
        ? count
        : destinations[random.int(0, destinations.length - 1)];
  const columns = count <= 4 ? 2 : 3;
  const width = columns * 16,
    height = Math.ceil(count / columns) * 18;
  const floors: TowerFloor[] = Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    purpose: i + 1 === secretNumber ? 'Hidden sanctum' : (PURPOSES[i] ?? 'Chamber'),
    secret: i + 1 === secretNumber,
    x: (i % columns) * 16 + 1,
    y: Math.floor(i / columns) * 18 + 4,
    width: 14,
    height: 13,
  }));
  const connections: TowerConnection[] = [];
  if (version === '1.0.0') {
    for (let i = 0; i < count - 1; i++) {
      const from = floors[i],
        to = floors[i + 1];
      if (!from || !to) continue;
      const portal = to.secret;
      const source = portal ? floors[(portalFloor ?? 1) - 1] : from;
      if (!source) continue;
      connections.push({
        id: portal ? 'P' : String.fromCharCode(65 + i),
        kind: portal ? 'portal' : 'stairs',
        from: source.number,
        to: to.number,
        departure: { x: source.x + (portal ? 6 : 9), y: source.y + (portal ? 3 : 6) },
        arrival: { x: to.x + 3, y: to.y + 6 },
      });
    }
  } else {
    // One aligned shaft runs through all regular floors. The seed chooses its site.
    const sites = [
      { x: 3, y: 4 },
      { x: 4, y: 3 },
      { x: 7, y: 2 },
      { x: 9, y: 3 },
      { x: 10, y: 5 },
      { x: 9, y: 6 },
      { x: 8, y: 8 },
      { x: 4, y: 7 },
    ];
    const shaft = sites[random.int(0, sites.length - 1)] ?? { x: 3, y: 4 };
    const separate = version === '3.0.0' && stairStyle === 'separate';
    const clear = (p: Point, q: Point) => Math.abs(p.x - q.x) >= 4 || Math.abs(p.y - q.y) >= 4;
    const downSites = separate
      ? sites.filter((p) => clear(p, shaft) && sites.some((q) => clear(q, p) && clear(q, shaft)))
      : [];
    const down = separate ? (downSites[random.int(0, downSites.length - 1)] ?? shaft) : shaft;
    const at = (floor: TowerFloor, p: Point): Point => ({ x: floor.x + p.x, y: floor.y + p.y });
    const regular = floors.filter((f) => !f.secret);
    for (let i = 0; i < regular.length - 1; i++) {
      const from = regular[i],
        to = regular[i + 1];
      if (!from || !to) continue;
      connections.push({
        id: String.fromCharCode(65 + i),
        kind: 'stairs',
        from: from.number,
        to: to.number,
        departure: at(from, shaft),
        arrival: at(to, down),
      });
    }
    if (portalFloor !== null) {
      const source = floors.find((f) => f.number === portalFloor),
        destination = floors.find((f) => f.secret);
      const portalSites = [
        { x: 3, y: 4 },
        { x: 4, y: 3 },
        { x: 6, y: 2 },
        { x: 8, y: 2 },
        { x: 10, y: 4 },
        { x: 10, y: 6 },
        { x: 8, y: 8 },
        { x: 6, y: 9 },
        { x: 4, y: 8 },
        { x: 3, y: 6 },
      ];
      const departures = portalSites.filter((p) => {
        if (!separate)
          return Math.abs(p.x - shaft.x) >= 4 || p.y - shaft.y >= 5 || shaft.y - p.y >= 4;
        const active = connections
          .filter((c) => c.kind === 'stairs')
          .flatMap((c) =>
            c.from === source?.number
              ? [{ x: c.departure.x - (source?.x ?? 0), y: c.departure.y - (source?.y ?? 0) }]
              : c.to === source?.number
                ? [{ x: c.arrival.x - (source?.x ?? 0), y: c.arrival.y - (source?.y ?? 0) }]
                : [],
          );
        return active.every((site) => clear(p, site));
      });
      const departure = departures[random.int(0, departures.length - 1)],
        arrival = portalSites[random.int(0, portalSites.length - 1)];
      if (source && destination && departure && arrival)
        connections.push({
          id: 'P',
          kind: 'portal',
          from: source.number,
          to: destination.number,
          departure: at(source, departure),
          arrival: at(destination, arrival),
        });
    }
  }
  const tiles = Array<boolean>(width * height).fill(false);
  for (const floor of floors)
    for (let y = floor.y; y < floor.y + floor.height; y++)
      for (let x = floor.x; x < floor.x + floor.width; x++)
        if (Math.hypot(x + 0.5 - (floor.x + 7), y + 0.5 - (floor.y + 6.5)) <= 5.7)
          tiles[y * width + x] = true;
  return {
    width,
    height,
    floors,
    connections,
    portalFloor,
    tiles,
    ...(version === '3.0.0' ? { stairStyle } : {}),
  };
}
export function towerFloorAt(map: Tower, p: Point): TowerFloor | undefined {
  return map.layout.floors.find(
    (f) => p.x >= f.x && p.y >= f.y && p.x < f.x + f.width && p.y < f.y + f.height,
  );
}
// Stairs, portals and their landings claim their tiles on every floor they touch.
export function towerConnectionReserved(
  layout: Tower['layout'],
  p: Point,
  version: string,
): boolean {
  const spiral = towerStairStyle({ layout, version }) === 'spiral';
  return layout.connections.some((c) =>
    [c.departure, c.arrival].some(
      (end) =>
        Math.abs(end.x - p.x) <= (spiral && c.kind === 'stairs' ? 2 : 1) &&
        p.y >= end.y - 1 &&
        p.y <= end.y + (spiral && c.kind === 'stairs' ? 3 : 2),
    ),
  );
}
function reserved(layout: Tower['layout'], p: Point, version: string): boolean {
  return (
    towerConnectionReserved(layout, p, version) ||
    layout.floors.some((f) => Math.abs(f.x + 6 - p.x) <= 1 && Math.abs(f.y + 6 - p.y) <= 1)
  );
}
function decorate(
  seed: string,
  layout: Tower['layout'],
  density: Density,
  revision: number,
  version: string,
  laboratoryFloor?: number | null,
): Tower['decoration'] | undefined {
  const random = new Random(hashSeed(`tower:${version}:${seed}:details:${revision}`));
  // The laboratory draws from its own deterministic placement, never from the
  // details stream, so toggling it leaves every other floor's objects in place.
  const laboratory =
    laboratoryFloor == null
      ? undefined
      : towerLaboratoryProps(layout, laboratoryFloor, (p) =>
          towerConnectionReserved(layout, p, version),
        );
  if (laboratoryFloor != null && !laboratory) return undefined;
  const laboratoryTiles = new Set(laboratory?.map((p) => `${p.x},${p.y}`) ?? []);
  const props: Prop[] = [];
  const furnishings = [
    ['crate', 'barrel', 'crate', 'moss'],
    ['bookshelf', 'bookshelf', 'desk', 'scroll_case'],
    ['desk', 'ritual_offering', 'barrel', 'ritual_candles'],
    ['bedroll', 'bedroll', 'desk', 'barrel'],
    ['bookshelf', 'scroll_case', 'bookshelf', 'crate'],
    ['ritual_altar', 'ritual_candles', 'ritual_candles', 'ritual_offering'],
    ['desk', 'scroll_case', 'ritual_candles', 'bookshelf'],
    ['ritual_altar', 'ritual_offering', 'ritual_candles', 'bookshelf'],
  ] as const;
  for (const floor of layout.floors) {
    const candidates: Point[] = [];
    for (let y = floor.y + 2; y < floor.y + 11; y++)
      for (let x = floor.x + 2; x < floor.x + 12; x++) {
        const distance = Math.hypot(x + 0.5 - (floor.x + 7), y + 0.5 - (floor.y + 6.5));
        if (distance >= 3.8 && distance <= 4.7 && !reserved(layout, { x, y }, version))
          candidates.push({ x, y });
      }
    const budget = { Sparse: 3, Balanced: 6, Cluttered: 9 }[density];
    for (let i = 0; i < budget && candidates.length; i++) {
      const [p] = candidates.splice(random.int(0, candidates.length - 1), 1);
      if (!p) continue;
      // Objects stay on the perimeter; the central encounter area and all links remain open.
      const theme = furnishings[floor.secret ? 7 : floor.number - 1];
      const kind =
        i < 4 ? (theme?.[i] ?? 'scroll_case') : random.next() < 0.5 ? 'moss' : 'scroll_case';
      props.push({
        ...p,
        kind,
        blocking: isBlockingProp(kind),
        variation: random.next(),
      });
    }
  }
  // Consume the original details stream before removing occupied laboratory cells.
  // This preserves every unrelated floor, even when a laboratory replaces props.
  let ordinary = props.filter((p) => !laboratoryTiles.has(`${p.x},${p.y}`));
  const floor = layout.floors.find((f) => f.number === laboratoryFloor);
  if (floor && laboratory) {
    const area = layout.tiles.filter(
      (tile, i) =>
        tile &&
        i % layout.width >= floor.x &&
        i % layout.width < floor.x + floor.width &&
        Math.floor(i / layout.width) >= floor.y &&
        Math.floor(i / layout.width) < floor.y + floor.height,
    ).length;
    let remaining =
      Math.floor(area * DENSITY_BUDGETS[density]) - laboratory.filter((p) => p.blocking).length;
    ordinary = ordinary.filter((p) => {
      if (
        !p.blocking ||
        p.x < floor.x ||
        p.x >= floor.x + floor.width ||
        p.y < floor.y ||
        p.y >= floor.y + floor.height
      )
        return true;
      return remaining-- > 0;
    });
  }
  if (laboratory && laboratoryFloor != null && floor) {
    while (!laboratoryFloorUsable(layout, laboratoryFloor, [...laboratory, ...ordinary], density)) {
      let index = -1;
      for (let i = ordinary.length - 1; i >= 0; i--) {
        const p = ordinary[i];
        if (
          p?.blocking &&
          p.x >= floor.x &&
          p.x < floor.x + floor.width &&
          p.y >= floor.y &&
          p.y < floor.y + floor.height
        ) {
          index = i;
          break;
        }
      }
      if (index < 0) return undefined;
      ordinary = ordinary.filter((_, i) => i !== index);
    }
  }
  return {
    density,
    revision,
    ...(laboratory && laboratoryFloor != null ? { laboratoryFloor } : {}),
    props: laboratory ? [...laboratory, ...ordinary] : props,
  };
}
export function generateTower(
  settings: TowerSettings,
): { ok: true; map: Tower } | { ok: false; error: string } {
  const error = validateTowerSettings(settings);
  if (error) return { ok: false, error };
  const seed = settings.seed.trim();
  const layout = towerLayout(
    settings.floorCount,
    settings.portalFloor,
    seed,
    TOWER_GENERATOR_VERSION,
    settings.stairStyle ?? DEFAULT_TOWER_STAIR_STYLE,
  );
  const decoration = decorate(
    seed,
    layout,
    settings.density,
    0,
    TOWER_GENERATOR_VERSION,
    settings.laboratoryFloor,
  );
  if (!decoration)
    return {
      ok: false,
      error: 'That laboratory could not fit on that floor. Try another floor or seed.',
    };
  return {
    ok: true,
    map: {
      type: 'tower',
      version: TOWER_GENERATOR_VERSION,
      seed,
      layout,
      surfaceSeed: hashSeed(`tower:${TOWER_GENERATOR_VERSION}:${seed}:surface`),
      decoration,
    },
  };
}
export function changeTowerDensity(map: Tower, density: Density): Tower {
  if (!ALL_DENSITIES.includes(density)) return map;
  const decoration = decorate(
    map.seed,
    map.layout,
    density,
    map.decoration.revision,
    map.version,
    map.decoration.laboratoryFloor,
  );
  return decoration ? { ...map, decoration } : map;
}
export function changeTowerAppearance(map: Tower, settings: TowerSettings): Tower {
  if (validateTowerSettings(settings)) return map;
  const decoration = decorate(
    map.seed,
    map.layout,
    settings.density,
    map.decoration.revision,
    map.version,
    settings.laboratoryFloor,
  );
  return decoration ? { ...map, decoration } : map;
}
export function shuffleTowerDetails(map: Tower): Tower {
  const revision = nextDetailRevision(map.decoration.revision);
  const decoration = decorate(
    map.seed,
    map.layout,
    map.decoration.density,
    revision,
    map.version,
    map.decoration.laboratoryFloor,
  );
  return decoration ? { ...map, decoration } : map;
}
function object(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
// Bounded shape checks before any traversal; imports never determine allocation sizes.
export function isUsableTower(value: unknown): value is Tower {
  if (
    !object(value) ||
    value['type'] !== 'tower' ||
    (value['version'] !== '1.0.0' &&
      value['version'] !== '2.0.0' &&
      value['version'] !== TOWER_GENERATOR_VERSION) ||
    typeof value['seed'] !== 'string' ||
    value['seed'] !== value['seed'].trim() ||
    typeof value['surfaceSeed'] !== 'number' ||
    !Number.isSafeInteger(value['surfaceSeed']) ||
    value['surfaceSeed'] < 0 ||
    value['surfaceSeed'] > 0xffffffff
  )
    return false;
  const l = value['layout'],
    d = value['decoration'];
  if (
    !object(l) ||
    !object(d) ||
    !Array.isArray(l['floors']) ||
    l['floors'].length < 3 ||
    l['floors'].length > 8 ||
    !Array.isArray(l['connections']) ||
    l['connections'].length > 7 ||
    !Array.isArray(l['tiles']) ||
    l['tiles'].length > 2592 ||
    d['forestSurface'] !== undefined ||
    d['studySurface'] !== undefined ||
    d['ritual'] !== undefined ||
    (d['laboratoryFloor'] !== undefined &&
      (typeof d['laboratoryFloor'] !== 'number' ||
        !Number.isInteger(d['laboratoryFloor']) ||
        d['laboratoryFloor'] < 1 ||
        d['laboratoryFloor'] > l['floors'].length)) ||
    !Array.isArray(d['props']) ||
    d['props'].length > 77 ||
    !isDetailRevision(d['revision']) ||
    typeof d['density'] !== 'string' ||
    !ALL_DENSITIES.some((x) => x === d['density'])
  )
    return false;
  if (
    value['version'] === '3.0.0'
      ? !TOWER_STAIR_STYLES.some((style) => style === l['stairStyle'])
      : l['stairStyle'] !== undefined
  )
    return false;
  const portal = l['portalFloor'];
  if (portal !== null && typeof portal !== 'number') return false;
  if (
    validateTowerSettings({
      seed: value['seed'],
      floorCount: l['floors'].length,
      portalFloor: portal,
      density: d['density'] as Density,
    })
  )
    return false;
  if (value['version'] === '1.0.0' && portal === l['floors'].length) return false;
  const expected = towerLayout(
    l['floors'].length,
    portal,
    value['seed'],
    value['version'],
    l['stairStyle'] as TowerStairStyle | undefined,
  );
  if (
    l['width'] !== expected.width ||
    l['height'] !== expected.height ||
    l['tiles'].length !== expected.tiles.length ||
    !l['tiles'].every((tile, i) => tile === expected.tiles[i])
  )
    return false;
  if (
    !l['floors'].every(
      (f, i) => object(f) && Object.entries(expected.floors[i] ?? {}).every(([k, v]) => f[k] === v),
    )
  )
    return false;
  if (
    l['connections'].length !== expected.connections.length ||
    !l['connections'].every((c, i) => {
      const e = expected.connections[i];
      return (
        e &&
        object(c) &&
        c['id'] === e.id &&
        c['kind'] === e.kind &&
        c['from'] === e.from &&
        c['to'] === e.to &&
        object(c['departure']) &&
        object(c['arrival']) &&
        c['departure']['x'] === e.departure.x &&
        c['departure']['y'] === e.departure.y &&
        c['arrival']['x'] === e.arrival.x &&
        c['arrival']['y'] === e.arrival.y
      );
    })
  )
    return false;
  const occupied = new Set<string>();
  const checkedCells: Pick<Prop, 'x' | 'y' | 'blocking'>[] = [];
  const version = value['version'];
  const laboratory =
    d['laboratoryFloor'] === undefined
      ? undefined
      : towerLaboratoryProps(expected, d['laboratoryFloor'], (p) =>
          towerConnectionReserved(expected, p, version),
        );
  // A stored laboratory must be exactly the placement the layout produces.
  if (d['laboratoryFloor'] !== undefined && !laboratory) return false;
  const laboratoryTiles = new Map<string, Prop>(
    laboratory?.map((p) => [`${p.x},${p.y}`, p] as const) ?? [],
  );
  for (const p of d['props']) {
    if (
      !object(p) ||
      typeof p['x'] !== 'number' ||
      typeof p['y'] !== 'number' ||
      !Number.isInteger(p['x']) ||
      !Number.isInteger(p['y']) ||
      p['x'] < 0 ||
      p['y'] < 0 ||
      p['x'] >= expected.width ||
      p['y'] >= expected.height ||
      !expected.tiles[p['y'] * expected.width + p['x']] ||
      typeof p['kind'] !== 'string' ||
      typeof p['variation'] !== 'number' ||
      !Number.isFinite(p['variation']) ||
      p['variation'] < 0 ||
      p['variation'] >= 1
    )
      return false;
    const key = `${p['x']},${p['y']}`;
    const expectedLaboratory = laboratoryTiles.get(key);
    if (expectedLaboratory) {
      if (
        p['kind'] !== expectedLaboratory.kind ||
        p['blocking'] !== expectedLaboratory.blocking ||
        p['variation'] !== expectedLaboratory.variation ||
        p['footprint'] !== undefined ||
        p['rotation'] !== undefined
      )
        return false;
    } else {
      if (
        reserved(expected, { x: p['x'], y: p['y'] }, value['version']) ||
        p['footprint'] !== undefined ||
        p['rotation'] !== undefined ||
        ![
          'crate',
          'bookshelf',
          'barrel',
          'scroll_case',
          'ritual_altar',
          'bedroll',
          'ritual_candles',
          'desk',
          'ritual_offering',
          'moss',
        ].includes(p['kind']) ||
        p['blocking'] !==
          ['crate', 'bookshelf', 'barrel', 'ritual_altar', 'desk'].includes(p['kind'])
      )
        return false;
    }
    const f = expected.floors.find(
      (f) =>
        Number(p['x']) >= f.x &&
        Number(p['x']) < f.x + f.width &&
        Number(p['y']) >= f.y &&
        Number(p['y']) < f.y + f.height,
    );
    if (
      !f ||
      (!expectedLaboratory &&
        (Math.hypot(p['x'] + 0.5 - (f.x + 7), p['y'] + 0.5 - (f.y + 6.5)) < 3.8 ||
          Math.hypot(p['x'] + 0.5 - (f.x + 7), p['y'] + 0.5 - (f.y + 6.5)) > 4.7))
    )
      return false;
    if (occupied.has(key)) return false;
    occupied.add(key);
    checkedCells.push({ x: p['x'], y: p['y'], blocking: p['blocking'] === true });
  }
  if (
    d['laboratoryFloor'] !== undefined &&
    !laboratoryFloorUsable(expected, d['laboratoryFloor'], checkedCells, d['density'] as Density)
  )
    return false;
  const props = d['props'];
  if (
    laboratoryTiles.size > 0 &&
    props.filter((p) => object(p) && laboratoryTiles.has(`${p['x']},${p['y']}`)).length !==
      laboratoryTiles.size
  )
    return false;
  return expected.floors.every(
    (f) =>
      props.filter(
        (p) =>
          object(p) &&
          !laboratoryTiles.has(`${p['x']},${p['y']}`) &&
          Number(p['x']) >= f.x &&
          Number(p['x']) < f.x + f.width &&
          Number(p['y']) >= f.y &&
          Number(p['y']) < f.y + f.height,
      ).length <= { Sparse: 3, Balanced: 6, Cluttered: 9 }[d['density'] as Density],
  );
}
