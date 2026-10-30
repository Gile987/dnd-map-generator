import type { GeneratedMap } from '../engine/model';
import { mapDimensions } from '../engine/model';

/** Integer tile bounds retain grid alignment and the floor's heading and wall shadows. */
export function exportBounds(map: GeneratedMap, towerFloor?: number, showSecrets = false) {
  if (towerFloor === undefined) return { x: 0, y: 0, ...mapDimensions(map) };
  if (map.type !== 'tower') throw new Error('Individual floors are available only for towers.');
  const floor = map.layout.floors.find((floor) => floor.number === towerFloor);
  if (!floor) throw new Error('Choose an available tower floor.');
  if (floor.secret && !showSecrets)
    throw new Error('Enable Show secrets to export the secret floor.');
  return { x: floor.x - 1, y: floor.y - 4, width: floor.width + 2, height: floor.height + 5 };
}
