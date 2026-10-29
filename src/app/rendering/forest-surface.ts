import { HEIGHT, WIDTH, indexOf, isWalkable } from '../engine/model';
import type { ForestCharacter, ForestClearing, Point } from '../engine/model';
import { campReservations } from '../engine/forest-camp';
import { circleReserve } from '../engine/forest-landmark';
import { areaContains } from '../engine/feature-reservation';
import { Random, deriveSeed } from '../engine/random';
import type { DrawingContext } from './drawing-context';

interface SurfacePatch extends Point {
  readonly kind: 'leaves' | 'needles' | 'petals' | 'ash';
  readonly seed: number;
}

/** Flat, derived artwork only. Tile placement and all engine RNG streams stay unchanged. */
export function forestSurfacePatches(map: ForestClearing): readonly SurfacePatch[] {
  if (map.decoration.forestSurface !== 1) return [];
  const route = new Set(map.layout.route);
  const occupied = new Set(map.decoration.props.map((p) => indexOf(p.x, p.y)));
  const camp = campReservations(map.decoration.props);
  const stones = map.decoration.props.filter((p) => p.kind === 'standing_stone');
  const circle =
    stones.length === 6
      ? {
          x: stones.reduce((sum, p) => sum + p.x, 0) / 6,
          y: stones.reduce((sum, p) => sum + p.y, 0) / 6,
        }
      : undefined;
  const hearth =
    map.decoration.scene === 'Abandoned camp'
      ? map.decoration.props.find((p) => p.kind === 'fire_ring')
      : undefined;
  const ashRandom = new Random(deriveSeed(map.surfaceSeed, 'camp-ash', 1, map.decoration.revision));
  const wind = ashRandom.int(0, 3);
  const ashOffsets = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ] as const;
  const downwind = ashOffsets[wind];
  const sideways = ashRandom.next() < 0.5 ? ashOffsets[(wind + 1) % 4] : undefined;
  const trees = map.decoration.props.filter(
    (p) => p.kind === 'tree' || p.kind === 'stump' || p.kind === 'log',
  );
  const patches: SurfacePatch[] = [];
  for (let y = 1; y < HEIGHT - 1; y++)
    for (let x = 1; x < WIDTH - 1; x++) {
      const tile = indexOf(x, y),
        point = { x, y };
      if (
        !isWalkable(map.layout, x, y) ||
        route.has(tile) ||
        (circle && circleReserve(circle, point))
      )
        continue;
      const seed = deriveSeed(
        map.surfaceSeed,
        'forest-surface',
        1,
        map.decoration.character,
        map.decoration.revision,
        x,
        y,
      );
      if (
        hearth &&
        ((x === hearth.x && y === hearth.y) ||
          [downwind, sideways].some(
            (offset) => offset && x === hearth.x + offset[0] && y === hearth.y + offset[1],
          )) &&
        (!occupied.has(tile) || (x === hearth.x && y === hearth.y))
      ) {
        patches.push({
          x: x + 0.5 + Math.sign(hearth.x - x) * 0.25,
          y: y + 0.5 + Math.sign(hearth.y - y) * 0.25,
          kind: 'ash',
          seed,
        });
        continue;
      }
      if (occupied.has(tile) || camp.some((reserve) => areaContains(reserve.area, point))) continue;
      // Keep drifts off the contour's inner stroke and the entire carved path.
      if (
        (
          [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const
        ).some(([dx, dy]) => !isWalkable(map.layout, x + dx, y + dy))
      )
        continue;
      const nearby = trees.some((tree) => Math.hypot(tree.x - x, tree.y - y) <= 2.8);
      const random = new Random(seed);
      if (random.next() > (nearby ? 0.65 : 0.07)) continue;
      patches.push({
        x: x + 0.5,
        y: y + 0.5,
        seed,
        kind:
          map.decoration.character === 'Pines'
            ? 'needles'
            : map.decoration.character === 'Fey'
              ? 'petals'
              : 'leaves',
      });
    }
  return patches;
}

const leafColors: Readonly<Record<ForestCharacter, readonly string[]>> = {
  Verdant: ['#8c9a5480', '#b6ad7180', '#748a5080'],
  Autumn: ['#bb8438b0', '#a9502ba0', '#d3a84aa0', '#8f6039a0'],
  Pines: ['#a58e5680', '#887950a0', '#b19d6a80'],
  Fey: ['#dab4d5a0', '#c1cfeda0', '#e2c8b590'],
};

export function drawForestSurface(ctx: DrawingContext, map: ForestClearing): void {
  for (const patch of forestSurfacePatches(map)) {
    const random = new Random(patch.seed);
    ctx.save();
    ctx.translate(patch.x, patch.y);
    if (patch.kind === 'ash') {
      const haze = ctx.createRadialGradient(0, 0, 0.015, 0, 0, 0.22);
      haze.addColorStop(0, '#65685a28');
      haze.addColorStop(1, '#65685a00');
      ctx.fillStyle = haze;
      ctx.beginPath();
      ctx.ellipse(0, 0, 0.22, 0.17, random.next(), 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 13; i++) {
        const x = (random.next() - 0.5) * 0.36,
          y = (random.next() - 0.5) * 0.32;
        ctx.fillStyle = i % 3 === 0 ? '#2d352d60' : '#aaa68e55';
        ctx.fillRect(x, y, 0.013 + random.next() * 0.025, 0.009 + random.next() * 0.014);
      }
    } else {
      const colors = leafColors[map.decoration.character];
      const count = patch.kind === 'needles' ? 12 : map.decoration.character === 'Autumn' ? 9 : 6;
      for (let i = 0; i < count; i++) {
        ctx.save();
        ctx.translate((random.next() - 0.5) * 0.57, (random.next() - 0.5) * 0.57);
        ctx.rotate(random.next() * Math.PI * 2);
        const color = colors[random.int(0, colors.length - 1)] ?? colors[0] ?? '#a7956280';
        if (patch.kind === 'needles') {
          ctx.strokeStyle = color;
          ctx.lineWidth = 0.012;
          ctx.beginPath();
          ctx.moveTo(-0.07, 0);
          ctx.lineTo(0.09, 0.012);
          ctx.moveTo(-0.07, 0);
          ctx.lineTo(0.07, -0.033);
          ctx.stroke();
        } else if (patch.kind === 'petals') {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.ellipse(0, 0, 0.05 + random.next() * 0.018, 0.026, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#e6d7dd50';
          ctx.lineWidth = 0.009;
          ctx.beginPath();
          ctx.moveTo(-0.035, 0);
          ctx.lineTo(0.02, 0.003);
          ctx.stroke();
        } else {
          const length = 0.065 + random.next() * 0.035;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(-length, 0);
          ctx.quadraticCurveTo(-0.01, -0.07, length, 0);
          ctx.quadraticCurveTo(0.01, 0.065, -length, 0);
          ctx.fill();
          ctx.strokeStyle = map.decoration.character === 'Autumn' ? '#d8b36f65' : '#bbc08a55';
          ctx.lineWidth = 0.009;
          ctx.beginPath();
          ctx.moveTo(-length + 0.015, 0);
          ctx.lineTo(length * 0.8, 0);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    ctx.restore();
  }
}
