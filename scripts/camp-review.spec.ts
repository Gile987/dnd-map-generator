import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import type { ForestClearing, Prop } from '../src/app/engine/model';
import { WIDTH, HEIGHT } from '../src/app/engine/model';
import { validateForest } from '../src/app/engine/forest-validation';
import { generateForestClearing } from '../src/app/engine/forest-generate';
import { ALL_FOREST_CHARACTERS } from '../src/app/engine/model';
import { renderForest } from '../src/app/rendering/forest-renderer';

test('renders a fixed camp showcase with deterministic artwork', () => {
  const props: readonly Prop[] = [
    { x: 21, y: 11, kind: 'tent', blocking: true, variation: 0.25 },
    { x: 25, y: 11, kind: 'tent', blocking: true, variation: 0.75 },
    { x: 21, y: 13, kind: 'bedroll', blocking: false, variation: 0.3 },
    { x: 25, y: 13, kind: 'bedroll', blocking: false, variation: 0.7 },
    { x: 23, y: 12, kind: 'fire_ring', blocking: false, variation: 0.5 },
    { x: 24, y: 11, kind: 'supply_bundle', blocking: true, variation: 0.4 },
  ];
  const map: ForestClearing = {
    type: 'forest',
    version: '4.0.0',
    seed: 'camp-showcase',
    surfaceSeed: 12345,
    layout: {
      tiles: Array.from({ length: WIDTH * HEIGHT }, (_, tile) => {
        const x = tile % WIDTH,
          y = Math.floor(tile / WIDTH);
        return (x >= 9 && x <= 30 && y >= 5 && y <= 25) || y === 20 || y === 21;
      }),
      route: Array.from({ length: WIDTH * 2 }, (_, i) => 20 * WIDTH + i),
      pathStart: { x: 0, y: 20 },
      pathEnd: { x: 39, y: 20 },
    },
    decoration: {
      props,
      scene: 'Abandoned camp',
      character: 'Verdant',
      density: 'Balanced',
      revision: 0,
    },
  };
  expect(validateForest(map)).toBeUndefined();
  const canvas = createCanvas(2560, 1920);
  renderForest(canvas.getContext('2d'), map, { grid: true, pixelsPerTile: 64 });
  const first = canvas.toBuffer('image/png');
  renderForest(canvas.getContext('2d'), map, { grid: true, pixelsPerTile: 64 });
  expect(canvas.toBuffer('image/png')).toEqual(first);
  mkdirSync('artifacts/f09', { recursive: true });
  writeFileSync('artifacts/f09/showcase.png', first);
  const detail = createCanvas(512, 384);
  detail.getContext('2d').drawImage(canvas, 19 * 64, 9 * 64, 512, 384, 0, 0, 512, 384);
  writeFileSync('artifacts/f09/showcase-detail.png', detail.toBuffer('image/png'));
});

test.each(ALL_FOREST_CHARACTERS)(
  'renders a deterministic %s camp for visual review',
  (character) => {
    mkdirSync('artifacts/f09', { recursive: true });
    const result = generateForestClearing({
      seed: 'mosslit-sanctum',
      character,
      density: 'Balanced',
      scene: 'Abandoned camp',
    });
    if (!result.ok) throw new Error(result.error);
    const canvas = createCanvas(2560, 1920);
    renderForest(canvas.getContext('2d'), result.map, { grid: true, pixelsPerTile: 64 });
    const first = canvas.toBuffer('image/png');
    renderForest(canvas.getContext('2d'), result.map, { grid: true, pixelsPerTile: 64 });
    expect(canvas.toBuffer('image/png')).toEqual(first);
    writeFileSync(`artifacts/f09/generated-${character}.png`, first);
    const fire = result.map.decoration.props.find((p) => p.kind === 'fire_ring');
    if (!fire) throw new Error('Expected camp hearth');
    const detail = createCanvas(512, 384);
    detail
      .getContext('2d')
      .drawImage(canvas, (fire.x - 4) * 64, (fire.y - 3) * 64, 512, 384, 0, 0, 512, 384);
    writeFileSync(`artifacts/f09/detail-${character}.png`, detail.toBuffer('image/png'));
  },
);
