import { expect, test } from 'vitest';
import { inversePoint, viewportTransform } from './viewport-transform';

test('inverse hit testing agrees with painting through fit margins, zoom, pan and resize for normal maps and tower sheets', () => {
  for (const [width, height] of [
    [300, 390],
    [1000, 680],
    [800, 180],
  ] as const)
    for (const [columns, rows] of [
      [40, 30],
      [48, 68],
    ] as const)
      for (const zoom of [0.5, 1, 4])
        for (const pan of [
          { x: 0, y: 0 },
          { x: 9000, y: -9000 },
          { x: 15, y: 42 },
        ]) {
          const t = viewportTransform(width, height, columns, rows, zoom, pan);
          for (const point of [
            { x: 0, y: 0 },
            { x: 12.5, y: 18.75 },
            { x: columns, y: rows },
          ]) {
            const actual = inversePoint(t, {
              x: t.x + point.x * t.scale,
              y: t.y + point.y * t.scale,
            });
            expect(actual.x).toBeCloseTo(point.x, 10);
            expect(actual.y).toBeCloseTo(point.y, 10);
          }
        }
});
