import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, test } from 'vitest';
import { generateForestClearing } from '../engine/forest-generate';
import { generateCourtyard } from '../engine/courtyard-generate';
import { HEIGHT, WIDTH } from '../engine/model';
import { showcaseDungeon } from '../engine/showcase';
import { renderDungeon } from './dungeon-renderer';
import { renderForest } from './forest-renderer';
import { renderCourtyard } from './courtyard-renderer';
import { renderMap } from './render-map';
import { PIXELS_PER_TILE } from './resolution';
import { drawGrid } from './drawing-primitives';

const forest = generateForestClearing({
  seed: 'character-showcase',
  density: 'Balanced',
  character: 'Fey',
});
if (!forest.ok) throw new Error(forest.error);
const courtyard = generateCourtyard({ seed: 'ivy-court', density: 'Balanced', fountain: true });
if (!courtyard.ok) throw new Error(courtyard.error);

describe.each([showcaseDungeon(), forest.map, courtyard.map])('$type rendering dispatch', (map) => {
  function pixels(grid: boolean, gridOpacity?: number): Buffer {
    const canvas = createCanvas(WIDTH * 16, HEIGHT * 16);
    renderMap(canvas.getContext('2d'), map, { grid, gridOpacity, pixelsPerTile: 16 });
    return Buffer.from(canvas.getContext('2d').getImageData(0, 0, WIDTH * 16, HEIGHT * 16).data);
  }

  test('zero opacity gives exactly the grid-free artwork', () => {
    expect(pixels(true, 0).equals(pixels(false))).toBe(true);
  });

  test('an explicit original opacity preserves the original artwork', () => {
    const alpha = { dungeon: 0x23, forest: 0x18, courtyard: 0x30 }[map.type];
    expect(pixels(true, alpha / 255).equals(pixels(true))).toBe(true);
  });

  test('custom opacity changes only the grid overlay and leaves the map untouched', () => {
    const before = JSON.stringify(map);
    const expected = createCanvas(WIDTH * 16, HEIGHT * 16).getContext('2d');
    renderMap(expected, map, { grid: false, pixelsPerTile: 16 });
    expected.setTransform(16, 0, 0, 16, 0, 0);
    expected.strokeStyle = { dungeon: '#b6c7bf66', forest: '#a8e0c066', courtyard: '#233b2b66' }[
      map.type
    ];
    expected.lineWidth = 0.012;
    // Dungeon walls and forest paths leave rounded caps for their original grid.
    if (map.type !== 'courtyard') {
      expected.lineCap = 'round';
      expected.lineJoin = 'round';
    }
    expected.beginPath();
    for (let x = 0; x <= 40; x++) {
      expected.moveTo(x, 0);
      expected.lineTo(x, 30);
    }
    for (let y = 0; y <= 30; y++) {
      expected.moveTo(0, y);
      expected.lineTo(40, y);
    }
    expected.stroke();
    expect(
      pixels(true, 0.4).equals(
        Buffer.from(expected.getImageData(0, 0, WIDTH * 16, HEIGHT * 16).data),
      ),
    ).toBe(true);
    expect(pixels(true, 0.4).equals(pixels(true))).toBe(false);
    expect(JSON.stringify(map)).toBe(before);
  });

  test.each([
    { name: 'export with grid', grid: true, pixelsPerTile: PIXELS_PER_TILE },
    { name: 'export without grid', grid: false, pixelsPerTile: PIXELS_PER_TILE },
    { name: 'thumbnail', grid: false, pixelsPerTile: 8 },
  ])('preserves the complete renderer output for $name', ({ grid, pixelsPerTile }) => {
    const width = WIDTH * pixelsPerTile;
    const height = HEIGHT * pixelsPerTile;
    const actual = createCanvas(width, height).getContext('2d');
    const expected = createCanvas(width, height).getContext('2d');
    const options = Object.freeze({ grid, pixelsPerTile });
    renderMap(actual, map, options);
    if (map.type === 'dungeon') renderDungeon(expected, map, options);
    else if (map.type === 'courtyard') renderCourtyard(expected, map, options);
    else renderForest(expected, map, options);
    const pixels = Buffer.from(actual.getImageData(0, 0, width, height).data);
    expect(pixels.equals(Buffer.from(expected.getImageData(0, 0, width, height).data))).toBe(true);
  });
});

test.each([NaN, Infinity, -0.1, 1.1])('rejects invalid grid opacity %s', (opacity) => {
  const ctx = createCanvas(40, 30).getContext('2d');
  expect(() => drawGrid(ctx, '#b6c7bf23', opacity)).toThrow(
    'Grid opacity must be between 0 and 1.',
  );
});
