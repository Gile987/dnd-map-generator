import type { ForestDocument } from './forest-document';
import { FOREST_EDITOR } from './forest-adapter';
import { proposeArrangementCommand, applyArrangementCommand } from './arrangement-commands';
import type { ObjectCommand, ObjectEditResult } from './object-command';
export type ForestEditResult = ObjectEditResult<ForestDocument>;
export function proposeForestCommand(
  map: ForestDocument,
  command: ObjectCommand,
): ForestEditResult {
  return proposeArrangementCommand(map, command, FOREST_EDITOR);
}
export function applyForestCommand(map: ForestDocument, command: ObjectCommand): ForestEditResult {
  return applyArrangementCommand(map, command, FOREST_EDITOR);
}
