import type { ObjectSelection } from './object-selection';
import { groupRotation } from './group-rotation';
import { authoredObjectArea } from './object-geometry';
import { dungeonBase, dungeonInstances } from './document';
import type { DungeonDocument } from './document';
import { currentDungeonGroups, individualObjectLock } from './dungeon-authoring-rules';
import { dungeonCapability } from './catalog';
import type { DungeonGroupId } from './dungeon-groups';

export type DungeonSelection = ObjectSelection<DungeonGroupId>;
export function dungeonSelections(document: DungeonDocument): readonly DungeonSelection[] {
  const base = dungeonBase(document),
    items = dungeonInstances(document),
    groups = currentDungeonGroups(base, document);
  return [
    ...groups.map((group) => ({
      id: `group-${group.id}`,
      groupId: group.id,
      rotation: groupRotation(
        document.objectEdits && document.objectEdits.version !== 1
          ? document.objectEdits.groups.find((g) => g.id === group.id)
          : undefined,
      ),
      label: group.label,
      position: group.area,
      area: group.area,
      props: items.filter((item) => group.members.includes(item.id)).map((item) => item.prop),
      members: group.members,
      removable: false,
    })),
    ...items
      .filter((item) => !groups.some((group) => group.members.includes(item.id)))
      .map((item) => ({
        id: item.id,
        label: dungeonCapability(item.prop.kind, 2)?.label ?? item.prop.kind,
        position: item.prop,
        area: authoredObjectArea(item.prop),
        props: [item.prop],
        members: [item.id],
        removable: !individualObjectLock(base, item.id, item.prop),
        lock: individualObjectLock(base, item.id, item.prop),
      })),
  ];
}
