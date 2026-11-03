import type { Point, Prop, QuarterTurn } from '../model';
import type { ReservedArea } from '../feature-reservation';
import { propBounds } from '../prop-footprint';
import type { DungeonGroup, GroupMove } from './dungeon-groups';

export interface GroupTransform extends GroupMove {
  /** Clockwise quarter turns relative to the immutable generated arrangement. */
  readonly rotation: QuarterTurn;
}
export function quarterTurn(value: number): QuarterTurn {
  return (((value % 4) + 4) % 4) as QuarterTurn;
}
export function groupRotation(move?: GroupMove | GroupTransform): QuarterTurn {
  return move && 'rotation' in move ? move.rotation : 0;
}
/** Rotate continuous local coordinates inside a rectangle, anchored at its top left. */
export function rotateGroupPoint(point: Point, area: ReservedArea, rotation: QuarterTurn): Point {
  switch (rotation) {
    case 0:
      return point;
    case 1:
      return { x: area.height - point.y, y: point.x };
    case 2:
      return { x: area.width - point.x, y: area.height - point.y };
    case 3:
      return { x: point.y, y: area.width - point.x };
  }
}
export function transformedGroup(
  group: DungeonGroup,
  move?: GroupMove | GroupTransform,
): DungeonGroup {
  const rotation = groupRotation(move),
    sideways = rotation % 2 === 1;
  return {
    ...group,
    area: {
      x: move?.x ?? group.area.x,
      y: move?.y ?? group.area.y,
      width: sideways ? group.area.height : group.area.width,
      height: sideways ? group.area.width : group.area.height,
    },
  };
}
export function transformedGroupProp(
  prop: Prop,
  group: DungeonGroup,
  move: GroupMove | GroupTransform,
): Prop {
  const rotation = groupRotation(move),
    bounds = propBounds(prop);
  const corners = [
    { x: bounds.x - group.area.x, y: bounds.y - group.area.y },
    { x: bounds.x - group.area.x + bounds.width, y: bounds.y - group.area.y + bounds.height },
  ].map((point) => rotateGroupPoint(point, group.area, rotation));
  const first = corners[0],
    last = corners[1];
  if (!first || !last) throw Error('Missing group bounds');
  return {
    ...prop,
    x: move.x + Math.min(first.x, last.x),
    y: move.y + Math.min(first.y, last.y),
    ...(prop.footprint ? { rotation: quarterTurn((prop.rotation ?? 0) + rotation) } : {}),
  };
}
