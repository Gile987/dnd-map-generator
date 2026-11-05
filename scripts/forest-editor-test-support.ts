import { generateForestClearing } from '../src/app/engine/forest-generate';
import type { ForestCharacter, ForestSettings, Point } from '../src/app/engine/model';
import type {
  ForestDocument,
  ForestGroupId,
} from '../src/app/engine/object-editor/forest-document';
import { forestGroups, forestInstances } from '../src/app/engine/object-editor/forest-document';
import { forestObjectLock } from '../src/app/engine/object-editor/forest-rules';
import { applyForestCommand } from '../src/app/engine/object-editor/forest-commands';
import type { ObjectCommand } from '../src/app/engine/object-editor/object-command';
import { QUARTER_TURNS } from '../src/app/engine/prop-footprint';
export function forestEditorFixture(
  character: ForestCharacter = 'Verdant',
  changes: Partial<ForestSettings> = {},
) {
  const result = generateForestClearing({
    seed: 'woodland-glade',
    character,
    density: 'Balanced',
    scene: 'Abandoned camp',
    landmark: 'standing-stone-circle',
    fallenTree: true,
    ...changes,
  });
  if (!result.ok) throw Error(result.error);
  return result.map;
}
export function acceptForest(map: ForestDocument, command: ObjectCommand): ForestDocument {
  const result = applyForestCommand(map, command);
  if (!result.ok) throw Error(result.error);
  return result.document;
}
export function clearForest(map: ForestDocument): ForestDocument {
  let current = map;
  for (const item of forestInstances(map))
    if (!forestObjectLock(map, item.id, item.prop))
      current = acceptForest(current, { kind: 'remove', id: item.id });
  return current;
}
export function validForestCommand(
  map: ForestDocument,
  make: (target: Point) => ObjectCommand,
  skip?: Point,
): ObjectCommand {
  for (let y = 0; y < 30; y++)
    for (let x = 0; x < 40; x++) {
      if (x === skip?.x && y === skip.y) continue;
      const command = make({ x, y }),
        result = applyForestCommand(map, command);
      if (result.ok && result.document !== map) return command;
    }
  throw Error('No eligible Forest position');
}
export function forestGroupFixture(id: ForestGroupId, character: ForestCharacter = 'Verdant') {
  const base = forestEditorFixture(character),
    prepared = clearForest(base),
    group = forestGroups(base).find((group) => group.id === id);
  if (!group) throw Error('Missing group');
  for (let y = 0; y < 30; y++)
    for (let x = 0; x < 40; x++) {
      if (x === group.area.x && y === group.area.y) continue;
      if (
        QUARTER_TURNS.every(
          (rotation) =>
            applyForestCommand(prepared, { kind: 'move-group', id, target: { x, y }, rotation }).ok,
        )
      )
        return { base, prepared, group, target: { x, y } };
    }
  throw Error('No complete-group rotation site');
}
