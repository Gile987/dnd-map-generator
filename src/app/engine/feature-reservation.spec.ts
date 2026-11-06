import { expect, test } from 'vitest';
import {
  areaAround,
  areaContains,
  areasOverlap,
  shapeContains,
  shapesOverlap,
} from './feature-reservation';
import { generateForestClearing } from './forest-generate';
import { placeStoneCircle } from './forest-landmark';
import type { Prop } from './model';

test('reserved tile areas use half-open bounds and permit adjacent features', () => {
  const area = areaAround({ x: 10, y: 10 }, 3, 2);
  expect(area).toEqual({ x: 7, y: 8, width: 7, height: 5 });
  expect(areaContains(area, { x: 13, y: 12 })).toBe(true);
  expect(areaContains(area, { x: 14, y: 12 })).toBe(false);
  expect(areasOverlap(area, { x: 14, y: 8, width: 1, height: 1 })).toBe(false);
  expect(areasOverlap(area, { x: 13, y: 12, width: 1, height: 1 })).toBe(true);
  expect(areasOverlap({ x: 13, y: 12, width: 1, height: 1 }, area)).toBe(true);
});

test('landmarks protect an arbitrary feature and its empty space without knowing its prop kinds', () => {
  const result = generateForestClearing({
    seed: 'mosslit-sanctum',
    character: 'Verdant',
    density: 'Balanced',
  });
  if (!result.ok) throw new Error(result.error);
  const base = result.map;
  const first = placeStoneCircle(base.layout, base.decoration.props, base.seed, 'Balanced', 0);
  if (!first) throw new Error('Expected a circle');
  const centerOf = (props: readonly Prop[]) => {
    const stones = props.filter((p) => p.kind === 'standing_stone');
    return {
      x: stones.reduce((n, p) => n + p.x, 0) / 6,
      y: stones.reduce((n, p) => n + p.y, 0) / 6,
    };
  };
  const center = centerOf(first);
  const area = areaAround(center, 3, 3);
  const fern: Prop = { ...center, kind: 'fern', blocking: false, variation: 0.5 };
  const props = [...base.decoration.props.filter((p) => !areaContains(area, p)), fern];
  const reservation = { area, props: [fern] };
  const snapshot = structuredClone({ props, reservation });
  const placed = placeStoneCircle(base.layout, props, base.seed, 'Balanced', 0, [reservation]);
  if (!placed) throw new Error('Expected another suitable circle position');
  expect(placed).toContain(fern);
  expect(areasOverlap(area, areaAround(centerOf(placed), 3, 3))).toBe(false);
  expect({ props, reservation }).toEqual(snapshot);
  expect(
    placeStoneCircle(base.layout, props, base.seed, 'Balanced', 0, [
      { area: { x: 0, y: 0, width: 40, height: 30 }, props: [] },
    ]),
  ).toBeUndefined();
});

test('continuous footprints permit empty corners and touching edges while rejecting real intersections in either order', () => {
  const circle = { kind: 'circle' as const, x: 0, y: 0, radius: 1 };
  for (const [rectangle, overlaps] of [
    [{ kind: 'rectangle' as const, x: 0.8, y: 0.8, width: 1, height: 1 }, false],
    [{ kind: 'rectangle' as const, x: 1, y: -0.5, width: 1, height: 1 }, false],
    [{ kind: 'rectangle' as const, x: 0.5, y: 0.5, width: 1, height: 1 }, true],
    [{ kind: 'rectangle' as const, x: -2, y: -2, width: 4, height: 4 }, true],
  ] as const) {
    expect(shapesOverlap(circle, rectangle)).toBe(overlaps);
    expect(shapesOverlap(rectangle, circle)).toBe(overlaps);
  }
  expect(shapesOverlap(circle, { ...circle, x: 2 })).toBe(false);
  expect(shapesOverlap(circle, { ...circle, x: 1.9 })).toBe(true);
  expect(shapesOverlap(circle, { ...circle, radius: 0.1 })).toBe(true);
  expect(
    shapesOverlap(
      { kind: 'rectangle', x: 0, y: 0, width: 1, height: 1 },
      { kind: 'rectangle', x: 1, y: 0, width: 1, height: 1 },
    ),
  ).toBe(false);
  expect(shapeContains(circle, { x: 0.9, y: 0.9 })).toBe(false);
  expect(shapeContains(circle, { x: 0, y: 0.9 })).toBe(true);
});
