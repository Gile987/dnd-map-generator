import { expect, test } from 'vitest';
import { placeLayerLabels } from './layer-label-layout';

test('nearby and edge labels remain within a narrow viewport and cannot intercept one another', () => {
  const anchors = Array.from({ length: 12 }, (_, i) => ({
    id: String(i),
    x: 300 + (i % 3),
    y: 160 + (i % 2),
  }));
  const before = structuredClone(anchors);
  const labels = placeLayerLabels(anchors, 337, 410, 96, 28, 6);
  expect(labels).toHaveLength(anchors.length);
  expect(placeLayerLabels(anchors, 337, 410, 96, 28, 6)).toEqual(labels);
  expect(anchors).toEqual(before);
  for (const a of labels) {
    expect(a.x).toBeGreaterThanOrEqual(48);
    expect(a.x).toBeLessThanOrEqual(337 - 48);
    expect(a.y).toBeGreaterThanOrEqual(14);
    expect(a.y).toBeLessThanOrEqual(410 - 14);
    for (const b of labels.filter((b) => b.id !== a.id))
      expect(Math.abs(a.x - b.x) >= 102 || Math.abs(a.y - b.y) >= 34).toBe(true);
  }
});

test('a full or undersized viewport omits labels so callers can offer a list fallback', () => {
  expect(placeLayerLabels([{ id: 'a', x: 0, y: 0 }], 80, 26, 96, 28, 6)).toEqual([]);
  const labels = placeLayerLabels(
    [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 0, y: 0 },
    ],
    96,
    28,
    96,
    28,
    6,
  );
  expect(labels.map((label) => label.id)).toEqual(['a']);
});
