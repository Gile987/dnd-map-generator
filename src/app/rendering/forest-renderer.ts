import { HEIGHT, WIDTH, indexOf, isWalkable } from '../engine/model';
import type { ForestCharacter, ForestClearing, ForestLayout, Point } from '../engine/model';
import { Random, deriveSeed } from '../engine/random';
import { drawProp } from './props';
import { FOREST_PALETTES } from './forest-palette';
import type { DrawingContext } from './drawing-context';

export interface ForestRenderOptions {
  readonly grid: boolean;
  readonly pixelsPerTile: number;
}

interface Edge {
  readonly a: Point;
  readonly b: Point;
}

interface ForestAtmosphere {
  readonly background: string;
  readonly noise: readonly [string, string];
  readonly path: readonly [number, number, number];
  readonly grass: readonly [number, number, number];
  readonly grassSpan: number;
  readonly blade: readonly [number, number, number];
  readonly patch: readonly [number, number, number];
  readonly forest: readonly [number, number, number];
  readonly forestSpan: number;
  readonly forestDark: readonly [number, number, number];
  readonly contour: readonly [string, string, string, string];
  readonly grid: string;
}

const atmospheres: Readonly<Record<ForestCharacter, ForestAtmosphere>> = {
  Verdant: {
    background: '#142414',
    noise: ['#1e3e1e0c', '#0a1a0a0d'],
    path: [148, 128, 82],
    grass: [68, 110, 48],
    grassSpan: 8,
    blade: [85, 130, 55],
    patch: [95, 145, 65],
    forest: [26, 42, 22],
    forestSpan: 5,
    forestDark: [20, 35, 18],
    contour: ['#0a1a0a80', '#1e3a1e', '#4a7a3a', '#8ab87a50'],
    grid: '#8ab87a18',
  },
  Autumn: {
    background: '#221a10',
    noise: ['#4e38180c', '#1a10080d'],
    path: [150, 126, 78],
    grass: [104, 96, 42],
    grassSpan: 6,
    blade: [140, 110, 40],
    patch: [168, 96, 36],
    forest: [34, 28, 16],
    forestSpan: 3,
    forestDark: [26, 20, 12],
    contour: ['#1a0e0680', '#3a2412', '#8a5a28', '#d8a86050'],
    grid: '#d8b06018',
  },
  Pines: {
    background: '#101a12',
    noise: ['#1a34220c', '#0a140c0d'],
    path: [146, 128, 88],
    grass: [62, 82, 44],
    grassSpan: 6,
    blade: [70, 96, 48],
    patch: [58, 76, 38],
    forest: [18, 30, 18],
    forestSpan: 4,
    forestDark: [14, 24, 15],
    contour: ['#0a140a80', '#16281a', '#3a5a42', '#7aa88a50'],
    grid: '#9ab8a018',
  },
  Fey: {
    background: '#10241e',
    noise: ['#1e4e3a0c', '#0a1a140d'],
    path: [150, 132, 96],
    grass: [58, 116, 84],
    grassSpan: 10,
    blade: [70, 150, 110],
    patch: [120, 180, 140],
    forest: [18, 38, 30],
    forestSpan: 7,
    forestDark: [14, 30, 24],
    contour: ['#0a1a1480', '#1a3a2e', '#4a8a6a', '#b8e0c850'],
    grid: '#a8e0c018',
  },
};

