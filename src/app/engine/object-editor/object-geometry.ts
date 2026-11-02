import type { Prop } from '../model';
import { areaAround } from '../feature-reservation';
import { propBounds } from '../prop-footprint';

/** Authored-v2 visual occupancy, distinct from movement blocking. */
export function authoredObjectArea(prop: Prop) {
  return prop.kind === 'rug' ? areaAround(prop, 1, 1) : propBounds(prop);
}
