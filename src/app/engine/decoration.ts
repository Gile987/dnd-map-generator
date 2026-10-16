import { center, indexOf, isBlockingProp, isFloor } from './model';
import type { Decoration, DecorationPreset, Density, Dungeon, Layout, Prop } from './model';
import { Random, streamSeed } from './random';
import { isTraversable, reservedTiles } from './validation';

const budgets: Readonly<Record<Density, number>> = { Sparse: 0.05, Balanced: 0.1, Cluttered: 0.15 };

type PropChoice = Prop['kind'];

interface PresetPalette {
  readonly cornerProps: readonly [PropChoice, ...PropChoice[]];
  readonly edgeProps: readonly [PropChoice, ...PropChoice[]];
  readonly cornerFirstWeight: number;
  readonly floorKind: PropChoice | null;
  readonly floorChance: number;
  readonly wallAccent: PropChoice;
  readonly wallAccentChance: number;
  readonly secondaryWall: PropChoice | null;
  readonly secondaryWallCount: (density: Density) => number;
}

const palettes: Readonly<Record<DecorationPreset, PresetPalette>> = {
  Mosslit: {
    cornerProps: ['rubble', 'crate', 'barrel'],
    edgeProps: ['crate', 'barrel'],
    cornerFirstWeight: 0.7,
    floorKind: 'rug',
    floorChance: 0.55,
    wallAccent: 'sconce',
    wallAccentChance: 1,
    secondaryWall: 'moss',
    secondaryWallCount: (density) => (density === 'Sparse' ? 2 : density === 'Balanced' ? 4 : 6),
  },
  Crypt: {
    cornerProps: ['rubble', 'broken_column'],
    edgeProps: ['sarcophagus', 'barrel', 'rubble'],
    cornerFirstWeight: 0.5,
    floorKind: 'rug',
    floorChance: 0.35,
    wallAccent: 'sconce',
    wallAccentChance: 0.7,
    secondaryWall: null,
    secondaryWallCount: () => 1,
  },
  Storehouse: {
    cornerProps: ['crate', 'barrel', 'rubble'],
    edgeProps: ['crate', 'barrel', 'crate', 'barrel'],
    cornerFirstWeight: 0.4,
    floorKind: 'rug',
    floorChance: 0.65,
    wallAccent: 'sconce',
    wallAccentChance: 1,
    secondaryWall: 'moss',
    secondaryWallCount: (density) => (density === 'Sparse' ? 1 : density === 'Balanced' ? 2 : 3),
  },
  Sanctuary: {
    cornerProps: ['broken_column', 'rubble', 'moss'],
    edgeProps: ['broken_column', 'rubble', 'barrel'],
    cornerFirstWeight: 0.3,
    floorKind: 'rug',
    floorChance: 0.3,
    wallAccent: 'vine',
    wallAccentChance: 1,
    secondaryWall: 'moss',
    secondaryWallCount: (density) => (density === 'Sparse' ? 4 : density === 'Balanced' ? 6 : 8),
  },
};

function pickProp(
  random: Random,
  choices: readonly [PropChoice, ...PropChoice[]],
  firstWeight: number,
): PropChoice {
  if (firstWeight > 0 && random.next() < firstWeight) return choices[0];
  const remaining = choices.slice(firstWeight > 0 ? 1 : 0);
  return remaining[random.int(0, remaining.length - 1)] ?? choices[0];
}

export function decorate(
  layout: Layout,
  seed: string,
  density: Density,
  preset: DecorationPreset,
  revision: number,
): Decoration {
  const random = new Random(streamSeed(seed, 'decoration', preset, density, revision));
  const palette = palettes[preset];
  const props: Prop[] = [];
  const blocked = new Set<number>();
  const reserved = reservedTiles(layout);
  for (const room of layout.rooms) {
    const candidates: { x: number; y: number }[] = [];
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        if (
          x === room.x ||
          y === room.y ||
          x === room.x + room.width - 1 ||
          y === room.y + room.height - 1
        )
          candidates.push({ x, y });
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
    const budget = Math.floor(room.width * room.height * budgets[density]);
    let placed = 0;
    for (const point of candidates) {
      if (placed >= budget) break;
      const tile = indexOf(point.x, point.y);
      if (reserved.has(tile) || blocked.has(tile)) continue;
      const corner =
        (point.x === room.x || point.x === room.x + room.width - 1) &&
        (point.y === room.y || point.y === room.y + room.height - 1);
      const kind = corner
        ? pickProp(random, palette.cornerProps, palette.cornerFirstWeight)
        : pickProp(random, palette.edgeProps, 0);
      const blocking = isBlockingProp(kind);
      if (blocking) {
        blocked.add(tile);
        if (!isTraversable(layout, blocked)) {
          blocked.delete(tile);
          continue;
        }
      }
      props.push({
        ...point,
        kind,
        blocking,
        variation: random.next(),
      });
      placed++;
    }
    const middle = center(room);
    if (
      palette.floorKind &&
      random.next() < palette.floorChance &&
      room.height >= 5 &&
      !reserved.has(indexOf(middle.x, middle.y))
    ) {
      props.push({
        ...middle,
        kind: palette.floorKind,
        blocking: false,
        variation: random.next(),
      });
    }
    const wallTiles = candidates.filter(
      (point) =>
        !blocked.has(indexOf(point.x, point.y)) &&
        !reserved.has(indexOf(point.x, point.y)) &&
        !isFloor(layout, point.x, point.y - 1),
    );
    let wallIdx = 0;
    if (random.next() < palette.wallAccentChance && wallTiles.length > wallIdx) {
      const accent = wallTiles[wallIdx];
      if (accent)
        props.push({
          ...accent,
          kind: palette.wallAccent,
          blocking: false,
          variation: random.next(),
        });
      wallIdx++;
    }
    if (palette.secondaryWall) {
      const count = palette.secondaryWallCount(density);
      for (const point of wallTiles.slice(wallIdx, wallIdx + count)) {
        props.push({
          ...point,
          kind: palette.secondaryWall,
          blocking: false,
          variation: random.next(),
        });
      }
    }
  }
  return { props, density, preset, revision };
}

export function shuffleDetails(map: Dungeon, density: Density = map.decoration.density): Dungeon {
  const revision = map.decoration.revision + 1;
  return {
    ...map,
    decoration: decorate(map.layout, map.seed, density, map.decoration.preset, revision),
  };
}

export function changeDensity(map: Dungeon, density: Density): Dungeon {
  return {
    ...map,
    decoration: decorate(
      map.layout,
      map.seed,
      density,
      map.decoration.preset,
      map.decoration.revision,
    ),
  };
}

export function changePreset(map: Dungeon, preset: DecorationPreset): Dungeon {
  return {
    ...map,
    decoration: decorate(
      map.layout,
      map.seed,
      map.decoration.density,
      preset,
      map.decoration.revision,
    ),
  };
}
