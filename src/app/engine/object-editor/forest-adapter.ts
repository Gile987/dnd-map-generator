import type { ForestClearing } from '../model';
import type { ArrangementAdapter } from './arrangement';
import type { ForestGroupId } from './forest-document';
import { forestBase, forestGroups, forestInstances, orderedForestObjects } from './forest-document';
import { forestSelections, forestObjectLock, forestPlacementError } from './forest-rules';
import { forestCapability, isForestGroundCover } from './forest-catalog';
export const FOREST_EDITOR: ArrangementAdapter<ForestClearing, ForestGroupId> = {
  base: forestBase,
  groups: forestGroups,
  instances: forestInstances,
  ordered: orderedForestObjects,
  selections: forestSelections,
  lock: forestObjectLock,
  capability: forestCapability,
  surface: isForestGroundCover,
  rotatable: () => true,
  placementError: forestPlacementError,
  unsupportedObject: 'That object cannot be added individually to a forest.',
  unsupportedRotation: 'Choose a quarter-turn of a complete Forest addition.',
};