function boundaries(layout: ForestLayout): Edge[][] {
  const edges: Edge[] = [];
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (!isWalkable(layout, x, y)) continue;
      if (!isWalkable(layout, x, y - 1)) edges.push({ a: { x, y }, b: { x: x + 1, y } });
      if (!isWalkable(layout, x + 1, y))
        edges.push({ a: { x: x + 1, y }, b: { x: x + 1, y: y + 1 } });
      if (!isWalkable(layout, x, y + 1))
        edges.push({ a: { x: x + 1, y: y + 1 }, b: { x, y: y + 1 } });
      if (!isWalkable(layout, x - 1, y)) edges.push({ a: { x, y: y + 1 }, b: { x, y } });
    }
  }
  const pending = new Set(edges);
  const starts = new Map<string, Edge[]>();
  for (const edge of edges) {
    const key = `${edge.a.x},${edge.a.y}`;
    starts.set(key, [...(starts.get(key) ?? []), edge]);
  }
  const loops: Edge[][] = [];
  for (const first of edges) {
    if (!pending.has(first)) continue;
    const loop: Edge[] = [];
    let current: Edge | undefined = first;
    while (current && pending.has(current)) {
      loop.push(current);
      pending.delete(current);
      const dx: number = current.b.x - current.a.x;
      const dy: number = current.b.y - current.a.y;
      const candidates: Edge[] = (starts.get(`${current.b.x},${current.b.y}`) ?? []).filter(
        (edge) => pending.has(edge),
      );
      current =
        candidates.find((edge) => (edge.b.x - edge.a.x) * -dy + (edge.b.y - edge.a.y) * dx > 0) ??
        candidates[0];
    }
    loops.push(loop);
  }
  return loops;
}

function trace(ctx: DrawingContext, loops: readonly (readonly Edge[])[]): void {
  ctx.beginPath();
  for (const loop of loops) {
    const start = loop[0];
    if (!start) continue;
    ctx.moveTo(start.a.x, start.a.y);
    for (const edge of loop) ctx.lineTo(edge.b.x, edge.b.y);
    ctx.closePath();
  }
}

function forestFloor(ctx: DrawingContext, map: ForestClearing, atmo: ForestAtmosphere): void {
  const routeSet = new Set(map.layout.route);
  const [pr, pg, pb] = atmo.path;
  const [gr, gg, gb] = atmo.grass;
  const [br, bl, bb] = atmo.blade;
  const [kr, kg, kb] = atmo.patch;
  const [fr, fg, fb] = atmo.forest;
  const [dr, dg, db] = atmo.forestDark;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const rng = new Random(deriveSeed(map.surfaceSeed, x, y));
      if (isWalkable(map.layout, x, y)) {
        const tone = rng.int(-6, 7);
        const isPath = isPathTile(map.layout, x, y, routeSet);
        if (isPath) {
          const r = pr + tone + rng.int(-3, 3);
          const g = pg + tone + rng.int(-3, 3);
          const b = pb + tone + rng.int(-3, 3);
          ctx.fillStyle = `rgb(${r} ${g} ${b})`;
          ctx.fillRect(x, y, 1, 1);
          if (rng.next() < 0.3) {
            ctx.fillStyle = `rgba(120, 105, 70, ${0.1 + rng.next() * 0.15})`;
            ctx.fillRect(x + rng.next() * 0.6, y + rng.next() * 0.6, 0.15 + rng.next() * 0.2, 0.1);
          }
        } else {
          const r = gr + tone;
          const g = gg + tone + rng.int(0, atmo.grassSpan);
          const b = gb + tone;
          ctx.fillStyle = `rgb(${r} ${g} ${b})`;
          ctx.fillRect(x, y, 1, 1);
          for (let blade = 0; blade < 5; blade++) {
            const bx = x + rng.next();
            const by = y + rng.next();
            ctx.strokeStyle = `rgba(${br + rng.int(0, 30)}, ${bl + rng.int(0, 25)}, ${bb + rng.int(0, 20)}, 0.3)`;
            ctx.lineWidth = 0.012;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + (rng.next() - 0.5) * 0.08, by - 0.06 - rng.next() * 0.08);
            ctx.stroke();
          }
          if (rng.next() < 0.12) {
            ctx.fillStyle = `rgba(${kr}, ${kg}, ${kb}, ${0.1 + rng.next() * 0.1})`;
            ctx.beginPath();
            ctx.ellipse(
              x + 0.2 + rng.next() * 0.6,
              y + 0.2 + rng.next() * 0.6,
              0.08 + rng.next() * 0.12,
              0.04 + rng.next() * 0.06,
              rng.next() * Math.PI,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
        }
      } else {
        const tone = rng.int(-5, 6);
        const r = fr + tone;
        const g = fg + tone + rng.int(0, atmo.forestSpan);
        const b = fb + tone;
        ctx.fillStyle = `rgb(${r} ${g} ${b})`;
        ctx.fillRect(x, y, 1, 1);
        if (rng.next() < 0.25) {
          ctx.fillStyle = `rgba(${dr + rng.int(0, 15)}, ${dg + rng.int(0, 15)}, ${db + rng.int(0, 10)}, ${0.3 + rng.next() * 0.3})`;
          ctx.fillRect(
            x + rng.next() * 0.5,
            y + rng.next() * 0.5,
            0.1 + rng.next() * 0.3,
            0.08 + rng.next() * 0.15,
          );
        }
      }
    }
  }
}

