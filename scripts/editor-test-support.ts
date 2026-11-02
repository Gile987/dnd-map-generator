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
