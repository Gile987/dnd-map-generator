import type { CourtyardDocument } from './courtyard-document';
import { COURTYARD_EDITOR } from './courtyard-adapter';
import { proposeArrangementCommand, applyArrangementCommand } from './arrangement-commands';
import type { ObjectCommand, ObjectEditResult } from './object-command';
export type CourtyardEditResult = ObjectEditResult<CourtyardDocument>;
export function proposeCourtyardCommand(
  map: CourtyardDocument,
  command: ObjectCommand,
): CourtyardEditResult {
  return proposeArrangementCommand(map, command, COURTYARD_EDITOR);
}
export function applyCourtyardCommand(
  map: CourtyardDocument,
  command: ObjectCommand,
): CourtyardEditResult {
  return applyArrangementCommand(map, command, COURTYARD_EDITOR);
}
