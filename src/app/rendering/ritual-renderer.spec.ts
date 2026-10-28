import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from 'vitest';
import type { Dungeon, Prop } from '../engine/model';
import { generateDungeon } from '../engine/generate';
import { ritualCenter } from '../engine/dungeon-ritual';
import { renderMap } from './render-map';
import { drawProp } from './props';

test.each(['ritual_altar', 'ritual_candles', 'ritual_offering'] as const)(
  '%s artwork stays inside its occupied tile for every orientation',
  (kind) => {
    for (const scale of [64, 100])
      for (let turn = 0; turn < 4; turn++)
        for (const variation of [turn / 4, turn / 4 + 0.199]) {
          const canvas = createCanvas(scale * 3, scale * 3),
            ctx = canvas.getContext('2d');
          ctx.scale(scale, scale);
          const prop: Prop = { x: 1, y: 1, kind, variation, blocking: kind === 'ritual_altar' };
          const before = structuredClone(prop);
          drawProp(ctx, prop);
          const bytes = canvas.toBuffer('image/png');
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let painted = 0,
            outside = 0;
          for (let i = 3; i < pixels.length; i += 4) {
            if (!pixels[i]) continue;
            painted++;
            const pixel = (i - 3) / 4,
              x = pixel % canvas.width,
              y = Math.floor(pixel / canvas.width);
            if (x < scale || x >= scale * 2 || y < scale || y >= scale * 2) outside++;
          }
          expect(painted).toBeGreaterThan(50);
          expect(outside).toBe(0);
          ctx.clearRect(0, 0, 3, 3);
          drawProp(ctx, prop);
          expect(canvas.toBuffer('image/png')).toEqual(bytes);
          expect(prop).toEqual(before);
        }
  },
);

test.each([64, 70, 100])(
  'ritual artwork stays inside its protected floor area at %s px/tile',
  (scale) => {
    const result = generateDungeon({
      seed: 'mosslit-sanctum',
      roomCount: 6,
      density: 'Balanced',
      preset: 'Mosslit',
      ritual: true,
    });
    if (!result.ok) throw new Error(result.error);
    const map = result.map,
      before = structuredClone(map);
    const altar = map.decoration.props.find((p) => p.kind === 'ritual_altar');
    if (!altar) throw new Error('Missing altar');
    const center = ritualCenter(altar);
    function pixels(map: Dungeon) {
      const canvas = createCanvas(40 * scale, 30 * scale),
        ctx = canvas.getContext('2d');
      renderMap(ctx, map, { grid: true, pixelsPerTile: scale });
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    }
    const empty = {
      ...map,
      decoration: {
        ...map.decoration,
        ritual: false,
        props: map.decoration.props.filter((p) => !p.kind.startsWith('ritual_')),
      },
    };
    const a = pixels(empty),
      b = pixels(map);
    let changed = 0,
      outside = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2]) continue;
      changed++;
      const pixel = i / 4,
        x = (pixel % (40 * scale)) / scale,
        y = Math.floor(pixel / (40 * scale)) / scale;
      if (x < center.x - 2 || x >= center.x + 3 || y < center.y - 2 || y >= center.y + 3) outside++;
    }
    expect(changed).toBeGreaterThan(1000);
    expect(outside).toBe(0);
    expect(map).toEqual(before);
  },
);
