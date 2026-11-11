import { WIDTH, indexOf } from './model';
import type { CourtyardLayout, Prop } from './model';
import { gridDistances } from './grid-traversal';
import { Random, shuffleInPlace, streamSeed } from './random';

export function placeAbandonedBrazier(
  layout: CourtyardLayout,
  seed: string,
  reserved: ReadonlySet<number>,
  blocked: ReadonlySet<number>,
): Prop | undefined {
  const random = new Random(streamSeed(seed, 'courtyard-brazier', 'v1'));
  const candidates: { x: number; y: number }[] = [];
  const bounds = layout.bounds;
  for (let y = bounds.y + 1; y < bounds.y + bounds.height - 1; y++)
    for (let x = bounds.x + 1; x < bounds.x + bounds.width - 1; x++) {
      const tile = indexOf(x, y);
      if (!layout.tiles[tile] || reserved.has(tile) || blocked.has(tile)) continue;
      const neighbors = [
        indexOf(x - 1, y),
        indexOf(x + 1, y),
        indexOf(x, y - 1),
        indexOf(x, y + 1),
      ];
      if (!neighbors.some((neighbor) => !layout.tiles[neighbor])) continue;
      if (neighbors.some((neighbor) => blocked.has(neighbor))) continue;
      candidates.push({ x, y });
    }
  shuffleInPlace(candidates, random);
  const open = layout.tiles.filter(Boolean).length;
  for (const candidate of candidates) {
    const tile = indexOf(candidate.x, candidate.y);
    const candidateBlocked = new Set([...blocked, tile]);
    const firstFree = layout.tiles.findIndex(
      (floor, index) => floor && !candidateBlocked.has(index),
    );
    if (
      firstFree < 0 ||
      gridDistances(
        layout.tiles,
        { x: firstFree % WIDTH, y: Math.floor(firstFree / WIDTH) },
        candidateBlocked,
      ).size !==
        open - candidateBlocked.size
    )
      continue;
    return {
      ...candidate,
      kind: 'abandoned_brazier',
      blocking: true,
      variation: random.next(),
    };
  }
  return undefined;
}
