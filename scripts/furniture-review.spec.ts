import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { generateDungeon } from '../src/app/engine/generate';
import { ALL_PRESETS } from '../src/app/engine/model';
import type { Prop } from '../src/app/engine/model';
import { propCells, propBounds, QUARTER_TURNS } from '../src/app/engine/prop-footprint';
import { renderDungeon } from '../src/app/rendering/dungeon-renderer';
import { drawProp } from '../src/app/rendering/props';

test.each(QUARTER_TURNS)(
  'rotation %s paints both occupied cells and nothing outside them',
  (rotation) => {
    const table: Prop = {
      x: 1,
      y: 1,
      kind: 'dining_table',
      blocking: true,
      variation: 0.3,
      footprint: { width: 2, height: 1 },
      rotation,
    };
    const canvas = createCanvas(256, 256),
      ctx = canvas.getContext('2d');
    ctx.setTransform(64, 0, 0, 64, 0, 0);
    drawProp(ctx, table);
    const data = ctx.getImageData(0, 0, 256, 256).data;
    const occupied = new Set(propCells(table).map((p) => `${p.x},${p.y}`)),
      painted = new Set<string>();
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++)
        if (data[(y * 256 + x) * 4 + 3]) {
          const tile = `${Math.floor(x / 64)},${Math.floor(y / 64)}`;
          expect(occupied.has(tile)).toBe(true);
          painted.add(tile);
        }
    expect(painted).toEqual(occupied);
    mkdirSync('artifacts/f11', { recursive: true });
    writeFileSync(`artifacts/f11/rotation-${rotation}.png`, canvas.toBuffer('image/png'));
  },
);

test.each(ALL_PRESETS)(
  'renders deterministic %s furniture alongside a study and statue',
  (preset) => {
    const result = generateDungeon({
      seed: 'mosslit-sanctum',
      roomCount: 6,
      preset,
      density: 'Balanced',
      scene: 'Forgotten study',
      landmark: 'weathered-statue',
      furniture: 'dining-table',
    });
    if (!result.ok) throw new Error(result.error);
    const canvas = createCanvas(2560, 1920);
    renderDungeon(canvas.getContext('2d'), result.map, { grid: true, pixelsPerTile: 64 });
    const first = canvas.toBuffer('image/png');
    renderDungeon(canvas.getContext('2d'), result.map, { grid: true, pixelsPerTile: 64 });
    expect(canvas.toBuffer('image/png')).toEqual(first);
    mkdirSync('artifacts/f11', { recursive: true });
    writeFileSync(`artifacts/f11/${preset}.png`, first);
    const table = result.map.decoration.props.find((p) => p.kind === 'dining_table');
    if (!table) throw new Error('Expected table');
    const bounds = propBounds(table),
      width = (bounds.width + 4) * 64,
      height = (bounds.height + 4) * 64;
    const detail = createCanvas(width, height);
    detail
      .getContext('2d')
      .drawImage(
        canvas,
        (bounds.x - 2) * 64,
        (bounds.y - 2) * 64,
        width,
        height,
        0,
        0,
        width,
        height,
      );
    writeFileSync(`artifacts/f11/${preset}-detail.png`, detail.toBuffer('image/png'));
  },
);
