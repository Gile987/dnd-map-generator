import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { generateDungeon } from '../src/app/engine/generate';
import { ALL_PRESETS, contains } from '../src/app/engine/model';
import { renderMap } from '../src/app/rendering/render-map';

test.each(ALL_PRESETS)('renders %s study surfaces for visual review', (preset) => {
  const result = generateDungeon({
    seed: 'forgotten-library',
    roomCount: 6,
    preset,
    density: 'Balanced',
    scene: 'Forgotten study',
  });
  if (!result.ok) throw new Error(result.error);
  const desk = result.map.decoration.props.find((prop) => prop.kind === 'desk');
  const room = desk && result.map.layout.rooms.find((room) => contains(room, desk));
  if (!room) throw new Error('Missing study');
  mkdirSync('artifacts/f12', { recursive: true });
  for (const scale of [64, 100]) {
    const canvas = createCanvas(40 * scale, 30 * scale);
    renderMap(canvas.getContext('2d'), result.map, { grid: true, pixelsPerTile: scale });
    writeFileSync(`artifacts/f12/${preset}-${scale}.png`, canvas.toBuffer('image/png'));
    const comparison = createCanvas(room.width * scale * 2, room.height * scale);
    comparison
      .getContext('2d')
      .drawImage(
        canvas,
        room.x * scale,
        room.y * scale,
        room.width * scale,
        room.height * scale,
        room.width * scale,
        0,
        room.width * scale,
        room.height * scale,
      );
    const { studySurface, ...decoration } = result.map.decoration;
    expect(studySurface).toBe(1);
    const historical = createCanvas(40 * scale, 30 * scale);
    renderMap(
      historical.getContext('2d'),
      { ...result.map, decoration },
      { grid: true, pixelsPerTile: scale },
    );
    comparison
      .getContext('2d')
      .drawImage(
        historical,
        room.x * scale,
        room.y * scale,
        room.width * scale,
        room.height * scale,
        0,
        0,
        room.width * scale,
        room.height * scale,
      );
    writeFileSync(
      `artifacts/f12/${preset}-${scale}-comparison.png`,
      comparison.toBuffer('image/png'),
    );
  }
});
