import { DENSITY_BUDGETS, HEIGHT, WIDTH, indexOf, isBlockingProp } from './model';
import type { Density, ForestLayout, Point, Prop, PropKind, ForestPropKind } from './model';
import { Random, shuffleInPlace, streamSeed } from './random';

// Version this additive scene independently so existing forest streams stay intact.
export const CAMP_VERSION = '1.0.0';
export const CAMP_PROP_KINDS: readonly PropKind[] = [
  'tent',
  'bedroll',
  'fire_ring',
  'supply_bundle',
];

// Every object fits within one tile. Two small ridge tents face the shared hearth.
const arrangement: readonly (Point & { readonly kind: ForestPropKind })[] = [
  { x: -2, y: -1, kind: 'tent' },
  { x: 2, y: -1, kind: 'tent' },
  { x: -2, y: 1, kind: 'bedroll' },
  { x: 2, y: 1, kind: 'bedroll' },
  { x: 0, y: 0, kind: 'fire_ring' },
  { x: 1, y: -1, kind: 'supply_bundle' },
];

export function placeCamp(
  layout: ForestLayout,
  props: readonly Prop[],
  seed: string,
  density: Density,
  revision: number,
): readonly Prop[] | undefined {
  const random = new Random(streamSeed(seed, 'forest-camp', CAMP_VERSION, density, revision));
  const route = new Set(layout.route);
  const candidates: Point[] = [];
  for (let y = 3; y < HEIGHT - 3; y++) {
    for (let x = 4; x < WIDTH - 4; x++) {
      let clear = true;
      for (let dy = -2; dy <= 2 && clear; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const tile = indexOf(x + dx, y + dy);
          if (!layout.tiles[tile] || route.has(tile)) {
            clear = false;
            break;
          }
        }
      }
      if (clear) candidates.push({ x, y });
    }
  }
  shuffleInPlace(candidates, random);
  const center = candidates[0];
  if (!center) return undefined;
  const camp = arrangement.map(({ x, y, kind }): Prop => ({
    x: center.x + x,
    y: center.y + y,
    kind,
    blocking: isBlockingProp(kind),
    variation: kind === 'tent' ? (x < 0 ? 0.2 : 0.7) + random.next() * 0.1 : random.next(),
  }));
  const maxBlocking = Math.floor(layout.tiles.filter(Boolean).length * DENSITY_BUDGETS[density]);
  let blockers = camp.filter((prop) => prop.blocking).length;
  const retained = props.filter((prop) => {
    if (Math.abs(prop.x - center.x) <= 3 && Math.abs(prop.y - center.y) <= 2) return false;
    if (prop.blocking && ++blockers > maxBlocking) return false;
    return true;
  });
  return [...retained, ...camp];
}
