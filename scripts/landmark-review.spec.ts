import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { ALL_FOREST_CHARACTERS } from '../src/app/engine/model';
import { generateForestClearing } from '../src/app/engine/forest-generate';
import { renderForest } from '../src/app/rendering/forest-renderer';

test.each(ALL_FOREST_CHARACTERS)(
  'renders a deterministic %s circle with camp for review',
  (character) => {
    const result = generateForestClearing({
      seed: 'mosslit-sanctum',
      character,
      density: 'Balanced',
      scene: 'Abandoned camp',
      landmark: 'Suggested landmark',
    });
    if (!result.ok) throw new Error(result.error);
    const canvas = createCanvas(2560, 1920);
    renderForest(canvas.getContext('2d'), result.map, { grid: true, pixelsPerTile: 64 });
    const first = canvas.toBuffer('image/png');
    renderForest(canvas.getContext('2d'), result.map, { grid: true, pixelsPerTile: 64 });
    expect(canvas.toBuffer('image/png')).toEqual(first);
    mkdirSync('artifacts/f10', { recursive: true });
    writeFileSync(`artifacts/f10/${character}.png`, first);
    const stones = result.map.decoration.props.filter((p) => p.kind === 'standing_stone');
    const x = stones.reduce((n, p) => n + p.x, 0) / 6;
    const y = stones.reduce((n, p) => n + p.y, 0) / 6;
    const detail = createCanvas(448, 448);
    detail.getContext('2d').drawImage(canvas, (x - 3) * 64, (y - 3) * 64, 448, 448, 0, 0, 448, 448);
    writeFileSync(`artifacts/f10/${character}-detail.png`, detail.toBuffer('image/png'));
  },
);
