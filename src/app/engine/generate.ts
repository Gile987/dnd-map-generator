import { GENERATOR_VERSION, HEIGHT, WIDTH, center, indexOf } from './model';
import type { Connection, GenerationResult, Room, Settings } from './model';
import { Random, hashSeed } from './random';
import { createLayout, distances } from './topology';
import { decorate } from './decoration';
import { validateDungeon, validateLayout, validateSettings } from './validation';

export interface GenerationLimits {
  readonly retries: number;
  readonly placementAttempts: number;
}

const DEFAULT_LIMITS: GenerationLimits = { retries: 16, placementAttempts: 320 };

function placeRooms(count: number, random: Random, attempts: number): Room[] {
  const rooms: Room[] = [];
  for (let attempt = 0; attempt < attempts && rooms.length < count; attempt++) {
    const width = random.int(5, 9);
    const height = random.int(4, 7);
    const candidate: Room = {
      id: rooms.length,
      x: random.int(2, WIDTH - width - 2),
      y: random.int(2, HEIGHT - height - 2),
      width,
      height,
    };
    const overlaps = rooms.some(
      (room) =>
        candidate.x < room.x + room.width + 2 &&
        candidate.x + width + 2 > room.x &&
        candidate.y < room.y + room.height + 2 &&
        candidate.y + height + 2 > room.y,
    );
    if (!overlaps) rooms.push(candidate);
  }
  return rooms;
}

function connectRooms(rooms: readonly Room[], random: Random): Connection[] {
  const first = rooms[0];
  if (!first) return [];
  const joined = new Set([first.id]);
  const connections: Connection[] = [];
  while (joined.size < rooms.length) {
    let best: { from: number; to: number; distance: number } | undefined;
    for (const a of rooms) {
      if (!joined.has(a.id)) continue;
      for (const b of rooms) {
        if (joined.has(b.id)) continue;
        const ac = center(a);
        const bc = center(b);
        const distance = (ac.x - bc.x) ** 2 + (ac.y - bc.y) ** 2;
        if (
          !best ||
          distance < best.distance ||
          (distance === best.distance &&
            (a.id < best.from || (a.id === best.from && b.id < best.to)))
        )
          best = { from: a.id, to: b.id, distance };
      }
    }
    if (!best) break;
    connections.push({
      from: best.from,
      to: best.to,
      bend: random.next() < 0.5 ? 'horizontal' : 'vertical',
    });
    joined.add(best.to);
  }
  return connections;
}

export function generateDungeon(
  settings: Settings,
  limits: GenerationLimits = DEFAULT_LIMITS,
): GenerationResult {
  const settingsError = validateSettings(settings);
  if (settingsError) return { ok: false, error: settingsError };
  if (
    !Number.isInteger(limits.retries) ||
    limits.retries < 1 ||
    limits.retries > 16 ||
    !Number.isInteger(limits.placementAttempts) ||
    limits.placementAttempts < 1 ||
    limits.placementAttempts > 320
  )
    return {
      ok: false,
      error: 'Generation limits must allow 1–16 retries and 1–320 placement attempts.',
    };
  const seed = settings.seed.trim();
  for (let retry = 0; retry < limits.retries; retry++) {
    const random = new Random(
      hashSeed(`${GENERATOR_VERSION}:${seed}:layout:${settings.roomCount}:${retry}`),
    );
    const rooms = placeRooms(settings.roomCount, random, limits.placementAttempts);
    if (rooms.length !== settings.roomCount) continue;
    const connections = connectRooms(rooms, random);
    let layout = createLayout(rooms, connections);
    let extra: { from: number; to: number; improvement: number } | undefined;
    for (const a of rooms) {
      const ac = center(a);
      const routes = distances(layout.tiles, ac);
      for (const b of rooms) {
        if (
          a.id >= b.id ||
          connections.some(
            (link) =>
              (link.from === a.id && link.to === b.id) || (link.from === b.id && link.to === a.id),
          )
        )
          continue;
        const bc = center(b);
        const direct = Math.abs(ac.x - bc.x) + Math.abs(ac.y - bc.y);
        const actual = routes.get(indexOf(bc.x, bc.y)) ?? 0;
        const improvement = actual - direct;
        if (direct <= 14 && improvement >= 10 && (!extra || improvement > extra.improvement))
          extra = { from: a.id, to: b.id, improvement };
      }
    }
    if (extra) {
      connections.push({
        from: extra.from,
        to: extra.to,
        bend: random.next() < 0.5 ? 'horizontal' : 'vertical',
      });
      layout = createLayout(rooms, connections);
    }
    if (validateLayout(layout, settings.roomCount)) continue;
    const map = {
      version: GENERATOR_VERSION,
      seed,
      layout,
      surfaceSeed: hashSeed(`${GENERATOR_VERSION}:${seed}:surface`),
      decoration: decorate(layout, seed, settings.density, 0),
    };
    const error = validateDungeon(map);
    if (!error) return { ok: true, map };
  }
  return {
    ok: false,
    error: `Could not place ${settings.roomCount} connected rooms within the generation limit. Try another seed or fewer rooms. Your previous map is still available.`,
  };
}
