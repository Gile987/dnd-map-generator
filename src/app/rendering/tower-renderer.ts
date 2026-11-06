import {
  SPIRAL_STAIR_RADIUS,
  SPIRAL_STAIR_STROKE,
  PORTAL_RADIUS,
  CONNECTION_STROKE,
  towerConnectionCaption,
  towerSeparateStairBody,
} from '../engine/tower-connection-geometry';
import {
  towerFloorCenter,
  TOWER_INNER_WALL_RADIUS,
  TOWER_WALL_STROKE_WIDTH,
} from '../engine/tower-geometry';
import type { TowerDrawing } from '../engine/object-editor/tower-document';
import { orderedObjects } from '../engine/object-editor/drawing-order';
import { drawEditorProp } from './editor-prop';
import type { StairLanding } from '../engine/tower-landings';
import type { TowerStairStyle } from '../engine/tower';
import { towerStairLandings } from '../engine/tower-landings';
import type { TowerFloor } from '../engine/tower';
import { towerFloorAt, towerStairStyle, towerFloorTitle } from '../engine/tower';
import { Random, deriveSeed } from '../engine/random';
import type { DrawingContext } from './drawing-context';
import type { RenderOptions } from './render-options';

function text(
  ctx: DrawingContext,
  value: string,
  x: number,
  y: number,
  size: number,
  color = '#e8ddbd',
): void {
  // Draw text at a normal font size, then scale back into tile coordinates.
  // This avoids subpixel font metrics differing between browser and native Canvas.
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 / 64, 1 / 64);
  ctx.font = `600 ${size * 64}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(value, 0, 0);
  ctx.restore();
}
function circle(
  ctx: DrawingContext,
  x: number,
  y: number,
  r: number,
  fill: string,
  stroke?: string,
): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}
function floorArtwork(ctx: DrawingContext, map: TowerDrawing, f: TowerFloor): void {
  const { x: cx, y: cy } = towerFloorCenter(f);
  ctx.lineWidth = TOWER_WALL_STROKE_WIDTH;
  circle(ctx, cx + 0.12, cy + 0.18, 6.45, '#0b141bc9');
  circle(ctx, cx, cy, 6.35, '#63727b', '#9da395');
  circle(ctx, cx, cy, TOWER_INNER_WALL_RADIUS, '#263941', '#27373c');
  for (let y = f.y; y < f.y + f.height; y++)
    for (let x = f.x; x < f.x + f.width; x++) {
      if (!map.layout.tiles[y * map.layout.width + x]) continue;
      const random = new Random(deriveSeed(map.surfaceSeed, x, y));
      const tone = random.int(-6, 6);
      ctx.fillStyle = `rgb(${91 + tone} ${105 + tone} ${111 + tone})`;
      ctx.fillRect(x + 0.025, y + 0.025, 0.95, 0.95);
      ctx.strokeStyle = '#c2c4af24';
      ctx.lineWidth = 0.025;
      ctx.strokeRect(x + 0.08, y + 0.08, 0.84, 0.84);
      for (let j = 0; j < 5; j++) {
        ctx.fillStyle = j % 2 ? '#152b3033' : '#d4cfb229';
        ctx.fillRect(x + 0.1 + random.next() * 0.8, y + 0.1 + random.next() * 0.8, 0.04, 0.025);
      }
    }
  // Curved masonry cap and radial joints make the shared tower footprint clear.
  ctx.strokeStyle = '#bac0ad';
  ctx.lineWidth = 0.055;
  ctx.beginPath();
  ctx.arc(cx, cy, 6.22, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 32; i++) {
    const a = (i * Math.PI) / 16;
    ctx.strokeStyle = '#34464b';
    ctx.lineWidth = 0.055;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 5.97, cy + Math.sin(a) * 5.97);
    ctx.lineTo(cx + Math.cos(a) * 6.32, cy + Math.sin(a) * 6.32);
    ctx.stroke();
  }
  // A faded compass rose gives the central encounter space a restrained focal point.
  ctx.strokeStyle = f.secret ? '#ab99bf59' : '#c7bb8a45';
  ctx.lineWidth = 0.045;
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 0.6, cy + Math.sin(a) * 0.6);
    ctx.lineTo(cx + Math.cos(a) * 1.8, cy + Math.sin(a) * 1.8);
    ctx.stroke();
  }
}
export function drawTowerStaircase(
  ctx: DrawingContext,
  landing: StairLanding,
  style: TowerStairStyle,
): void {
  if (style === 'separate') {
    for (const route of landing.routes)
      drawTowerConnection(
        ctx,
        'stairs',
        route.id,
        landing,
        route.destination,
        route.direction === 'up',
      );
    return;
  }
  const x = landing.x + 0.5,
    y = landing.y + 0.5;
  ctx.lineWidth = SPIRAL_STAIR_STROKE;
  circle(ctx, x + 0.08, y + 0.1, 1.02, '#0a171ba6');
  circle(ctx, x, y, SPIRAL_STAIR_RADIUS, '#303f44', '#d4c59f');
  for (let i = 0; i < 13; i++) {
    const start = -Math.PI / 2 + (i * Math.PI * 2) / 14,
      end = start + (Math.PI * 2) / 14 - 0.025;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(start) * 0.22, y + Math.sin(start) * 0.22);
    ctx.lineTo(x + Math.cos(start) * 0.87, y + Math.sin(start) * 0.87);
    ctx.arc(x, y, 0.87, start, end);
    ctx.lineTo(x + Math.cos(end) * 0.22, y + Math.sin(end) * 0.22);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? '#b5ad90' : '#8c927f';
    ctx.fill();
  }
  circle(ctx, x, y, 0.2, '#dccba3', '#626d61');
  ctx.fillStyle = '#18272ded';
  const caption = towerConnectionCaption(landing, 'spiral', landing.routes.length);
  ctx.fillRect(caption.x, caption.y, caption.width, caption.height);
  for (const [i, route] of landing.routes.entries())
    text(
      ctx,
      `${route.id} ${route.direction === 'up' ? '↑' : '↓'} ${route.destination}`,
      x,
      y + 1.6 + i * 0.75,
      0.6,
      '#efce87',
    );
}
export function renderTower(ctx: DrawingContext, map: TowerDrawing, options: RenderOptions): void {
  ctx.save();
  ctx.setTransform(options.pixelsPerTile, 0, 0, options.pixelsPerTile, 0, 0);
  ctx.fillStyle = '#15232a';
  ctx.fillRect(0, 0, map.layout.width, map.layout.height);
  const floors = map.layout.floors.filter((f) => !f.secret || options.showSecrets === true);
  for (const f of floors) {
    text(
      ctx,
      f.secret ? `SECRET FLOOR ${f.number}` : `FLOOR ${f.number}`,
      f.x + 7,
      f.y - 2.15,
      1,
      f.secret ? '#d9c3f0' : '#dbc795',
    );
    text(ctx, towerFloorTitle(map, f), f.x + 7, f.y - 1.2, 0.48);
    floorArtwork(ctx, map, f);
  }
  const props =
    map.objectEdits === 'resolved'
      ? orderedObjects(map.instances, map.order).map((item) => item.prop)
      : map.decoration.props;
  for (const p of props) {
    const f = towerFloorAt(map, p);
    if (f && (!f.secret || options.showSecrets === true)) drawEditorProp(ctx, p, map);
  }
  if (towerStairStyle(map) === 'spiral')
    for (const landing of towerStairLandings(map)) drawTowerStaircase(ctx, landing, 'spiral');
  for (const c of map.layout.connections) {
    if (c.kind === 'stairs' && towerStairStyle(map) === 'spiral') continue;
    if (c.kind === 'portal' && options.showSecrets !== true) continue;
    for (const [point, destination, up] of [
      [c.departure, c.to, true],
      [c.arrival, c.from, false],
    ] as const)
      drawTowerConnection(ctx, c.kind, c.id, point, destination, up);
  }
  // Grid follows sheet coordinates at the selected VTT resolution; floor plans never rescale.
  if (options.grid) {
    ctx.strokeStyle = '#d7dfd9';
    ctx.globalAlpha = options.gridOpacity ?? 0.15;
    ctx.lineWidth = 0.015;
    ctx.beginPath();
    for (let x = 0; x <= map.layout.width; x++) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, map.layout.height);
    }
    for (let y = 0; y <= map.layout.height; y++) {
      ctx.moveTo(0, y);
      ctx.lineTo(map.layout.width, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawTowerConnection(
  ctx: DrawingContext,
  kind: 'stairs' | 'portal',
  id: string,
  point: { readonly x: number; readonly y: number },
  destination: number,
  up: boolean,
): void {
  const color = kind === 'portal' ? '#ceabe7' : '#efce87';
  const x = point.x + 0.5,
    y = point.y + 0.5;
  ctx.lineWidth = CONNECTION_STROKE;
  if (kind === 'portal') {
    circle(ctx, x, y, PORTAL_RADIUS, '#33284b', '#b397da');
    circle(ctx, x, y, 0.55, '#79659b', '#e3c6f0');
    circle(ctx, x, y, 0.28, '#c8aedb');
  } else {
    ctx.fillStyle = '#25373f';
    const body = towerSeparateStairBody(point);
    ctx.fillRect(body.x, body.y, body.width, body.height);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#c8bb98' : '#8e917f';
      ctx.fillRect(x - 0.65 + i * 0.065, y - 0.82 + i * 0.28, 1.25 - i * 0.13, 0.23);
    }
  }
  ctx.fillStyle = '#18272ded';
  const caption = towerConnectionCaption(point, kind === 'portal' ? 'portal' : 'separate');
  ctx.fillRect(caption.x, caption.y, caption.width, caption.height);
  text(
    ctx,
    `${id} ${kind === 'portal' ? '↔' : up ? '↑' : '↓'} ${destination}`,
    x,
    y + 1.52,
    0.65,
    color,
  );
}
