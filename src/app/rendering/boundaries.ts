import { HEIGHT, WIDTH, isFloor } from '../engine/model';
import type { Point } from '../engine/model';
import type { DrawingContext } from './drawing-context';

interface Edge {
  readonly a: Point;
  readonly b: Point;
}

export function boundaryLoops(layout: { readonly tiles: readonly boolean[] }): Edge[][] {
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

export function traceBoundaries(
  ctx: Pick<DrawingContext, 'beginPath' | 'moveTo' | 'lineTo' | 'closePath'>,
  loops: readonly (readonly Edge[])[],
): void {
  ctx.beginPath();
  for (const loop of loops) {
    const start = loop[0];
    if (!start) continue;
    ctx.moveTo(start.a.x, start.a.y);
    for (const edge of loop) ctx.lineTo(edge.b.x, edge.b.y);
    ctx.closePath();
  }
}
