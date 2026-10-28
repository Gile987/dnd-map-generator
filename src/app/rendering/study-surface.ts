import { contains, indexOf } from '../engine/model';
import type { Dungeon, Point } from '../engine/model';
import { propCells } from '../engine/prop-footprint';
import { reservedTiles } from '../engine/dungeon-space';
import { Random, deriveSeed } from '../engine/random';
import type { DrawingContext } from './drawing-context';
import { exposedTileBounds } from './floor-artwork';

interface SurfaceMark extends Point {
  readonly kind: 'paper' | 'ink' | 'wear';
  readonly angle: number;
}

/** Derived artwork only: never contributes props, blocking tiles, or generator RNG draws. */
export function studySurfaceMarks(map: Dungeon): readonly SurfaceMark[] {
  if (map.decoration.studySurface !== 1 || map.decoration.scene !== 'Forgotten study') return [];
  const desk = map.decoration.props.find((prop) => prop.kind === 'desk');
  const shelf = map.decoration.props.find((prop) => prop.kind === 'bookshelf');
  const room = desk && map.layout.rooms.find((candidate) => contains(candidate, desk));
  if (!desk || !shelf || !room) return [];
  const occupied = new Set(map.decoration.props.flatMap(propCells).map((p) => indexOf(p.x, p.y)));
  const reserved = reservedTiles(map.layout);
  const random = new Random(
    deriveSeed(map.surfaceSeed, 'study-surface', 1, map.decoration.revision, desk.x, desk.y),
  );
  const marks: SurfaceMark[] = [];
  const nearby: { point: Point; distance: number; order: number }[] = [];
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      if (occupied.has(indexOf(x, y))) continue;
      // Rugs extend beyond their anchor tile; keep scraps on exposed stone.
      if (
        map.decoration.props.some(
          (prop) => prop.kind === 'rug' && Math.abs(x - prop.x) <= 1 && Math.abs(y - prop.y) <= 1,
        )
      )
        continue;
      const point = { x, y };
      const door = map.layout.thresholds.find(
        (threshold) =>
          threshold.roomId === room.id &&
          (threshold.axis === 'horizontal'
            ? x >= threshold.x && x < threshold.x + threshold.span && Math.abs(y - threshold.y) <= 1
            : y >= threshold.y &&
              y < threshold.y + threshold.span &&
              Math.abs(x - threshold.x) <= 1),
      );
      if (door) {
        marks.push({
          x: x + 0.5,
          y: y + 0.5,
          kind: 'wear',
          angle: door.axis === 'horizontal' ? 0 : Math.PI / 2,
        });
      } else if (!reserved.has(indexOf(x, y))) {
        const distance = Math.min(
          Math.hypot(x - desk.x, y - desk.y),
          Math.hypot(x - shelf.x, y - shelf.y),
        );
        if (distance <= 2) nearby.push({ point, distance, order: random.next() });
      }
    }
  }
  nearby.sort((a, b) => a.distance - b.distance || a.order - b.order);
  for (const [i, { point }] of nearby.slice(0, 4).entries()) {
    marks.push({
      x: point.x + 0.4 + random.next() * 0.2,
      y: point.y + 0.4 + random.next() * 0.2,
      kind: i === 2 ? 'ink' : 'paper',
      angle: random.next() * Math.PI * 2,
    });
  }
  return marks.map((mark) => {
    const bounds = exposedTileBounds(map.layout, { x: Math.floor(mark.x), y: Math.floor(mark.y) });
    const radius = mark.kind === 'wear' ? 0.31 : 0.23;
    return {
      ...mark,
      x: Math.max(bounds.left + radius, Math.min(bounds.right - radius, mark.x)),
      y: Math.max(bounds.top + radius, Math.min(bounds.bottom - radius, mark.y)),
    };
  });
}

export function drawStudySurface(ctx: DrawingContext, map: Dungeon): void {
  for (const mark of studySurfaceMarks(map)) {
    ctx.save();
    ctx.translate(mark.x, mark.y);
    ctx.rotate(mark.angle);
    if (mark.kind === 'wear') {
      const random = new Random(deriveSeed(map.surfaceSeed, 'study-wear', 1, mark.x, mark.y));
      const haze = ctx.createRadialGradient(0, 0, 0.02, 0, 0, 0.29);
      haze.addColorStop(0, '#e4d8b322');
      haze.addColorStop(1, '#e4d8b300');
      ctx.fillStyle = haze;
      ctx.beginPath();
      ctx.ellipse(0, 0, 0.25, 0.29, 0, 0, Math.PI * 2);
      ctx.fill();
      // Irregular fine scuffs on softly faded stone, without a repeated tile motif.
      ctx.strokeStyle = '#e4d8b31c';
      ctx.lineWidth = 0.012;
      for (let i = 0; i < 4; i++) {
        const x = -0.17 + random.next() * 0.34;
        const y = -0.2 + random.next() * 0.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (random.next() - 0.5) * 0.07, y + 0.08 + random.next() * 0.12);
        ctx.stroke();
      }
    } else if (mark.kind === 'ink') {
      ctx.fillStyle = '#29363f70';
      for (const [x, y, radius] of [
        [0, 0, 0.1],
        [0.08, 0.04, 0.065],
        [-0.13, 0.09, 0.022],
      ] as const) {
        ctx.beginPath();
        ctx.ellipse(x, y, radius, radius * 0.65, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // No raised shadow: these scraps lie flat on the floor.
      ctx.fillStyle = '#b8ac87';
      ctx.fillRect(-0.12, -0.16, 0.24, 0.32);
      ctx.fillStyle = '#d0c29c';
      ctx.fillRect(-0.105, -0.145, 0.21, 0.285);
      ctx.fillStyle = '#9a8a69';
      ctx.fillRect(0.06, -0.145, 0.045, 0.045);
      ctx.strokeStyle = '#716e5880';
      ctx.lineWidth = 0.012;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-0.07, -0.075 + i * 0.05);
        ctx.lineTo(i % 2 ? 0.045 : 0.075, -0.08 + i * 0.05);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
