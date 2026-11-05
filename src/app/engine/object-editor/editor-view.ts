import { forestCapability, FOREST_PALETTE } from './forest-catalog';
import { forestInstances, resolveForest, orderedForestObjects } from './forest-document';
import { forestSelections } from './forest-rules';
import { courtyardCapability, COURTYARD_PALETTE } from './courtyard-catalog';
import {
  courtyardInstances,
  resolveCourtyard,
  orderedCourtyardObjects,
} from './courtyard-document';
import { courtyardSelections } from './courtyard-rules';
import { dungeonCapability, DUNGEON_PALETTE_V2 } from './catalog';
import { dungeonInstances, resolveDungeon } from './document';
import type { EditableMapDocument } from './document';
import type { MapDocument, PropKind } from '../model';
import { dungeonSelections } from './dungeon-selection';
import type { ObjectSelection } from './object-selection';
import { orderedDungeonObjects } from './dungeon-drawing-order';
import { objectOverlaps, stepObjectOrder } from './drawing-order';

export interface EditorSelection extends ObjectSelection {
  readonly groupId?: string;
  readonly rotatable: boolean;
}
export function isEditableMap(map: MapDocument): map is EditableMapDocument {
  return map.type === 'dungeon' || map.type === 'courtyard' || map.type === 'forest';
}
export function editorInstances(map: EditableMapDocument) {
  return map.type === 'dungeon'
    ? dungeonInstances(map)
    : map.type === 'forest'
      ? forestInstances(map)
      : courtyardInstances(map);
}
export function editorSelections(map: EditableMapDocument): readonly EditorSelection[] {
  const selections =
    map.type === 'dungeon'
      ? dungeonSelections(map)
      : map.type === 'forest'
        ? forestSelections(map)
        : courtyardSelections(map);
  return selections.map((item) => ({
    ...item,
    rotatable: !!item.groupId && item.groupId !== 'fountain',
  }));
}
export function editorPalette(map: EditableMapDocument) {
  return map.type === 'dungeon'
    ? DUNGEON_PALETTE_V2
    : map.type === 'forest'
      ? FOREST_PALETTE
      : COURTYARD_PALETTE;
}
export function editorObjectLabel(map: EditableMapDocument, kind: PropKind): string {
  return (
    (map.type === 'dungeon'
      ? dungeonCapability(kind, 2)
      : map.type === 'forest'
        ? forestCapability(kind)
        : courtyardCapability(kind)
    )?.label ?? kind
  );
}
export function editorOrderedObjects(map: EditableMapDocument) {
  return map.type === 'dungeon'
    ? orderedDungeonObjects(
        dungeonInstances(map),
        map.objectEdits?.version === 5 ? map.objectEdits.order : [],
      )
    : map.type === 'forest'
      ? orderedForestObjects(map)
      : orderedCourtyardObjects(map);
}
export function editorOverlaps(map: EditableMapDocument) {
  return objectOverlaps(editorOrderedObjects(map), editorSelections(map));
}
export function editorOrderStep(
  map: EditableMapDocument,
  id: string,
  direction: 'forward' | 'backward',
) {
  return stepObjectOrder(editorOrderedObjects(map), editorSelections(map), id, direction);
}
export function resolveEditorMap(map: EditableMapDocument) {
  return map.type === 'dungeon'
    ? resolveDungeon(map)
    : map.type === 'forest'
      ? resolveForest(map)
      : resolveCourtyard(map);
}
