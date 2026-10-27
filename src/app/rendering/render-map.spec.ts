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

const forest = generateForestClearing({
  seed: 'character-showcase',
  density: 'Balanced',
  character: 'Fey',
});
if (!forest.ok) throw new Error(forest.error);
const courtyard = generateCourtyard({ seed: 'ivy-court', density: 'Balanced', fountain: true });
if (!courtyard.ok) throw new Error(courtyard.error);

describe.each([showcaseDungeon(), forest.map, courtyard.map])('$type rendering dispatch', (map) => {
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
