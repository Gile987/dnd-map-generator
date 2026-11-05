import type { ForestClearing } from '../model';
import type { AuthoredForest } from './forest-document';
import { FOREST_EDITOR } from './forest-adapter';
import { parseArrangementEdits } from './parse-arrangement-edits';
export function parseForestEdits(base: ForestClearing, value: unknown): AuthoredForest | undefined {
  return parseArrangementEdits(base, value, FOREST_EDITOR);
}
