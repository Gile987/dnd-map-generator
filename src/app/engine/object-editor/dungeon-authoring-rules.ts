import { transformedGroup } from './group-rotation';
import { indexOf } from '../model';
import type { Dungeon, Prop } from '../model';
import { areaAround } from '../feature-reservation';
import { dungeonCapability } from './catalog';
import { dungeonGroups } from './dungeon-groups';
import type { DungeonGroup } from './dungeon-groups';
import type { DungeonDocument } from './document';

/** Authored maps protect architecture itself, not the generator's corridor sampling buffer. */
export function dungeonArchitectureCells(base: Dungeon): ReadonlySet<number> {
  const cells = new Set<number>();
  for (const marker of [base.layout.entrance, base.layout.objective]) {
    const area = areaAround(marker, 1, 1);
    for (let y = area.y; y < area.y + area.height; y++)
      for (let x = area.x; x < area.x + area.width; x++) cells.add(indexOf(x, y));
  }
  for (const door of base.layout.thresholds)
    for (let i = 0; i < door.span; i++) {
      const x = door.x + (door.axis === 'horizontal' ? i : 0),
        y = door.y + (door.axis === 'vertical' ? i : 0);
      cells.add(indexOf(x, y));
      cells.add(
        indexOf(x - (door.axis === 'vertical' ? 1 : 0), y - (door.axis === 'horizontal' ? 1 : 0)),
      );
    }
  return cells;
}

export function individualObjectLock(base: Dungeon, id: string, prop: Prop): string | undefined {
  const group = dungeonGroups(base).find((g) => g.members.includes(id));
  if (group) return `Move ${group.label} as a complete addition.`;
  const capability = dungeonCapability(prop.kind);
  return capability?.editable ? undefined : (capability?.reason ?? 'This object is protected.');
}

export function currentDungeonGroups(
  base: Dungeon,
  document: DungeonDocument,
): readonly DungeonGroup[] {
  const moves = document.objectEdits?.groups ?? [];
  return dungeonGroups(base).map((group) =>
    transformedGroup(
      group,
      moves.find((move) => move.id === group.id),
    ),
  );
}
