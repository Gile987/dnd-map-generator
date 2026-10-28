import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { ALL_PRESETS } from '../src/app/engine/model';
import { generateDungeon } from '../src/app/engine/generate';
import { ritualCenter } from '../src/app/engine/dungeon-ritual';
import { renderMap } from '../src/app/rendering/render-map';

test.each(ALL_PRESETS)('renders %s ritual artwork for visual review', (preset) => {
  const result = generateDungeon({
    seed: 'mosslit-sanctum',
    roomCount: 6,
    density: 'Balanced',
    preset,
    ritual: true,
  });
  if (!result.ok) throw new Error(result.error);
  const altar = result.map.decoration.props.find((p) => p.kind === 'ritual_altar');
  if (!altar) throw new Error('Missing altar');
  const center = ritualCenter(altar);
  mkdirSync('artifacts/ritual', { recursive: true });
  for (const scale of [64, 100]) {
    const canvas = createCanvas(40 * scale, 30 * scale);
    renderMap(canvas.getContext('2d'), result.map, { grid: true, pixelsPerTile: scale });
    const bytes = canvas.toBuffer('image/png');
    writeFileSync(`artifacts/ritual/${preset}-${scale}.png`, bytes);
    const detail = createCanvas(5 * scale, 5 * scale);
    detail
      .getContext('2d')
      .drawImage(
        canvas,
        (center.x - 2) * scale,
        (center.y - 2) * scale,
        5 * scale,
        5 * scale,
        0,
        0,
        5 * scale,
        5 * scale,
      );
    writeFileSync(`artifacts/ritual/${preset}-${scale}-detail.png`, detail.toBuffer('image/png'));
    expect(bytes.length).toBeGreaterThan(1000);
  }
});
