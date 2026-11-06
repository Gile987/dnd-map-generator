import type { Tower } from '../tower';
import type { ArrangementAdapter } from './arrangement';
import type { TowerGroupId } from './tower-document';
import { towerBase, towerGroups, towerInstances, orderedTowerObjects } from './tower-document';
import {
  towerSelections,
  towerObjectLock,
  towerPlacementError,
  towerCommandError,
  towerEditorPosition,
} from './tower-rules';
import { towerCapability, isTowerSurface } from './tower-catalog';
export const TOWER_EDITOR: ArrangementAdapter<Tower, TowerGroupId> = {
  base: towerBase,
  groups: towerGroups,
  instances: towerInstances,
  ordered: orderedTowerObjects,
  selections: towerSelections,
  lock: towerObjectLock,
  capability: towerCapability,
  surface: isTowerSurface,
  rotatable: () => true,
  placementError: towerPlacementError,
  validPosition: towerEditorPosition,
  commandError: towerCommandError,
  unsupportedObject: 'That object cannot be added individually to a tower.',
  unsupportedRotation: 'Choose a quarter-turn of a complete Tower addition.',
};
