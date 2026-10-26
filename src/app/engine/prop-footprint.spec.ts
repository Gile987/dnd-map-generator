import { expect, test } from 'vitest';
import type { Prop, QuarterTurn } from './model';
import { propBounds, propCells, propFootprintError } from './prop-footprint';

const table: Prop = {
  x: 4,
  y: 5,
  kind: 'dining_table',
  blocking: true,
  variation: 0.3,
  footprint: { width: 2, height: 1 },
  rotation: 0,
};

test.each([0, 1, 2, 3] as const)(
  'rotation %s has the exact two occupied tiles anchored at x/y',
  (rotation) => {
    const prop = { ...table, rotation };
    expect(propFootprintError(prop)).toBeUndefined();
    expect(propCells(prop)).toEqual(
      rotation % 2 === 0
        ? [
            { x: 4, y: 5 },
            { x: 5, y: 5 },
          ]
        : [
            { x: 4, y: 5 },
            { x: 4, y: 6 },
          ],
    );
    expect(propBounds(prop)).toEqual({
      x: 4,
      y: 5,
      width: rotation % 2 ? 1 : 2,
      height: rotation % 2 ? 2 : 1,
    });
  },
);

test('legacy one-tile props retain their implicit footprint; unsupported or malformed metadata is rejected', () => {
  const crate: Prop = { x: 4, y: 5, kind: 'crate', blocking: true, variation: 0.3 };
  expect(propCells(crate)).toEqual([{ x: 4, y: 5 }]);
  expect(propFootprintError(crate)).toBeUndefined();
  expect(propFootprintError({ ...crate, rotation: 0 })).toBeDefined();
  expect(propFootprintError({ ...table, footprint: undefined })).toBeDefined();
  expect(propFootprintError({ ...table, rotation: undefined })).toBeDefined();
  for (const rotation of [-1, 0.5, 4, NaN, Infinity])
    expect(propFootprintError({ ...table, rotation: rotation as QuarterTurn })).toBeDefined();
  for (const width of [0, 1, 2.5, 40, Infinity])
    expect(propFootprintError({ ...table, footprint: { width, height: 1 } })).toBeDefined();
});
