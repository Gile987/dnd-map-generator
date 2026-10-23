import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from 'vitest';
import { showcaseDungeon } from '../src/app/engine/showcase';
import { renderDungeon } from '../src/app/rendering/dungeon-renderer';
import { renderForest } from '../src/app/rendering/forest-renderer';
import { generateDungeon } from '../src/app/engine/generate';
import { generateForestClearing } from '../src/app/engine/forest-generate';
import type { Density, DecorationPreset, ForestCharacter } from '../src/app/engine/model';
import { contains } from '../src/app/engine/model';

test.each(['Mosslit', 'Crypt', 'Storehouse', 'Sanctuary'] as const)(
  'renders a deterministic %s study for visual review',
  (preset) => {
    const result = generateDungeon({
      seed: 'mosslit-sanctum',
      roomCount: 6,
      preset,
      density: 'Balanced',
      scene: 'Forgotten study',
    });
    if (!result.ok) throw new Error(result.error);
    const canvas = createCanvas(2560, 1920);
    renderDungeon(canvas.getContext('2d'), result.map, { grid: true, pixelsPerTile: 64 });
    const first = canvas.toBuffer('image/png');
    renderDungeon(canvas.getContext('2d'), result.map, { grid: true, pixelsPerTile: 64 });
    expect(canvas.toBuffer('image/png')).toEqual(first);
    mkdirSync('artifacts/study', { recursive: true });
    writeFileSync(`artifacts/study/${preset}.png`, first);
    const desk = result.map.decoration.props.find((p) => p.kind === 'desk');
    const room = desk && result.map.layout.rooms.find((room) => contains(room, desk));
    if (!room) throw new Error('Expected study room');
    const detail = createCanvas((room.width + 2) * 64, (room.height + 2) * 64);
    detail
      .getContext('2d')
      .drawImage(
        canvas,
        (room.x - 1) * 64,
        (room.y - 1) * 64,
        detail.width,
        detail.height,
        0,
        0,
        detail.width,
        detail.height,
      );
    writeFileSync(`artifacts/study/${preset}-detail.png`, detail.toBuffer('image/png'));
  },
);

test('render the reusable showcase at export resolution and crop a close-up', () => {
  mkdirSync('artifacts', { recursive: true });
  const canvas = createCanvas(2560, 1920);
  renderDungeon(canvas.getContext('2d'), showcaseDungeon(), { grid: true, pixelsPerTile: 64 });
  writeFileSync('artifacts/showcase.png', canvas.toBuffer('image/png'));
  const detail = createCanvas(768, 640);
  detail.getContext('2d').drawImage(canvas, 192, 192, 768, 640, 0, 0, 768, 640);
  writeFileSync('artifacts/showcase-detail.png', detail.toBuffer('image/png'));
  expect(canvas.width).toBe(2560);
  expect(canvas.height).toBe(1920);
});

test('render six representative maps and a contact sheet for visual review', () => {
  mkdirSync('artifacts', { recursive: true });
  const sheet = createCanvas(1440, 810);
  const cases: readonly {
    seed: string;
    roomCount: number;
    density: Density;
    preset: DecorationPreset;
  }[] = [
    { seed: 'mosslit-sanctum', roomCount: 6, density: 'Balanced', preset: 'Mosslit' },
    { seed: 'amber-vault', roomCount: 4, density: 'Sparse', preset: 'Crypt' },
    { seed: 'forgotten-library', roomCount: 8, density: 'Cluttered', preset: 'Storehouse' },
    { seed: 'lantern-watch', roomCount: 7, density: 'Sparse', preset: 'Sanctuary' },
    { seed: 'moss-and-memory', roomCount: 5, density: 'Cluttered', preset: 'Mosslit' },
    { seed: 'silver-crypt', roomCount: 8, density: 'Balanced', preset: 'Crypt' },
  ];
  cases.forEach((settings, i) => {
    const result = generateDungeon(settings);
    expect(result.ok, settings.seed).toBe(true);
    if (!result.ok) return;
    const canvas = createCanvas(2560, 1920);
    renderDungeon(canvas.getContext('2d'), result.map, { grid: true, pixelsPerTile: 64 });
    writeFileSync(`artifacts/review-${settings.seed}.png`, canvas.toBuffer('image/png'));
    const detail = createCanvas(768, 640);
    const room = result.map.layout.rooms[0];
    if (room) {
      detail
        .getContext('2d')
        .drawImage(canvas, (room.x - 1) * 64, (room.y - 1) * 64, 768, 640, 0, 0, 768, 640);
      writeFileSync(`artifacts/detail-${settings.seed}.png`, detail.toBuffer('image/png'));
    }
    const ctx = sheet.getContext('2d');
    const x = (i % 3) * 480;
    const y = Math.floor(i / 3) * 405;
    ctx.fillStyle = '#f5f3ec';
    ctx.fillRect(x, y, 480, 405);
    ctx.fillStyle = '#214437';
    ctx.font = '14px sans-serif';
    ctx.fillText(`${settings.seed} / ${settings.roomCount} / ${settings.density}`, x + 12, y + 22);
    ctx.drawImage(canvas, x, y + 36, 480, 360);
  });
  writeFileSync('artifacts/contact-sheet.png', sheet.toBuffer('image/png'));
});

test('render the four forest characters and a contact sheet for visual review', () => {
  mkdirSync('artifacts', { recursive: true });
  const sheet = createCanvas(1440, 810);
  const characters: readonly ForestCharacter[] = ['Verdant', 'Autumn', 'Pines', 'Fey'];
  characters.forEach((character, i) => {
    const result = generateForestClearing({
      seed: 'character-showcase',
      density: 'Balanced',
      character,
    });
    expect(result.ok, character).toBe(true);
    if (!result.ok) return;
    const canvas = createCanvas(2560, 1920);
    renderForest(canvas.getContext('2d'), result.map, { grid: true, pixelsPerTile: 64 });
    writeFileSync(`artifacts/forest-${character}.png`, canvas.toBuffer('image/png'));
    const detail = createCanvas(768, 640);
    detail.getContext('2d').drawImage(canvas, 640, 512, 768, 640, 0, 0, 768, 640);
    writeFileSync(`artifacts/forest-${character}-detail.png`, detail.toBuffer('image/png'));
    const ctx = sheet.getContext('2d');
    const x = (i % 2) * 720;
    const y = Math.floor(i / 2) * 405;
    ctx.fillStyle = '#f5f3ec';
    ctx.fillRect(x, y, 720, 405);
    ctx.fillStyle = '#214437';
    ctx.font = '14px sans-serif';
    ctx.fillText(`${character} / character-showcase / Balanced`, x + 12, y + 22);
    ctx.drawImage(canvas, x, y + 36, 720, 360);
  });
  writeFileSync('artifacts/forest-characters.png', sheet.toBuffer('image/png'));
});
