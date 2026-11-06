import { expect, test } from 'vitest';
import { inversePoint, viewportTransform, areaViewport } from './viewport-transform';

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

test.each([
  [1200, 740],
  [375, 500],
  [800, 420],
])(
  'selected Tower floor framing keeps its center and corners in the viewport at %i × %i',
  (width, height) => {
    const columns = 48,
      rows = 54,
      area = { x: 17, y: 40, width: 14, height: 13 },
      view = areaViewport(width, height, columns, rows, area),
      transform = viewportTransform(width, height, columns, rows, view.zoom, view.pan);
    expect(view.zoom).toBeGreaterThan(1);
    expect(view.zoom).toBeLessThanOrEqual(4);
    expect(transform.x + (area.x + area.width / 2) * transform.scale).toBeCloseTo(width / 2);
    expect(transform.y + (area.y + area.height / 2) * transform.scale).toBeCloseTo(height / 2);
    expect(transform.x + area.x * transform.scale).toBeGreaterThan(0);
    expect(transform.y + area.y * transform.scale).toBeGreaterThan(0);
    expect(transform.x + (area.x + area.width) * transform.scale).toBeLessThan(width);
    expect(transform.y + (area.y + area.height) * transform.scale).toBeLessThan(height);
  },
);
