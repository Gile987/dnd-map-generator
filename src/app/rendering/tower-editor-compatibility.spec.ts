import { createHash } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from 'vitest';
import fixture from '../save/fixtures/tower-editor-v26.json';
import baselines from './tower-editor-baselines.json';
import { parseBundle } from '../save/save-format';
import { renderMap } from './render-map';
import { generateTower } from '../engine/tower';
const hash = (v: string | Uint8ClampedArray) => createHash('sha256').update(v).digest('hex');
// These independent models, vector pixels and text commands were captured before
// Tower editor changes. Font rasterization is deliberately not a baseline input.
test.each(baselines)(
  'keeps the pre-editor $id model, vector pixels and text commands',
  (baseline) => {
    const before = structuredClone(fixture),
      parsed = parseBundle(JSON.stringify(fixture));
    if (!parsed.ok) throw Error(parsed.error);
    const map = parsed.maps.find((r) => r.id === baseline.id)?.map;
    if (!map || map.type !== 'tower' || map.objectEdits) throw Error('Missing canonical Tower');
    expect(hash(JSON.stringify(map))).toBe(baseline.model);
    const generated = generateTower({
      seed: map.seed,
      floorCount: map.layout.floors.length,
      portalFloor: map.layout.portalFloor,
      density: map.decoration.density,
      stairStyle: map.layout.stairStyle,
      laboratoryFloor: map.decoration.laboratoryFloor,
      observatoryFloor: map.decoration.observatoryFloor,
    });
    if (!generated.ok) throw Error(generated.error);
    expect(hash(JSON.stringify(generated.map))).toBe(baseline.model);
    for (const mode of baseline.modes) {
      const c = createCanvas(map.layout.width * 16, map.layout.height * 16),
        ctx = c.getContext('2d'),
        text: unknown[] = [];
      ctx.fillText = (...args) => {
        text.push({
          args,
          font: ctx.font,
          style: ctx.fillStyle,
          matrix: Array.from(ctx.getTransform().toFloat64Array()),
        });
      };
      renderMap(ctx, map, { grid: mode.grid, showSecrets: mode.showSecrets, pixelsPerTile: 16 });
      expect(hash(ctx.getImageData(0, 0, c.width, c.height).data)).toBe(mode.pixels);
      expect(hash(JSON.stringify(text))).toBe(mode.text);
    }
    expect(fixture).toEqual(before);
  },
);
