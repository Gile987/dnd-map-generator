import type { RuinedCourtyard } from '../model';
import type { AuthoredCourtyard } from './courtyard-document';
import { COURTYARD_EDITOR } from './courtyard-adapter';
import { parseArrangementEdits } from './parse-arrangement-edits';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Courtyard sidecars exist in frozen version 1 and version 2; the version 2
 * vocabulary adds the stone-well group and nothing else. Other versions stay
 * rejected.
 */
export function parseCourtyardEdits(
  base: RuinedCourtyard,
  value: unknown,
  allowedKinds?: readonly string[],
): AuthoredCourtyard | undefined {
  if (record(value) && value['version'] === 2) {
    const authored = parseArrangementEdits(base, value, COURTYARD_EDITOR, {
      allowedVersion: 2,
      allowedKinds,
    });
    if (!authored) return undefined;
    return { ...authored, objectEdits: { ...authored.objectEdits, version: 2 as const } };
  }
  return parseArrangementEdits(base, value, COURTYARD_EDITOR, { allowedKinds });
}
