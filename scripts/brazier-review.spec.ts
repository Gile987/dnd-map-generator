import { mkdirSync, writeFileSync } from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from 'vitest';
import { generateCourtyard } from '../src/app/engine/courtyard-generate';
import { ALL_COURTYARD_CHARACTERS } from '../src/app/engine/model';
import { renderMap } from '../src/app/rendering/render-map';
import { drawProp } from '../src/app/rendering/props';

test('reviews all courtyard braziers and keeps each complete sprite within one square', () => {
  mkdirSync('artifacts/brazier', { recursive: true });
  const sheet = createCanvas(1280, 1280);
  const sheetContext = sheet.getContext('2d');
  for (const [index, character] of ALL_COURTYARD_CHARACTERS.entries()) {
    const generated = generateCourtyard({
      seed: 'ivy-court',
      density: 'Balanced',
      character,
      fountain: true,
      wagon: true,
      well: true,
      brazier: true,
    });
    if (!generated.ok) throw new Error(generated.error);
    const brazier = generated.map.decoration.props.find(
      (prop) => prop.kind === 'abandoned_brazier',
    );
    if (!brazier) throw new Error('Missing abandoned brazier');
    const full = createCanvas(2560, 1920);
    renderMap(full.getContext('2d'), generated.map, { grid: true, pixelsPerTile: 64 });
    writeFileSync(`artifacts/brazier/${character}-map.png`, full.toBuffer('image/png'));
    const detail = createCanvas(640, 640);
    detail
      .getContext('2d')
      .drawImage(full, (brazier.x - 2) * 64, (brazier.y - 2) * 64, 320, 320, 0, 0, 640, 640);
    writeFileSync(`artifacts/brazier/${character}-detail.png`, detail.toBuffer('image/png'));
    sheetContext.drawImage(detail, (index % 2) * 640, Math.floor(index / 2) * 640);

    const isolated = createCanvas(192, 192),
      ctx = isolated.getContext('2d');
    ctx.setTransform(64, 0, 0, 64, 0, 0);
    drawProp(ctx, { ...brazier, x: 1, y: 1 }, undefined, character);
    const pixels = ctx.getImageData(0, 0, 192, 192).data;
    let painted = 0;
    for (let y = 0; y < 192; y++)
      for (let x = 0; x < 192; x++)
        if (pixels[(y * 192 + x) * 4 + 3]) {
          painted++;
          expect(x >= 64 && x < 128 && y >= 64 && y < 128).toBe(true);
        }
    expect(painted).toBeGreaterThan(300);
  }
  writeFileSync('artifacts/brazier/characters.png', sheet.toBuffer('image/png'));
});
