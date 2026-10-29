import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { characterSample } from '../src/app/rendering/character-sample';
import { CHARACTER_OPTIONS } from '../src/app/workbench/character-picker/character-options';
import { renderMap } from '../src/app/rendering/render-map';

test.each(['dungeon', 'forest'] as const)(
  'reviews the actual %s character artwork at picker size',
  (type) => {
    mkdirSync('artifacts/characters', { recursive: true });
    const sheet = createCanvas(960, 600);
    const images: string[] = [];
    for (const [i, choice] of CHARACTER_OPTIONS[type].entries()) {
      const { map, region } = characterSample(choice);
      const full = createCanvas(2560, 1920);
      renderMap(full.getContext('2d'), map, { grid: false, pixelsPerTile: 64 });
      const crop = createCanvas(480, 300);
      crop
        .getContext('2d')
        .drawImage(
          full,
          region.x * 64,
          region.y * 64,
          region.width * 64,
          region.height * 64,
          0,
          0,
          480,
          300,
        );
      images.push(crop.toDataURL());
      sheet.getContext('2d').drawImage(crop, (i % 2) * 480, Math.floor(i / 2) * 300);
      writeFileSync(`artifacts/characters/${type}-${choice.id}.png`, crop.toBuffer('image/png'));
    }
    expect(new Set(images).size).toBe(4);
    writeFileSync(`artifacts/characters/${type}-sheet.png`, sheet.toBuffer('image/png'));
  },
);
