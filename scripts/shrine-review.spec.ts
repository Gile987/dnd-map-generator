import { expect, test } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { drawEditorProp } from '../src/app/rendering/editor-prop';
import { editorFixture } from './editor-test-support';
import { forestEditorFixture } from './forest-editor-test-support';
import { courtyardEditorFixture } from './courtyard-editor-test-support';
import { towerEditorFixture } from './tower-editor-test-support';
import {
  ALL_PRESETS,
  ALL_FOREST_CHARACTERS,
  ALL_COURTYARD_CHARACTERS,
} from '../src/app/engine/model';
import type { EditorDrawing } from '../src/app/rendering/editor-prop';
test('shrine drawings fit one occupied cell at all turns and retain the map palette', () => {
  const dungeon = editorFixture(),
    forest = forestEditorFixture(),
    courtyard = courtyardEditorFixture();
  const themes: readonly (readonly [string, EditorDrawing])[] = [
    ...ALL_PRESETS.map(
      (preset) =>
        [
          `Dungeon ${preset}`,
          { ...dungeon, decoration: { ...dungeon.decoration, preset } },
        ] as const,
    ),
    ...ALL_FOREST_CHARACTERS.map(
      (character) =>
        [
          `Forest ${character}`,
          { ...forest, decoration: { ...forest.decoration, character } },
        ] as const,
    ),
    ...ALL_COURTYARD_CHARACTERS.map(
      (character) =>
        [
          `Courtyard ${character}`,
          { ...courtyard, decoration: { ...courtyard.decoration, character } },
        ] as const,
    ),
    ['Tower', towerEditorFixture({ floorCount: 3, portalFloor: null })],
  ];
  const sheet = createCanvas(900, themes.length * 180 + 20),
    paint = sheet.getContext('2d');
  paint.fillStyle = '#f7f4e9';
  paint.fillRect(0, 0, sheet.width, sheet.height);
  paint.fillStyle = '#243d35';
  paint.font = '16px sans-serif';
  for (const [row, [name, map]] of themes.entries()) {
    paint.fillText(name, 10, 90 + row * 180);
    for (const rotation of [0, 1, 2, 3] as const) {
      const cell = createCanvas(256, 256),
        ctx = cell.getContext('2d');
      ctx.scale(64, 64);
      drawEditorProp(
        ctx,
        {
          kind: 'ruined_shrine',
          x: 1,
          y: 1,
          ...(rotation ? { artRotation: rotation } : {}),
          variation: 0.5,
          blocking: true,
        },
        map,
      );
      const pixels = ctx.getImageData(0, 0, 256, 256).data,
        width = 1,
        height = 1;
      let count = 0,
        outside = false;
      for (let y = 0; y < 256; y++)
        for (let x = 0; x < 256; x++)
          if (pixels[(y * 256 + x) * 4 + 3]) {
            count++;
            if (x < 64 || x >= (1 + width) * 64 || y < 64 || y >= (1 + height) * 64) outside = true;
          }
      expect(outside).toBe(false);
      expect(count).toBeGreaterThan(1000);
      const x = 290 + rotation * 145,
        y = 15 + row * 180;
      paint.drawImage(
        cell,
        64,
        64,
        width * 64,
        height * 64,
        x + (140 - width * 64) / 2,
        y + (140 - height * 64) / 2,
        width * 64,
        height * 64,
      );
      paint.fillText(`${rotation * 90}°`, x + 45, y + 160);
    }
  }
  mkdirSync('artifacts/ruined-shrine', { recursive: true });
  writeFileSync('artifacts/ruined-shrine/rotations.png', sheet.toBuffer('image/png'));
});
