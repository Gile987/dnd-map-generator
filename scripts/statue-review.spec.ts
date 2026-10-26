import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { generateDungeon } from '../src/app/engine/generate';
import { ALL_PRESETS } from '../src/app/engine/model';
import { renderDungeon } from '../src/app/rendering/dungeon-renderer';

test.each(ALL_PRESETS)(
  'renders a deterministic %s statue and study for visual review',
  (preset) => {
    const result = generateDungeon({
      seed: 'mosslit-sanctum',
      roomCount: 6,
      preset,
      density: 'Balanced',
      scene: 'Forgotten study',
      landmark: 'weathered-statue',
    });
    if (!result.ok) throw new Error(result.error);
    const canvas = createCanvas(2560, 1920);
    renderDungeon(canvas.getContext('2d'), result.map, { grid: true, pixelsPerTile: 64 });
    const first = canvas.toBuffer('image/png');
    renderDungeon(canvas.getContext('2d'), result.map, { grid: true, pixelsPerTile: 64 });
    expect(canvas.toBuffer('image/png')).toEqual(first);
    mkdirSync('artifacts/statue', { recursive: true });
    writeFileSync(`artifacts/statue/${preset}.png`, first);
    const statue = result.map.decoration.props.find((p) => p.kind === 'weathered_statue');
    if (!statue) throw new Error('Expected statue');
    const detail = createCanvas(448, 448);
    detail
      .getContext('2d')
      .drawImage(canvas, (statue.x - 3) * 64, (statue.y - 3) * 64, 448, 448, 0, 0, 448, 448);
    writeFileSync(`artifacts/statue/${preset}-detail.png`, detail.toBuffer('image/png'));
  },
);
