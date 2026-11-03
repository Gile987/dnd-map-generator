import type { Prop, PropKind } from '../model';
import { areasOverlap } from '../feature-reservation';
import { authoredObjectArea } from './object-geometry';

/** Explicit surface semantics: passable candles and offerings are still objects. */
export function isDungeonSurface(kind: PropKind): boolean {
  return kind === 'rug' || kind === 'moss';
}

export function dungeonObjectsCollide(a: Prop, b: Prop): boolean {
  if (!areasOverlap(authoredObjectArea(a), authoredObjectArea(b))) return false;
  const surfaceA = isDungeonSurface(a.kind),
    surfaceB = isDungeonSurface(b.kind);
  return (!surfaceA && !surfaceB) || (surfaceA && surfaceB && a.kind === b.kind);
}
