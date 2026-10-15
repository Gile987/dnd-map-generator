import { HEIGHT, WIDTH, isFloor } from '../engine/model';
import type { Dungeon, Layout, Point } from '../engine/model';
import { Random, hashSeed } from '../engine/random';
import { drawProp, path } from './props';
import type { DrawingContext } from './props';

export interface RenderOptions {
  readonly grid: boolean;
  readonly pixelsPerTile: number;
}

interface Edge {
  readonly a: Point;
  readonly b: Point;
}

function boundaries(layout: Layout): Edge[][] {
  const edges: Edge[] = [];
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (!isFloor(layout, x, y)) continue;
      if (!isFloor(layout, x, y - 1)) edges.push({ a: { x, y }, b: { x: x + 1, y } });
      if (!isFloor(layout, x + 1, y)) edges.push({ a: { x: x + 1, y }, b: { x: x + 1, y: y + 1 } });
      if (!isFloor(layout, x, y + 1)) edges.push({ a: { x: x + 1, y: y + 1 }, b: { x, y: y + 1 } });
      if (!isFloor(layout, x - 1, y)) edges.push({ a: { x, y: y + 1 }, b: { x, y } });
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

function floors(ctx: DrawingContext, map: Dungeon): void {
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (!isFloor(map.layout, x, y)) continue;
      const rng = new Random(hashSeed(`${map.surfaceSeed}:${x}:${y}`));
      const tone = rng.int(-8, 9);
      ctx.fillStyle = `rgb(${115 + tone} ${135 + tone} ${140 + tone})`;
      ctx.fillRect(x, y, 1, 1);
      const slabs = rng.next() < 0.3 ? 2 : 1;
      for (let slab = 0; slab < slabs; slab++) {
        const sx = x + 0.025;
        const sy = y + slab / slabs + 0.025;
        const w = 0.95;
        const h = 1 / slabs - 0.05;
        const c = rng.next() * 0.055;
        path(
          ctx,
          [
            [sx + c, sy],
            [sx + w - 0.04, sy + c],
            [sx + w, sy + h - 0.025],
            [sx + 0.025, sy + h],
          ],
          `rgba(188,202,191,${0.035 + rng.next() * 0.09})`,
          '#334b4e35',
        );
        ctx.strokeStyle = '#c9d5c13b';
        ctx.lineWidth = 0.017;
        ctx.beginPath();
        ctx.moveTo(sx + 0.03, sy + h - 0.05);
        ctx.lineTo(sx + 0.015, sy + 0.02);
        ctx.lineTo(sx + w - 0.08, sy + 0.02);
        ctx.stroke();
      }
      ctx.lineWidth = 0.01;
      for (let fleck = 0; fleck < 7; fleck++) {
        ctx.fillStyle = fleck % 2 ? '#d6dfc91c' : '#233d3a19';
        ctx.fillRect(x + rng.next(), y + rng.next(), 0.015 + rng.next() * 0.03, 0.012);
      }
      if (rng.next() < 0.17) {
        const cx = x + 0.2 + rng.next() * 0.6;
        const cy = y + 0.18;
        ctx.strokeStyle = '#344d505c';
        ctx.lineWidth = 0.014;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx - 0.06, cy + 0.2);
        ctx.lineTo(cx + 0.08, cy + 0.34);
        ctx.lineTo(cx + 0.02, cy + 0.55);
        ctx.moveTo(cx + 0.08, cy + 0.34);
        ctx.lineTo(cx + 0.24, cy + 0.39);
        ctx.stroke();
      }
    }
  }
}

function walls(ctx: DrawingContext, layout: Layout): void {
  const loops = boundaries(layout);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.save();
  ctx.translate(0.1, 0.16);
  trace(ctx, loops);
  ctx.strokeStyle = '#0a171dc0';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
  trace(ctx, loops);
  ctx.strokeStyle = '#12252a';
  ctx.lineWidth = 0.64;
  ctx.stroke();
  trace(ctx, loops);
  ctx.strokeStyle = '#40545e';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.save();
  ctx.translate(-0.085, -0.085);
  trace(ctx, loops);
  ctx.strokeStyle = '#8a9e9b';
  ctx.lineWidth = 0.047;
  ctx.stroke();
  ctx.restore();
  for (const loop of loops) {
    for (const edge of loop) {
      const horizontal = edge.a.y === edge.b.y;
      const dx = edge.b.x - edge.a.x;
      const dy = edge.b.y - edge.a.y;
      for (const t of [0.15, 0.8]) {
        const x = edge.a.x + dx * t;
        const y = edge.a.y + dy * t;
        ctx.strokeStyle = '#1c343d';
        ctx.lineWidth = 0.022;
        ctx.beginPath();
        ctx.moveTo(x + (horizontal ? 0 : -0.22), y + (horizontal ? -0.22 : 0));
        ctx.lineTo(x + (horizontal ? 0 : 0.22), y + (horizontal ? 0.22 : 0));
        ctx.stroke();
        ctx.strokeStyle = '#8fa3a24d';
        ctx.lineWidth = 0.014;
        ctx.beginPath();
        ctx.moveTo(x + (horizontal ? 0.025 : -0.18), y + (horizontal ? -0.18 : 0.025));
        ctx.lineTo(x + (horizontal ? 0.025 : 0.18), y + (horizontal ? 0.18 : 0.025));
        ctx.stroke();
      }
    }
  }
}

