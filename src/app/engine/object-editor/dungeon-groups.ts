import { contains } from '../model';
import type { Dungeon, Point, Prop } from '../model';
import { areaAround, areaContains } from '../feature-reservation';
import type { ReservedArea } from '../feature-reservation';
import { propBounds } from '../prop-footprint';
import { ritualCenter } from '../dungeon-ritual';
import { furnitureArea } from '../dungeon-furniture';

export const DUNGEON_GROUP_IDS = ['study', 'statue', 'table', 'ritual'] as const;
export type DungeonGroupId = (typeof DUNGEON_GROUP_IDS)[number];
export interface DungeonGroup {
  readonly id: DungeonGroupId;
  readonly label: string;
  readonly members: readonly string[];
  readonly area: ReservedArea;
}
export interface GroupMove extends Point {
  readonly id: DungeonGroupId;
}

export function dungeonGroups(base: Dungeon): readonly DungeonGroup[] {
  const indexed = base.decoration.props.map((prop, index) => ({ prop, id: `base-${index}` }));
  const groups: DungeonGroup[] = [];
  const desk = indexed.find(({ prop }) => prop.kind === 'desk');
  const studyRoom = desk && base.layout.rooms.find((room) => contains(room, desk.prop));
  if (studyRoom && base.decoration.scene === 'Forgotten study') {
    const members = indexed.filter(
      ({ prop }) =>
        contains(studyRoom, prop) &&
        ['desk', 'bookshelf', 'scroll_case', 'rug'].includes(prop.kind),
    );
    const bounds = members.map(({ prop }) =>
      prop.kind === 'rug' ? areaAround(prop, 1, 1) : propBounds(prop),
    );
    const x = Math.min(...bounds.map((b) => b.x)),
      y = Math.min(...bounds.map((b) => b.y));
    groups.push({
      id: 'study',
      label: 'Forgotten study',
      members: members.map((p) => p.id),
      area: {
        x,
        y,
        width: Math.max(...bounds.map((b) => b.x + b.width)) - x,
        height: Math.max(...bounds.map((b) => b.y + b.height)) - y,
      },
    });
  }
  for (const item of indexed) {
    const p = item.prop;
    if (p.kind === 'weathered_statue')
      groups.push({
        id: 'statue',
        label: 'Weathered statue',
        members: [item.id],
        area: areaAround(p, 2, 2),
      });
    if (p.kind === 'dining_table')
      groups.push({
        id: 'table',
        label: 'Dining table',
        members: [item.id],
        area: furnitureArea(p),
      });
    if (p.kind === 'ritual_altar')
      groups.push({
        id: 'ritual',
        label: 'Ritual site',
        members: indexed.filter(({ prop }) => prop.kind.startsWith('ritual_')).map((p) => p.id),
        area: areaAround(ritualCenter(p), 2, 2),
      });
  }
  return groups;
}

export function translatedGroup(group: DungeonGroup, move?: Point): DungeonGroup {
  return move ? { ...group, area: { ...group.area, x: move.x, y: move.y } } : group;
}
export function groupAt(groups: readonly DungeonGroup[], point: Point): DungeonGroup | undefined {
  return groups.find((group) => areaContains(group.area, point));
}
export function translateGroupProp(prop: Prop, group: DungeonGroup, move: Point): Prop {
  return { ...prop, x: prop.x + move.x - group.area.x, y: prop.y + move.y - group.area.y };
}
