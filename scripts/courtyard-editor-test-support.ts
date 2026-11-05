import { generateCourtyard } from '../src/app/engine/courtyard-generate';
import type { Density, Point } from '../src/app/engine/model';
import { applyCourtyardCommand } from '../src/app/engine/object-editor/courtyard-commands';
import {
  courtyardInstances,
  courtyardGroups,
} from '../src/app/engine/object-editor/courtyard-document';
import type {
  CourtyardDocument,
  CourtyardGroupId,
} from '../src/app/engine/object-editor/courtyard-document';
import { courtyardObjectLock } from '../src/app/engine/object-editor/courtyard-rules';
import type { ObjectCommand } from '../src/app/engine/object-editor/commands';
import { QUARTER_TURNS } from '../src/app/engine/prop-footprint';

export function courtyardEditorFixture(density: Density = 'Balanced') {
  const result = generateCourtyard({ seed: 'ivy-court', density, fountain: true, wagon: true });
  if (!result.ok) throw Error(result.error);
  return result.map;
}
export function acceptCourtyard(
  document: CourtyardDocument,
  command: ObjectCommand,
): CourtyardDocument {
  const result = applyCourtyardCommand(document, command);
  if (!result.ok) throw Error(result.error);
  return result.document;
}
export function clearCourtyard(base: CourtyardDocument): CourtyardDocument {
  let map = base;
  for (const item of courtyardInstances(base))
    if (!courtyardObjectLock(base, item.id, item.prop))
      map = acceptCourtyard(map, { kind: 'remove', id: item.id });
  return map;
}
export function validCourtyardCommand(
  map: CourtyardDocument,
  make: (target: Point) => ObjectCommand,
  skip?: Point,
): ObjectCommand {
  for (let y = 0; y < 30; y++)
    for (let x = 0; x < 40; x++) {
      if (skip?.x === x && skip.y === y) continue;
      const command = make({ x, y }),
        result = applyCourtyardCommand(map, command);
      if (result.ok && result.document !== map) return command;
    }
  throw Error('No eligible Courtyard position');
}
export function courtyardGroupFixture(id: CourtyardGroupId) {
  const base = courtyardEditorFixture(),
    prepared = clearCourtyard(base),
    group = courtyardGroups(base).find((g) => g.id === id);
  if (!group) throw Error('Missing group');
  for (let y = 0; y < 30; y++)
    for (let x = 0; x < 40; x++) {
      if (x === group.area.x && y === group.area.y) continue;
      if (
        (id === 'fountain' ? ([0] as const) : QUARTER_TURNS).every(
          (rotation) =>
            applyCourtyardCommand(prepared, { kind: 'move-group', id, target: { x, y }, rotation })
              .ok,
        )
      )
        return { base, prepared, group, target: { x, y } };
    }
  throw Error('Fixture needs space for the complete group');
}