function architecture(ctx: DrawingContext, map: Dungeon): void {
  for (const door of map.layout.thresholds) {
    ctx.save();
    ctx.translate(door.x, door.y);
    if (door.axis === 'vertical') ctx.rotate(Math.PI / 2);
    ctx.fillStyle = '#35494c';
    ctx.fillRect(0.1, -0.15, 1.8, 0.3);
    ctx.fillStyle = '#a4936f';
    ctx.fillRect(0.18, -0.085, 1.64, 0.17);
    ctx.strokeStyle = '#c6b994';
    ctx.lineWidth = 0.02;
    for (const x of [0.24, 0.75, 1.25, 1.76]) {
      ctx.beginPath();
      ctx.moveTo(x, -0.07);
      ctx.lineTo(x, 0.07);
      ctx.stroke();
    }
    for (const x of [0, 1.83]) {
      ctx.fillStyle = '#2e4249';
      ctx.fillRect(x, -0.29, 0.17, 0.58);
      ctx.fillStyle = '#8d9f97';
      ctx.fillRect(x, -0.29, 0.17, 0.06);
    }
    ctx.restore();
  }
  const { entrance, objective } = map.layout;
  ctx.save();
  ctx.translate(entrance.x + 0.5, entrance.y + 0.5);
  ctx.fillStyle = '#253a40';
  ctx.fillRect(-0.82, -0.82, 1.64, 1.64);
  for (let i = 0; i < 6; i++) {
    const y = -0.76 + i * 0.25;
    const c = 63 + i * 11;
    ctx.fillStyle = `rgb(${c} ${c + 21} ${c + 24})`;
    ctx.fillRect(-0.75, y, 1.5, 0.23);
    ctx.fillStyle = '#b1c0b085';
    ctx.fillRect(-0.75, y, 1.5, 0.027);
  }
  ctx.strokeStyle = '#bdc9b27a';
  ctx.lineWidth = 0.04;
  ctx.strokeRect(-0.82, -0.82, 1.64, 1.64);
  ctx.restore();
  ctx.save();
  ctx.translate(objective.x + 0.5, objective.y + 0.5);
  ctx.fillStyle = '#2c454a70';
  ctx.beginPath();
  ctx.arc(0.04, 0.1, 1.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#82968f';
  ctx.beginPath();
  ctx.arc(0, 0, 1.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#b9c7ad';
  ctx.lineWidth = 0.035;
  ctx.stroke();
  ctx.strokeStyle = '#425e5e';
  ctx.beginPath();
  ctx.arc(0, 0, 0.89, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 4);
    ctx.fillStyle = '#c0b485';
    ctx.fillRect(-0.025, -0.98, 0.05, 0.14);
    ctx.restore();
  }
  path(
    ctx,
    [
      [-0.55, -0.35],
      [0.55, -0.35],
      [0.65, 0.35],
      [-0.65, 0.35],
    ],
    '#394f52',
    '#b5bda1',
  );
  ctx.fillStyle = '#a4b2a0';
  ctx.fillRect(-0.58, -0.36, 1.16, 0.2);
  path(
    ctx,
    [
      [0, -0.48],
      [0.17, -0.23],
      [0, 0.02],
      [-0.17, -0.23],
    ],
    '#8bbaa2',
    '#c8dbc0',
  );
  ctx.restore();
}

export function renderDungeon(ctx: DrawingContext, map: Dungeon, options: RenderOptions): void {
  ctx.save();
  ctx.setTransform(options.pixelsPerTile, 0, 0, options.pixelsPerTile, 0, 0);
  ctx.fillStyle = '#18272e';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const background = new Random(map.surfaceSeed);
  for (let i = 0; i < 2200; i++) {
    ctx.fillStyle = i % 2 ? '#7b91900a' : '#000b100d';
    ctx.fillRect(
      background.next() * WIDTH,
      background.next() * HEIGHT,
      0.04 + background.next() * 0.16,
      0.025,
    );
  }
  floors(ctx, map);
  walls(ctx, map.layout);
  for (const prop of map.decoration.props.filter(
    (prop) => prop.kind === 'rug' || prop.kind === 'moss',
  ))
    drawProp(ctx, prop);
  architecture(ctx, map);
  for (const prop of map.decoration.props.filter(
    (prop) => prop.kind !== 'rug' && prop.kind !== 'moss',
  ))
    drawProp(ctx, prop);
  for (const prop of map.decoration.props.filter((prop) => prop.kind === 'sconce')) {
    const x = prop.x + 0.5;
    const y = prop.y - 0.07;
    const glow = ctx.createRadialGradient(x, y, 0.05, x, y, 2.25);
    glow.addColorStop(0, '#ffd68b40');
    glow.addColorStop(0.35, '#e8b4651c');
    glow.addColorStop(1, '#e8b46500');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 2.25, y - 2.25, 4.5, 4.5);
  }
  if (options.grid) {
    ctx.beginPath();
    ctx.lineWidth = 0.012;
    ctx.strokeStyle = '#b6c7bf23';
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
