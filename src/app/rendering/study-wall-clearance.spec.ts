import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from 'vitest';
import { generateDungeon } from '../engine/generate';
import { contains, isFloor, WIDTH, HEIGHT } from '../engine/model';
import type { Dungeon, Prop } from '../engine/model';
import { renderMap } from './render-map';
import { drawFittedStudyProp } from './study-props';
import { drawProp } from './props';

test.each(['desk', 'bookshelf', 'scroll_case'] as const)(
  '%s sprites fit all walls and corners in every rotation',
  (kind) => {
    const layout = {
      tiles: Array.from(
        { length: WIDTH * HEIGHT },
        (_, i) =>
          i % WIDTH >= 4 &&
          i % WIDTH <= 7 &&
          Math.floor(i / WIDTH) >= 4 &&
          Math.floor(i / WIDTH) <= 7,
      ),
    };
    for (const scale of [64, 100]) {
      for (let turn = 0; turn < 4; turn++) {
        for (const jitter of [0, 0.199]) {
          for (const [x, y] of [
            [4, 4],
            [5, 4],
            [7, 4],
            [4, 5],
            [7, 5],
            [4, 7],
            [5, 7],
            [7, 7],
          ]) {
            if (x === undefined || y === undefined) throw new Error('Missing tile');
            const prop: Prop = {
              x,
              y,
              kind,
              blocking: kind !== 'scroll_case',
              variation: turn / 4 + jitter,
            };
            const before = structuredClone(prop);
            const canvas = createCanvas(3 * scale, 3 * scale);
            const ctx = canvas.getContext('2d');
            ctx.setTransform(scale, 0, 0, scale, (1 - x) * scale, (1 - y) * scale);
            expect(drawFittedStudyProp(ctx, prop, layout)).toBe(true);
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let minX = canvas.width,
              minY = canvas.height,
              maxX = -1,
              maxY = -1;
            for (let i = 3; i < data.length; i += 4) {
              if (!data[i]) continue;
              const p = (i - 3) / 4,
                px = p % canvas.width,
                py = Math.floor(p / canvas.width);
              minX = Math.min(minX, px);
              maxX = Math.max(maxX, px);
              minY = Math.min(minY, py);
              maxY = Math.max(maxY, py);
            }
            expect(maxX).toBeGreaterThan(minX);
            expect(maxY).toBeGreaterThan(minY);
            expect(minX).toBeGreaterThanOrEqual(
              Math.floor((1 + (isFloor(layout, x - 1, y) ? 0 : 0.34)) * scale),
            );
            expect(maxX).toBeLessThan(
              Math.ceil((2 - (isFloor(layout, x + 1, y) ? 0 : 0.34)) * scale),
            );
            expect(minY).toBeGreaterThanOrEqual(
              Math.floor((1 + (isFloor(layout, x, y - 1) ? 0 : 0.34)) * scale),
            );
            expect(maxY).toBeLessThan(
              Math.ceil((2 - (isFloor(layout, x, y + 1) ? 0 : 0.34)) * scale),
            );
            expect(prop).toEqual(before);
          }
        }
      }
    }
  },
);

test('interior study objects retain their original artwork and unrelated props use their usual drawer', () => {
  const layout = { tiles: Array.from({ length: WIDTH * HEIGHT }, () => true) };
  for (const kind of ['desk', 'bookshelf', 'scroll_case'] as const) {
    const prop: Prop = { x: 2, y: 2, kind, blocking: kind !== 'scroll_case', variation: 0.64 };
    const fitted = createCanvas(100, 100),
      original = createCanvas(100, 100);
    fitted.getContext('2d').setTransform(100, 0, 0, 100, -200, -200);
    original.getContext('2d').setTransform(100, 0, 0, 100, -200, -200);
    drawFittedStudyProp(fitted.getContext('2d'), prop, layout);
    drawProp(original.getContext('2d'), prop);
    expect(fitted.toBuffer('image/png')).toEqual(original.toBuffer('image/png'));
  }
  const canvas = createCanvas(100, 100);
  expect(
    drawFittedStudyProp(
      canvas.getContext('2d'),
      { x: 0, y: 0, kind: 'crate', blocking: true, variation: 0 },
      layout,
    ),
  ).toBe(false);
  expect(canvas.getContext('2d').getImageData(0, 0, 100, 100).data.some(Boolean)).toBe(false);
});

test.each([64, 70, 100])(
  'study objects and scraps leave solid walls untouched at %s px/tile',
  (scale) => {
    const result = generateDungeon({
      seed: 'forgotten-library',
      roomCount: 6,
      density: 'Balanced',
      preset: 'Mosslit',
      scene: 'Forgotten study',
    });
    if (!result.ok) throw new Error(result.error);
    const map = result.map;
    const desk = map.decoration.props.find((prop) => prop.kind === 'desk');
    const room = desk && map.layout.rooms.find((room) => contains(room, desk));
    if (!room) throw new Error('Missing study');
    const floorOnly: Dungeon = {
      ...map,
      decoration: {
        ...map.decoration,
        props: map.decoration.props.filter(
          (prop) => !['desk', 'bookshelf', 'scroll_case'].includes(prop.kind),
        ),
      },
    };
    function pixels(value: Dungeon) {
      const canvas = createCanvas(40 * scale, 30 * scale);
      const ctx = canvas.getContext('2d');
      renderMap(ctx, value, { grid: true, pixelsPerTile: scale });
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    }
    const before = pixels(floorOnly);
    const after = pixels(map);
    let overlaps = 0;
    for (
      let y = Math.floor((room.y - 0.4) * scale);
      y < (room.y + room.height + 0.4) * scale;
      y++
    ) {
      for (
        let x = Math.floor((room.x - 0.4) * scale);
        x < (room.x + room.width + 0.4) * scale;
        x++
      ) {
        const fx = (x + 0.5) / scale;
        const fy = (y + 0.5) / scale;
        const tx = Math.floor(fx),
          ty = Math.floor(fy);
        const wall =
          !isFloor(map.layout, tx, ty) ||
          (fx - tx < 0.32 && !isFloor(map.layout, tx - 1, ty)) ||
          (fx - tx > 0.68 && !isFloor(map.layout, tx + 1, ty)) ||
          (fy - ty < 0.32 && !isFloor(map.layout, tx, ty - 1)) ||
          (fy - ty > 0.68 && !isFloor(map.layout, tx, ty + 1));
        if (!wall) continue;
        const p = (y * 40 * scale + x) * 4;
        if (
          before[p] !== after[p] ||
          before[p + 1] !== after[p + 1] ||
          before[p + 2] !== after[p + 2]
        )
          overlaps++;
      }
    }
    expect(overlaps).toBe(0);
  },
);
