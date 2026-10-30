import { createHash } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from 'vitest';
import {
  generateTower,
  shuffleTowerDetails,
  changeTowerDensity,
  TOWER_STAIR_STYLES,
} from '../engine/tower';
import { renderMap } from './render-map';

// Captured from the committed laboratory implementation before sharing placement helpers.
// Vector pixels and text commands are independent of installed system fonts.
const baselines = {
  separate: {
    model: 'e0e623ff666358d81d6fac95d073d19e54cea4b8cb88e3fdc6d018c667137256',
    pixels: '9d9a9bfc78f0c17475a280637f245c27ccae3559f824f894c3640e0c216f53df',
    text: 'bfbcf1beb59fb863986646ad3af5176f4abb5983139b16e0ecad901f7a9a848b',
  },
  spiral: {
    model: '1932408addd6d335d2a0292275b9118a2390c570d09e474f0fffba1bb0198a99',
    pixels: 'ae971fd1fc700a5424cf7f3129e03738ed7e8b085fc3b632ab64dfc622a4d817',
    text: '657a269fc3fee2471f3e83998be7af951f4ec3695d2ea75d249852716c9a3088',
  },
};
test('laboratory-only models, shuffles, density changes and artwork retain the pre-observatory baseline', () => {
  const hash = (value: string | Uint8ClampedArray) =>
    createHash('sha256').update(value).digest('hex');
  for (const stairStyle of TOWER_STAIR_STYLES) {
    const result = generateTower({
      seed: 'astral-watch',
      floorCount: 4,
      portalFloor: null,
      density: 'Balanced',
      stairStyle,
      laboratoryFloor: 2,
    });
    if (!result.ok) throw new Error(result.error);
    const canvas = createCanvas(32 * 32, 36 * 32),
      ctx = canvas.getContext('2d');
    const text: unknown[] = [];
    ctx.fillText = (value, x, y) => {
      const m = ctx.getTransform();
      text.push([value, x, y, ctx.font, ctx.fillStyle, m.a, m.d, m.e, m.f]);
    };
    renderMap(ctx, result.map, { grid: true, pixelsPerTile: 32 });
    expect(
      hash(
        JSON.stringify([
          result.map,
          shuffleTowerDetails(result.map),
          changeTowerDensity(result.map, 'Sparse'),
        ]),
      ),
    ).toBe(baselines[stairStyle].model);
    expect(hash(ctx.getImageData(0, 0, canvas.width, canvas.height).data)).toBe(
      baselines[stairStyle].pixels,
    );
    expect(hash(JSON.stringify(text))).toBe(baselines[stairStyle].text);
  }
});
