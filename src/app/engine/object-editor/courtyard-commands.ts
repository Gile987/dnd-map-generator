import type { CourtyardEditsV2, CourtyardDocument } from './courtyard-document';
import { courtyardBase } from './courtyard-document';
import { COURTYARD_EDITOR } from './courtyard-adapter';
import { proposeArrangementCommand } from './arrangement-commands';
import type { AuthoredArrangement } from './arrangement';
import type { ObjectCommand, ObjectEditResult } from './object-command';
import type { RuinedCourtyard } from '../model';

/** Project version-2 sidecars to the shared version-1 arrangement reducer;
 * the well adds no extra fields, so only the marker needs reinstating.
 */
function courtyardArrangementReducerInput(
  map: CourtyardDocument,
): RuinedCourtyard | AuthoredArrangement<RuinedCourtyard, 'fountain' | 'wagon' | 'well'> {
  if (!map.objectEdits) return courtyardBase(map);
  return {
    ...map,
    objectEdits: { ...map.objectEdits, version: 1 },
  } as AuthoredArrangement<RuinedCourtyard, 'fountain' | 'wagon' | 'well'>;
}

export type CourtyardEditResult = ObjectEditResult<CourtyardDocument>;
export function proposeCourtyardCommand(
  map: CourtyardDocument,
  command: ObjectCommand,
): CourtyardEditResult {
  if (command.kind === 'reset')
    return { ok: true, document: map.objectEdits ? courtyardBase(map) : map };
  const objects = courtyardArrangementReducerInput(map),
    result = proposeArrangementCommand(objects, command, COURTYARD_EDITOR);
  if (!result.ok) return result;
  if (result.document === objects) return { ok: true, document: map };
  // Well documents carry the version-2 sidecar vocabulary; other edits keep
  // the incoming sidecar version, and fresh edits stay version 1 (tower
  // precedent: only features that add sidecar fields force a bump).
  const version = courtyardBase(map).decoration.well ? 2 : (map.objectEdits?.version ?? 1);
  if (version === 1) return { ok: true, document: result.document };
  return {
    ok: true,
    document: {
      ...courtyardBase(map),
      objectEdits: { ...(result.document.objectEdits ?? {}), version: 2 } as CourtyardEditsV2,
    },
  };
}

export function applyCourtyardCommand(
  map: CourtyardDocument,
  command: ObjectCommand,
): CourtyardEditResult {
  const input = courtyardArrangementReducerInput(map),
    result = proposeCourtyardCommand(map, command);
  if (!result.ok || result.document === map) return result;
  const error =
    COURTYARD_EDITOR.commandError?.(input, command) ??
    COURTYARD_EDITOR.placementError(
      result.document as AuthoredArrangement<RuinedCourtyard, 'fountain' | 'wagon' | 'well'>,
    );
  return error ? { ok: false, error } : result;
}
