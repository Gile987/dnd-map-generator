import type { RuinedCourtyard } from '../model';
import type { AuthoredCourtyard } from './courtyard-document';
import { COURTYARD_EDITOR } from './courtyard-adapter';
import { parseArrangementEdits } from './parse-arrangement-edits';
export function parseCourtyardEdits(
  base: RuinedCourtyard,
  value: unknown,
): AuthoredCourtyard | undefined {
  return parseArrangementEdits(base, value, COURTYARD_EDITOR);
}
