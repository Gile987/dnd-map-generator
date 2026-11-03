import type { Layout, Point, Threshold } from './model';
import type { DungeonDocument, MapDocument } from './object-editor/document';

/** Missing state means the historical closed artwork; only open doors are stored. */
export interface DoorStates {
  readonly version: 1;
  readonly open: readonly string[];
}
export interface DoorToggleRequest {
  readonly source: MapDocument;
  readonly id: string;
}
export function dungeonDoorId(door: Pick<Threshold, 'axis' | 'x' | 'y'>): string {
  return `door-${door.axis}-${door.x}-${door.y}`;
}
export function dungeonDoors(
  layout: Layout,
): readonly { readonly id: string; readonly threshold: Threshold }[] {
  const seen = new Set<string>();
  return layout.thresholds.flatMap((threshold) => {
    const id = dungeonDoorId(threshold);
    if (seen.has(id)) return [];
    seen.add(id);
    return [{ id, threshold }];
  });
}
export function doorIsOpen(map: { readonly doorStates?: DoorStates }, id: string): boolean {
  return map.doorStates?.open.includes(id) ?? false;
}
/** Nearest opening wins when generous screen-sized targets overlap. */
export function dungeonDoorAt(layout: Layout, point: Point, padding = 0.4): string | undefined {
  let closest: string | undefined,
    distance = padding;
  for (const { id, threshold: door } of dungeonDoors(layout)) {
    const along = door.axis === 'horizontal' ? point.x - door.x : point.y - door.y;
    const across = door.axis === 'horizontal' ? point.y - door.y : point.x - door.x;
    const d = Math.hypot(Math.max(-along, 0, along - door.span), across);
    if (Number.isFinite(d) && d <= distance) {
      closest = id;
      distance = d;
    }
  }
  return closest;
}
export function parseDoorStates(layout: Layout, value: unknown): DoorStates | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const state = value as Record<string, unknown>,
    available = new Set(dungeonDoors(layout).map((door) => door.id));
  if (
    Object.keys(state).some((key) => key !== 'version' && key !== 'open') ||
    state['version'] !== 1 ||
    !Array.isArray(state['open']) ||
    !state['open'].length ||
    state['open'].length > available.size
  )
    return undefined;
  const open: string[] = [];
  const seen = new Set<string>();
  for (const id of state['open']) {
    if (typeof id !== 'string' || !available.has(id) || seen.has(id)) return undefined;
    seen.add(id);
    open.push(id);
  }
  return { version: 1, open: open.sort() };
}
export function withDoorStates(document: DungeonDocument, states?: DoorStates): DungeonDocument {
  return states ? { ...document, doorStates: states } : document;
}
export function toggleDungeonDoor(
  document: DungeonDocument,
  id: string,
):
  | { readonly ok: true; readonly document: DungeonDocument }
  | { readonly ok: false; readonly error: string } {
  if (!dungeonDoors(document.layout).some((door) => door.id === id))
    return { ok: false, error: 'That door is not on this map.' };
  const open = new Set(document.doorStates?.open);
  if (open.has(id)) open.delete(id);
  else open.add(id);
  const { doorStates: _old, ...base } = document;
  return {
    ok: true,
    document: open.size ? { ...base, doorStates: { version: 1, open: [...open].sort() } } : base,
  };
}
