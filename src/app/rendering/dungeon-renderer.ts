import { HEIGHT, WIDTH, isFloor } from '../engine/model';
import type { DecorationPreset, Dungeon, Layout } from '../engine/model';
import { Random, deriveSeed } from '../engine/random';
import { drawProp } from './props';
import { drawGrid, path } from './drawing-primitives';
import type { DrawingContext } from './drawing-context';
import type { RenderOptions } from './render-options';
import { boundaryLoops, traceBoundaries } from './boundaries';

interface Atmosphere {
  readonly background: string;
  readonly floorBase: readonly [number, number, number];
  readonly floorSlab: readonly [number, number, number];
  readonly sconceGlow: readonly [number, number, number];
  readonly sconceRadius: number;
  readonly sconceAlpha: number;
}

const atmospheres: Readonly<Record<DecorationPreset, Atmosphere>> = {
  Mosslit: {
    background: '#18272e',
    floorBase: [115, 135, 140],
    floorSlab: [188, 202, 191],
    sconceGlow: [255, 214, 139],
    sconceRadius: 2.25,
    sconceAlpha: 0.25,
  },
  Crypt: {
    background: '#131e24',
    floorBase: [100, 118, 126],
    floorSlab: [165, 180, 178],
    sconceGlow: [220, 190, 120],
    sconceRadius: 1.7,
    sconceAlpha: 0.16,
  },
  Storehouse: {
    background: '#1e2628',
    floorBase: [125, 130, 128],
    floorSlab: [195, 195, 175],
    sconceGlow: [255, 210, 130],
    sconceRadius: 2.4,
    sconceAlpha: 0.28,
  },
  Sanctuary: {
    background: '#162824',
    floorBase: [108, 138, 128],
    floorSlab: [175, 205, 185],
    sconceGlow: [230, 220, 150],
    sconceRadius: 2.0,
    sconceAlpha: 0.2,
  },
};

function floors(ctx: DrawingContext, map: Dungeon): void {
  const atmo = atmospheres[map.decoration.preset];
  const [baseR, baseG, baseB] = atmo.floorBase;
  const [slabR, slabG, slabB] = atmo.floorSlab;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (!isFloor(map.layout, x, y)) continue;
      const rng = new Random(deriveSeed(map.surfaceSeed, x, y));
      const tone = rng.int(-8, 9);
      ctx.fillStyle = `rgb(${baseR + tone} ${baseG + tone} ${baseB + tone})`;
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
          `rgba(${slabR},${slabG},${slabB},${0.035 + rng.next() * 0.09})`,
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
  const loops = boundaryLoops(layout);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.save();
  ctx.translate(0.1, 0.16);
  traceBoundaries(ctx, loops);
  ctx.strokeStyle = '#0a171dc0';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
  traceBoundaries(ctx, loops);
  ctx.strokeStyle = '#12252a';
  ctx.lineWidth = 0.64;
  ctx.stroke();
  traceBoundaries(ctx, loops);
  ctx.strokeStyle = '#40545e';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.save();
  ctx.translate(-0.085, -0.085);
  traceBoundaries(ctx, loops);
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
  const atmo = atmospheres[map.decoration.preset];
  ctx.save();
  ctx.setTransform(options.pixelsPerTile, 0, 0, options.pixelsPerTile, 0, 0);
  ctx.fillStyle = atmo.background;
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
    const [gr, gg, gb] = atmo.sconceGlow;
    const glow = ctx.createRadialGradient(x, y, 0.05, x, y, atmo.sconceRadius);
    glow.addColorStop(0, `rgba(${gr},${gg},${gb},${atmo.sconceAlpha})`);
    glow.addColorStop(0.35, `rgba(${gr},${gg},${gb},${atmo.sconceAlpha * 0.44})`);
    glow.addColorStop(1, `rgba(${gr},${gg},${gb},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(
      x - atmo.sconceRadius,
      y - atmo.sconceRadius,
      atmo.sconceRadius * 2,
      atmo.sconceRadius * 2,
    );
  }
  if (options.grid) drawGrid(ctx, '#b6c7bf23', options.gridOpacity);
  ctx.restore();
}
