import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { generateCourtyard } from '../src/app/engine/courtyard-generate';
import { indexOf } from '../src/app/engine/model';
import type { RuinedCourtyard } from '../src/app/engine/model';
import { renderCourtyard } from '../src/app/rendering/courtyard-renderer';

test('reviews a fixed courtyard composition and varied generated ruins', () => {
  const tiles = Array<boolean>(1200).fill(true);
  for (let x = 6; x <= 33; x++)
    for (const y of [4, 25]) if (x < 18 || x > 20) tiles[indexOf(x, y)] = false;
  for (let y = 4; y <= 25; y++)
    for (const x of [6, 33]) if (y < 13 || y > 15) tiles[indexOf(x, y)] = false;
  for (const [x, y] of [
    [10, 8],
    [11, 8],
    [12, 8],
    [27, 22],
    [28, 22],
    [29, 22],
  ])
    if (x !== undefined && y !== undefined) tiles[indexOf(x, y)] = false;
  const fixed: RuinedCourtyard = {
    type: 'courtyard',
    version: '4.0.0',
    seed: 'courtyard-showcase',
    surfaceSeed: 7531,
    layout: {
      tiles,
      bounds: { x: 6, y: 4, width: 28, height: 22 },
      encounter: { x: 12, y: 12, width: 6, height: 6 },
      approaches: [
        { x: 19, y: 4 },
        { x: 33, y: 14 },
        { x: 19, y: 25 },
        { x: 6, y: 14 },
      ],
    },
    decoration: {
      density: 'Balanced',
      fountain: true,
      revision: 0,
      props: [
        {
          kind: 'dry_fountain',
          x: 25,
          y: 14,
          blocking: true,
          variation: 0.3,
          footprint: { width: 3, height: 3 },
          rotation: 0,
        },
        { kind: 'broken_column', x: 11, y: 11, blocking: true, variation: 0.2 },
        { kind: 'broken_column', x: 28, y: 9, blocking: true, variation: 0.8 },
        { kind: 'low_rubble', x: 10, y: 9, blocking: false, variation: 0.4 },
        { kind: 'fern', x: 30, y: 20, blocking: false, variation: 0.4 },
      ],
    },
  };
  mkdirSync('artifacts/courtyard', { recursive: true });
  const cases = [fixed];
  for (const seed of ['ivy-court', 'fallen-crown', 'sunken-abbey', 'mosslit-sanctum']) {
    const result = generateCourtyard({ seed, density: 'Balanced', fountain: true });
    if (!result.ok) throw new Error(`${seed}: ${result.error}`);
    cases.push(result.map);
  }
  for (const map of cases) {
    const canvas = createCanvas(2560, 1920);
    renderCourtyard(canvas.getContext('2d'), map, { grid: true, pixelsPerTile: 64 });
    const first = canvas.toBuffer('image/png');
    renderCourtyard(canvas.getContext('2d'), map, { grid: true, pixelsPerTile: 64 });
    expect(canvas.toBuffer('image/png')).toEqual(first);
    writeFileSync(`artifacts/courtyard/${map.seed}.png`, first);
    const detail = createCanvas(512, 512);
    detail
      .getContext('2d')
      .drawImage(
        canvas,
        (map.layout.bounds.x + map.layout.bounds.width - 11) * 64,
        (map.layout.bounds.y + Math.floor(map.layout.bounds.height / 2) - 3) * 64,
        512,
        512,
        0,
        0,
        512,
        512,
      );
    writeFileSync(`artifacts/courtyard/${map.seed}-detail.png`, detail.toBuffer('image/png'));
  }
}, 30000);