function isPathTile(
  layout: ForestLayout,
  x: number,
  y: number,
  routeSet: ReadonlySet<number>,
): boolean {
  if (!isWalkable(layout, x, y)) return false;
  return routeSet.has(indexOf(x, y));
}

function clearingEdges(
  ctx: DrawingContext,
  layout: ForestLayout,
  contour: readonly [string, string, string, string],
): void {
  const loops = boundaries(layout);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.save();
  ctx.translate(0.06, 0.1);
  trace(ctx, loops);
  ctx.strokeStyle = contour[0];
  ctx.lineWidth = 0.55;
  ctx.stroke();
  ctx.restore();

  trace(ctx, loops);
  ctx.strokeStyle = contour[1];
  ctx.lineWidth = 0.42;
  ctx.stroke();

  trace(ctx, loops);
  ctx.strokeStyle = contour[2];
  ctx.lineWidth = 0.32;
  ctx.stroke();

  ctx.save();
  ctx.translate(-0.06, -0.06);
  trace(ctx, loops);
  ctx.strokeStyle = contour[3];
  ctx.lineWidth = 0.035;
  ctx.stroke();
  ctx.restore();
}

export function renderForest(
  ctx: DrawingContext,
  map: ForestClearing,
  options: ForestRenderOptions,
): void {
  const atmo = atmospheres[map.decoration.character];
  const palette = FOREST_PALETTES[map.decoration.character];
  ctx.save();
  ctx.setTransform(options.pixelsPerTile, 0, 0, options.pixelsPerTile, 0, 0);

  ctx.fillStyle = atmo.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const bgNoise = new Random(map.surfaceSeed);
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = i % 2 ? atmo.noise[0] : atmo.noise[1];
    ctx.fillRect(
      bgNoise.next() * WIDTH,
      bgNoise.next() * HEIGHT,
      0.05 + bgNoise.next() * 0.15,
      0.03,
    );
  }

  forestFloor(ctx, map, atmo);
  clearingEdges(ctx, map.layout, atmo.contour);

  const underProps = map.decoration.props.filter(
    (prop) =>
      prop.kind === 'fern' ||
      prop.kind === 'mushroom' ||
      prop.kind === 'flower' ||
      prop.kind === 'bush',
  );
  for (const prop of underProps) drawProp(ctx, prop, palette);

  const overProps = map.decoration.props.filter(
    (prop) =>
      prop.kind === 'tree' ||
      prop.kind === 'boulder' ||
      prop.kind === 'log' ||
      prop.kind === 'stump',
  );
  for (const prop of overProps) drawProp(ctx, prop, palette);

  if (options.grid) {
    ctx.beginPath();
    ctx.lineWidth = 0.012;
    ctx.strokeStyle = atmo.grid;
    for (let x = 0; x <= WIDTH; x++) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEIGHT);
    }
    for (let y = 0; y <= HEIGHT; y++) {
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
    }
    ctx.stroke();
  }

  ctx.restore();
}
