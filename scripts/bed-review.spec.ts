import { expect, test } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { drawProp } from '../src/app/rendering/props';
import {
  DUNGEON_PORTABLE_PALETTES,
  portablePropPalette,
} from '../src/app/rendering/portable-props';
import { VERDANT_PALETTE } from '../src/app/rendering/forest-palette';

test('bed drawings fit both occupied cells at all turns and retain the map palette', () => {
  const themes = [
    ['Dungeon', DUNGEON_PORTABLE_PALETTES.Crypt],
    ['Tower', portablePropPalette(VERDANT_PALETTE, 'Overgrown')],
  ] as const;
  const sheet = createCanvas(760, 380),
    paint = sheet.getContext('2d');
  paint.fillStyle = '#f7f4e9';
  paint.fillRect(0, 0, 760, 380);
  paint.fillStyle = '#243d35';
  paint.font = '16px sans-serif';
  for (const [row, [name, palette]] of themes.entries()) {
    paint.fillText(name, 10, 90 + row * 180);
    for (const rotation of [0, 1, 2, 3] as const) {
      const cell = createCanvas(256, 256),
        ctx = cell.getContext('2d');
      ctx.scale(64, 64);
      drawProp(
        ctx,
        {
          kind: 'wooden_bed',
          x: 1,
          y: 1,
          footprint: { width: 2, height: 1 },
          rotation,
          variation: 0.5,
          blocking: true,
        },
        undefined,
        undefined,
        palette,
      );
      const pixels = ctx.getImageData(0, 0, 256, 256).data,
        width = rotation % 2 ? 1 : 2,
        height = rotation % 2 ? 2 : 1;
      let count = 0,
        outside = false;
      for (let y = 0; y < 256; y++)
        for (let x = 0; x < 256; x++)
          if (pixels[(y * 256 + x) * 4 + 3]) {
            count++;
            if (x < 64 || x >= (1 + width) * 64 || y < 64 || y >= (1 + height) * 64) outside = true;
          }
      expect(outside).toBe(false);
      expect(count).toBeGreaterThan(1000);
      const x = 160 + rotation * 145,
        y = 15 + row * 180;
      paint.drawImage(
        cell,
        64,
        64,
        width * 64,
        height * 64,
        x + (140 - width * 64) / 2,
        y + (140 - height * 64) / 2,
        width * 64,
        height * 64,
      );
      paint.fillText(`${rotation * 90}°`, x + 45, y + 160);
    }
  }
  mkdirSync('artifacts/wooden-bed', { recursive: true });
  writeFileSync('artifacts/wooden-bed/rotations.png', sheet.toBuffer('image/png'));
});
