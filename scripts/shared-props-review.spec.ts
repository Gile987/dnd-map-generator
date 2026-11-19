import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import type { Canvas } from '@napi-rs/canvas';
import { expect, test } from 'vitest';
import {
  ALL_PRESETS,
  ALL_FOREST_CHARACTERS,
  ALL_COURTYARD_CHARACTERS,
  isBlockingProp,
} from '../src/app/engine/model';
import type {
  PropKind,
  DecorationPreset,
  ForestCharacter,
  CourtyardCharacter,
} from '../src/app/engine/model';
import { drawProp } from '../src/app/rendering/props';
import { FOREST_PALETTES } from '../src/app/rendering/forest-palette';
import { DUNGEON_PORTABLE_PALETTES } from '../src/app/rendering/portable-props';

const kinds = ['treasure_chest', 'supply_sacks', 'weapon_rack'] as const;
const rows: readonly (Theme & { readonly label: string })[] = [
  ...ALL_PRESETS.map((preset) => ({ label: `Dungeon · ${preset}`, preset })),
  ...ALL_FOREST_CHARACTERS.map((forest) => ({ label: `Forest · ${forest}`, forest })),
  ...ALL_COURTYARD_CHARACTERS.map((courtyard) => ({
    label: `Courtyard · ${courtyard}`,
    courtyard,
  })),
  { label: 'Tower' },
];
interface Theme {
  readonly preset?: DecorationPreset;
  readonly forest?: ForestCharacter;
  readonly courtyard?: CourtyardCharacter;
}
function paint(canvas: Canvas, kind: PropKind, theme: Theme, variation = 0.5, scale = 64) {
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawProp(
    ctx,
    { kind, x: 1, y: 1, blocking: isBlockingProp(kind), variation },
    theme.forest ? FOREST_PALETTES[theme.forest] : undefined,
    theme.courtyard,
    theme.preset ? DUNGEON_PORTABLE_PALETTES[theme.preset] : undefined,
  );
}

test.each(kinds)(
  '%s stays inside its single square at export scales and deterministic variations',
  (kind) => {
    for (const scale of [64, 70, 100])
      for (const variation of [0, 0.5, 0.999]) {
        const canvas = createCanvas(scale * 3, scale * 3);
        paint(canvas, kind, {}, variation, scale);
        const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let painted = 0,
          outside = 0;
        for (let y = 0; y < canvas.height; y++)
          for (let x = 0; x < canvas.width; x++) {
            if (data[(y * canvas.width + x) * 4 + 3] === 0) continue;
            painted++;
            if (x < scale || x >= scale * 2 || y < scale || y >= scale * 2) outside++;
          }
        expect(painted).toBeGreaterThan((scale * scale) / 5);
        expect(outside).toBe(0);
      }
  },
);

test.each(kinds)(
  '%s renders deterministically with distinct accepted character palettes',
  (kind) => {
    for (const themes of [
      ALL_PRESETS.map((preset) => ({ preset })),
      ALL_FOREST_CHARACTERS.map((forest) => ({ forest })),
      ALL_COURTYARD_CHARACTERS.map((courtyard) => ({ courtyard })),
    ]) {
      const hashes = themes.map((theme) => {
        const first = createCanvas(192, 192),
          second = createCanvas(192, 192);
        paint(first, kind, theme);
        paint(second, kind, theme);
        expect(first.toBuffer('image/png').equals(second.toBuffer('image/png'))).toBe(true);
        return createHash('sha256').update(first.toBuffer('image/png')).digest('hex');
      });
      expect(new Set(hashes).size).toBe(4);
    }
  },
);

test('writes a native Canvas contact sheet for all new objects and accepted characters', () => {
  const canvas = createCanvas(640, 80 + rows.length * 105),
    ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f3f0e6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#203c35';
  ctx.font = 'bold 21px sans-serif';
  ctx.fillText('Shared placeable props', 18, 30);
  ctx.font = '14px sans-serif';
  for (const [i, label] of ['Treasure chest', 'Supply sacks', 'Weapon rack'].entries())
    ctx.fillText(label, 225 + i * 135, 62);
  for (const [i, theme] of rows.entries()) {
    const y = 80 + i * 105;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#203c35';
    ctx.font = '14px sans-serif';
    ctx.fillText(theme.label, 15, y + 48);
    for (const [j, kind] of kinds.entries()) {
      const x = 220 + j * 135;
      ctx.fillStyle = '#54665d';
      ctx.fillRect(x, y, 95, 95);
      ctx.save();
      ctx.translate(x + 9, y + 9);
      ctx.scale(76, 76);
      drawProp(
        ctx,
        { kind, x: 0, y: 0, blocking: true, variation: 0.5 },
        theme.forest ? FOREST_PALETTES[theme.forest] : undefined,
        theme.courtyard,
        theme.preset ? DUNGEON_PORTABLE_PALETTES[theme.preset] : undefined,
      );
      ctx.restore();
    }
  }
  mkdirSync('artifacts/shared-props', { recursive: true });
  writeFileSync('artifacts/shared-props/catalog.png', canvas.toBuffer('image/png'));
});
