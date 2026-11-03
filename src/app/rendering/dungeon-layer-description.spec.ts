import { expect, test } from 'vitest';
import { describeDungeonLayer } from './dungeon-layer-description';
import type { AddedObject } from '../engine/object-editor/document';
import { isBlockingProp } from '../engine/model';
import type { DungeonPropKind } from '../engine/model';

function items(kinds: readonly DungeonPropKind[]): readonly AddedObject[] {
  return kinds.map((kind, i) => ({
    id: `added-${i + 1}`,
    prop: { kind, x: 5, y: 5, blocking: isBlockingProp(kind), variation: 0.5 },
  }));
}
test('names single and mixed underlying objects in inspection order without mutating input', () => {
  const objects = items(['barrel', 'crate']),
    before = structuredClone(objects);
  expect(describeDungeonLayer(objects, ['added-1'])).toEqual({
    text: 'Barrel underneath',
    description: 'Barrel underneath',
  });
  expect(describeDungeonLayer(objects, ['added-1', 'added-2'])).toEqual({
    text: 'Crate + Barrel underneath',
    description: 'Crate, Barrel underneath',
  });
  expect(objects).toEqual(before);
});
test('combines repeated names and retains every kind in the full description of a large stack', () => {
  const objects = items(['rug', 'crate', 'barrel', 'barrel']);
  expect(describeDungeonLayer(objects, ['added-3', 'added-4'])).toEqual({
    text: 'Barrel × 2 underneath',
    description: 'Barrel × 2 underneath',
  });
  expect(
    describeDungeonLayer(
      objects,
      objects.map((item) => item.id),
    ),
  ).toEqual({
    text: 'Barrel × 2 + 2 more underneath',
    description: 'Barrel × 2, Crate, Rug underneath',
  });
});
test('long object names stay compact without omitting names from the full description', () => {
  const objects = items(['weathered_statue', 'broken_column']);
  expect(
    describeDungeonLayer(
      objects,
      objects.map((item) => item.id),
    ),
  ).toEqual({
    text: 'Broken column + 1 more underneath',
    description: 'Broken column, Weathered statue underneath',
  });
  expect(describeDungeonLayer(objects, [])).toEqual({
    text: 'No objects underneath',
    description: 'No objects underneath',
  });
});
