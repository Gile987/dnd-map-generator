import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from 'vitest';
import { forestGroupFixture, acceptForest } from '../../../scripts/forest-editor-test-support';
import { resolveForest } from '../engine/object-editor/forest-document';
import { drawForestCampAsh, drawForestSurface, forestSurfacePatches } from './forest-surface';

test('camp preview draws only its owned ash with the exact accepted surface pixels at each turn', () => {
  const { prepared, target } = forestGroupFixture('camp');
  for (const rotation of [0, 1, 2, 3] as const) {
    const map = acceptForest(prepared, { kind: 'move-group', id: 'camp', target, rotation }),
      drawing = resolveForest(map);
    const all = createCanvas(1280, 960),
      ghost = createCanvas(1280, 960),
      a = all.getContext('2d'),
      g = ghost.getContext('2d');
    a.setTransform(32, 0, 0, 32, 0, 0);
    g.setTransform(32, 0, 0, 32, 0, 0);
    drawForestSurface(a, drawing);
    drawForestCampAsh(g, drawing);
    const patches = forestSurfacePatches(drawing),
      ash = patches.filter((p) => p.kind === 'ash');
    expect(ash.length).toBeGreaterThan(0);
    for (const patch of ash) {
      const x = Math.floor((patch.x - 0.24) * 32),
        y = Math.floor((patch.y - 0.24) * 32);
      expect(g.getImageData(x, y, 16, 16).data).toEqual(a.getImageData(x, y, 16, 16).data);
    }
    const pixels = g.getImageData(0, 0, 1280, 960).data;
    let occupied = 0;
    for (let y = 0; y < 960; y++)
      for (let x = 0; x < 1280; x++)
        if (pixels[(y * 1280 + x) * 4 + 3]) {
          occupied++;
          expect(
            ash.some(
              (p) => Math.abs((x + 0.5) / 32 - p.x) < 0.3 && Math.abs((y + 0.5) / 32 - p.y) < 0.3,
            ),
          ).toBe(true);
        }
    expect(occupied).toBeGreaterThan(10);
  }
});
