import { HEIGHT, WIDTH, indexOf, isWalkable } from '../engine/model';
import type { ForestClearing, ForestLayout, Point } from '../engine/model';
import { Random, deriveSeed } from '../engine/random';
import { drawProp } from './props';
import type { DrawingContext } from './props';

export interface ForestRenderOptions {
  readonly grid: boolean;
  readonly pixelsPerTile: number;
}

interface Edge {
  readonly a: Point;
  readonly b: Point;
}

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

function forestFloor(ctx: DrawingContext, map: ForestClearing): void {
  const routeSet = new Set(map.layout.route);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const rng = new Random(deriveSeed(map.surfaceSeed, x, y));
      if (isWalkable(map.layout, x, y)) {
        const tone = rng.int(-6, 7);
        const isPath = isPathTile(map.layout, x, y, routeSet);
        if (isPath) {
          const r = 148 + tone + rng.int(-3, 3);
          const g = 128 + tone + rng.int(-3, 3);
          const b = 82 + tone + rng.int(-3, 3);
          ctx.fillStyle = `rgb(${r} ${g} ${b})`;
          ctx.fillRect(x, y, 1, 1);
          if (rng.next() < 0.3) {
            ctx.fillStyle = `rgba(120, 105, 70, ${0.1 + rng.next() * 0.15})`;
            ctx.fillRect(x + rng.next() * 0.6, y + rng.next() * 0.6, 0.15 + rng.next() * 0.2, 0.1);
          }
        } else {
          const r = 68 + tone;
          const g = 110 + tone + rng.int(0, 8);
          const b = 48 + tone;
          ctx.fillStyle = `rgb(${r} ${g} ${b})`;
          ctx.fillRect(x, y, 1, 1);
          for (let blade = 0; blade < 5; blade++) {
            const bx = x + rng.next();
            const by = y + rng.next();
            ctx.strokeStyle = `rgba(${85 + rng.int(0, 30)}, ${130 + rng.int(0, 25)}, ${55 + rng.int(0, 20)}, 0.3)`;
            ctx.lineWidth = 0.012;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + (rng.next() - 0.5) * 0.08, by - 0.06 - rng.next() * 0.08);
            ctx.stroke();
          }
          if (rng.next() < 0.12) {
            ctx.fillStyle = `rgba(95, 145, 65, ${0.1 + rng.next() * 0.1})`;
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
        const r = 26 + tone;
        const g = 42 + tone + rng.int(0, 5);
        const b = 22 + tone;
        ctx.fillStyle = `rgb(${r} ${g} ${b})`;
        ctx.fillRect(x, y, 1, 1);
        if (rng.next() < 0.25) {
          ctx.fillStyle = `rgba(${20 + rng.int(0, 15)}, ${35 + rng.int(0, 15)}, ${18 + rng.int(0, 10)}, ${0.3 + rng.next() * 0.3})`;
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

function clearingEdges(ctx: DrawingContext, layout: ForestLayout): void {
  const loops = boundaries(layout);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.save();
  ctx.translate(0.06, 0.1);
  trace(ctx, loops);
  ctx.strokeStyle = '#0a1a0a80';
  ctx.lineWidth = 0.55;
  ctx.stroke();
  ctx.restore();

  trace(ctx, loops);
  ctx.strokeStyle = '#1e3a1e';
  ctx.lineWidth = 0.42;
  ctx.stroke();

  trace(ctx, loops);
  ctx.strokeStyle = '#4a7a3a';
  ctx.lineWidth = 0.32;
  ctx.stroke();

  ctx.save();
  ctx.translate(-0.06, -0.06);
  trace(ctx, loops);
  ctx.strokeStyle = '#8ab87a50';
  ctx.lineWidth = 0.035;
  ctx.stroke();
  ctx.restore();
}

export function renderForest(
  ctx: DrawingContext,
  map: ForestClearing,
  options: ForestRenderOptions,
): void {
  ctx.save();
  ctx.setTransform(options.pixelsPerTile, 0, 0, options.pixelsPerTile, 0, 0);

  ctx.fillStyle = '#142414';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const bgNoise = new Random(map.surfaceSeed);
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = i % 2 ? '#1e3e1e0c' : '#0a1a0a0d';
    ctx.fillRect(
      bgNoise.next() * WIDTH,
      bgNoise.next() * HEIGHT,
      0.05 + bgNoise.next() * 0.15,
      0.03,
    );
  }

  forestFloor(ctx, map);
  clearingEdges(ctx, map.layout);

  const underProps = map.decoration.props.filter(
    (prop) =>
      prop.kind === 'fern' ||
      prop.kind === 'mushroom' ||
      prop.kind === 'flower' ||
      prop.kind === 'bush',
  );
  for (const prop of underProps) drawProp(ctx, prop);

  const overProps = map.decoration.props.filter(
    (prop) =>
      prop.kind === 'tree' ||
      prop.kind === 'boulder' ||
      prop.kind === 'log' ||
      prop.kind === 'stump',
  );
  for (const prop of overProps) drawProp(ctx, prop);

  if (options.grid) {
    ctx.beginPath();
    ctx.lineWidth = 0.012;
    ctx.strokeStyle = '#8ab87a18';
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
