import { expect, test } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { generateDungeon } from '../src/app/engine/generate';
import { renderMap } from '../src/app/rendering/render-map';

test('render generated room purposes for visual review', () => {
  mkdirSync('artifacts/room-purpose', { recursive: true });
  for (const roomTheme of ['Mixed rooms', 'Barracks', 'Storerooms'] as const) {
    const generated = generateDungeon({
      seed: 'watch-house',
      roomCount: 8,
      density: 'Cluttered',
      preset: 'Mosslit',
      roomTheme,
    });
    if (!generated.ok) throw Error(generated.error);
    expect(generated.map.decoration.roomPurposes?.length).toBeGreaterThan(0);
    const canvas = createCanvas(1280, 960);
    renderMap(canvas.getContext('2d'), generated.map, { pixelsPerTile: 32, grid: true });
    writeFileSync(
      `artifacts/room-purpose/${roomTheme.toLowerCase().replaceAll(' ', '-')}.png`,
      canvas.toBuffer('image/png'),
    );
  }
});
