import {
  courtyardBase,
  courtyardGroups,
  courtyardInstances,
  orderedCourtyardObjects,
} from './courtyard-document';
import {
  courtyardSelections,
  courtyardObjectLock,
  courtyardPlacementError,
} from './courtyard-rules';
import { courtyardCapability, isCourtyardSurface } from './courtyard-catalog';
import type { RuinedCourtyard } from '../model';
import type { CourtyardGroupId } from './courtyard-document';
import type { ArrangementAdapter } from './arrangement';
export const COURTYARD_EDITOR: ArrangementAdapter<RuinedCourtyard, CourtyardGroupId> = {
  base: courtyardBase,
  groups: courtyardGroups,
  instances: courtyardInstances,
  ordered: orderedCourtyardObjects,
  selections: courtyardSelections,
  lock: courtyardObjectLock,
  capability: courtyardCapability,
  surface: isCourtyardSurface,
  rotatable: (id) => id !== 'fountain',
  placementError: courtyardPlacementError,
  unsupportedObject: 'That object cannot be added individually to a courtyard.',
  unsupportedRotation: 'Only the complete wagon supports quarter-turn rotation.',
};
