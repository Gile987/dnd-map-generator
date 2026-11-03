import type { DungeonGroupId } from '../src/app/engine/object-editor/dungeon-groups';
import { dungeonGroups } from '../src/app/engine/object-editor/dungeon-groups';
import { dungeonInstances } from '../src/app/engine/object-editor/document';
import { individualObjectLock } from '../src/app/engine/object-editor/dungeon-authoring-rules';
import { QUARTER_TURNS } from '../src/app/engine/prop-footprint';
import { generateDungeon } from '../src/app/engine/generate';
import type { Dungeon, DungeonDocument, Point } from '../src/app/engine/model';
import { applyObjectCommand } from '../src/app/engine/object-editor/commands';
import type { ObjectCommand } from '../src/app/engine/object-editor/commands';
export function editorFixture(
  preset: import('../src/app/engine/model').DecorationPreset = 'Mosslit',
): Dungeon {
  const result = generateDungeon({
    seed: 'mosslit-sanctum',
    roomCount: 6,
    density: 'Balanced',
    preset,
  });
  if (!result.ok) throw new Error(result.error);
  return result.map;
}
export function validCommand(
  document: DungeonDocument,
  make: (point: Point) => ObjectCommand,
  skip?: Point,
): ObjectCommand {
  for (let y = 1; y < 29; y++)
    for (let x = 1; x < 39; x++) {
      if (skip?.x === x && skip.y === y) continue;
      const command = make({ x, y });
      const result = applyObjectCommand(document, command);
      if (result.ok && result.document !== document) return command;
    }
  throw new Error('No eligible placement in fixture');
}

export function rotationFixture(id: DungeonGroupId) {
  const options = {
    study: { scene: 'Forgotten study' as const },
    statue: { landmark: 'weathered-statue' as const },
    table: { furniture: 'dining-table' as const },
    ritual: { ritual: true },
  }[id];
  const result = generateDungeon({
    seed: 'mosslit-sanctum',
    roomCount: 6,
    density: 'Balanced',
    preset: 'Mosslit',
    ...options,
  });
  if (!result.ok) throw Error(result.error);
  const base = result.map,
    group = dungeonGroups(base).find((g) => g.id === id);
  if (!group) throw Error('Missing group');
  let prepared: DungeonDocument = base;
  for (const item of dungeonInstances(base))
    if (!individualObjectLock(base, item.id, item.prop)) {
      const removed = applyObjectCommand(prepared, { kind: 'remove', id: item.id });
      if (!removed.ok) throw Error(removed.error);
      prepared = removed.document;
    }
  for (let y = 1; y < 29; y++)
    for (let x = 1; x < 39; x++) {
      if (
        !QUARTER_TURNS.every(
          (rotation) =>
            applyObjectCommand(prepared, { kind: 'move-group', id, target: { x, y }, rotation }).ok,
        )
      )
        continue;
      return { base, prepared, group, target: { x, y } };
    }
  throw Error('Fixture needs room for all four turns');
}
