import { applyForestCommand, proposeForestCommand } from './forest-commands';
import { applyObjectCommand, proposeObjectCommand } from './commands';
import { applyCourtyardCommand, proposeCourtyardCommand } from './courtyard-commands';
import type { ObjectCommand, ObjectEditResult } from './object-command';
import type { EditableMapDocument } from './document';

export type MapEditResult = ObjectEditResult<EditableMapDocument>;
export function applyEditorCommand(
  map: EditableMapDocument,
  command: ObjectCommand,
): MapEditResult {
  return map.type === 'dungeon'
    ? applyObjectCommand(map, command)
    : map.type === 'forest'
      ? applyForestCommand(map, command)
      : applyCourtyardCommand(map, command);
}
export function proposeEditorCommand(
  map: EditableMapDocument,
  command: ObjectCommand,
): MapEditResult {
  return map.type === 'dungeon'
    ? proposeObjectCommand(map, command)
    : map.type === 'forest'
      ? proposeForestCommand(map, command)
      : proposeCourtyardCommand(map, command);
}
