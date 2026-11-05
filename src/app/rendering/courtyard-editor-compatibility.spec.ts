import { createHash } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from 'vitest';
import fixture from '../save/fixtures/courtyard-v24.json';
import { parseBundle } from '../save/save-format';
import { renderMap } from './render-map';

// Captured with the committed pre-editor Courtyard renderer, not this resolver.
const baselines = [
  {
    model: '25b7a18b952048d0a5ec8af2139f4bdd48357c4f5bd5799dec0b2735f555e365',
    pixels: [
      '3d1fb347a8c50dabcf694590742056cc515403193de656bdc45969e440fca07a',
      'f904f580d48b8b2a0d74d409615145ef260a7c5fff2392bf5b83d4b7290d88e6',
    ],
  },
  {
    model: '9de3c8ade9e8e1ac7bbec44c53a1592356a225dc01f6e2502dbfb9f1e6c0da4b',
    pixels: [
      '76c4e61af26fbcbb9da6785dd0058a745dbe4fb5391b0013e39c7ee130d5c8f1',
      '59935024d06e4ad621fb15a9947e85bd60fd1de86c70925d782e6ee8f11028ab',
    ],
  },
] as const;
test('historical courtyards retain their exact models and grid-on/off pixels without adopting edits', () => {
  const parsed = parseBundle(JSON.stringify(fixture));
  if (!parsed.ok) throw Error(parsed.error);
  expect(parsed.maps).toHaveLength(2);
  for (const [i, record] of parsed.maps.entries()) {
    const baseline = baselines[i];
    if (!baseline) throw Error('Missing baseline');
    expect(record.map).not.toHaveProperty('objectEdits');
    expect(createHash('sha256').update(JSON.stringify(record.map)).digest('hex')).toBe(
      baseline.model,
    );
    for (const [j, grid] of [false, true].entries()) {
      const canvas = createCanvas(1280, 960),
        ctx = canvas.getContext('2d');
      renderMap(ctx, record.map, { grid, pixelsPerTile: 32 });
      expect(
        createHash('sha256')
          .update(ctx.getImageData(0, 0, 1280, 960).data)
          .digest('hex'),
      ).toBe(baseline.pixels[j]);
    }
  }
});
