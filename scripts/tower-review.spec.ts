import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { generateTower, TOWER_STAIR_STYLES } from '../src/app/engine/tower';
import { renderMap } from '../src/app/rendering/render-map';
import {
  exportDimensions,
  EXPORT_PRESETS,
  exportGuidance,
} from '../src/app/rendering/export-presets';
import { exportFilename, configuredExportFilename } from '../src/app/rendering/export';

test('real tower artwork hides the entire destination and both portal ends without moving regular floor pixels', () => {
  mkdirSync('artifacts/tower', { recursive: true });
  for (const stairStyle of TOWER_STAIR_STYLES)
    for (const floorCount of [3, 4, 8]) {
      const result = generateTower({
        seed: 'astral-watch',
        stairStyle,
        floorCount,
        portalFloor: 2,
        density: 'Balanced',
      });
      if (!result.ok) throw new Error(result.error);
      const map = result.map;
      const images = [];
      for (const showSecrets of [false, true]) {
        const width = map.layout.width * 32,
          height = map.layout.height * 32,
          canvas = createCanvas(width, height),
          ctx = canvas.getContext('2d');
        renderMap(ctx, map, { grid: false, pixelsPerTile: 32, showSecrets });
        const pixels = ctx.getImageData(0, 0, width, height).data;
        images.push(Buffer.from(pixels));
        writeFileSync(
          `artifacts/tower/${floorCount}-${stairStyle}-${showSecrets ? 'gm' : 'player'}.png`,
          canvas.toBuffer('image/png'),
        );
        const secret = map.layout.floors.find((f) => f.secret);
        if (!secret) throw new Error('Missing floor');
        const sample = ctx.getImageData((secret.x + 7) * 32, (secret.y + 6) * 32, 1, 1).data;
        if (showSecrets) expect([...sample]).not.toEqual([21, 35, 42, 255]);
        else expect([...sample]).toEqual([21, 35, 42, 255]);
      }
      expect(images[0]?.equals(images[1] ?? Buffer.alloc(0))).toBe(false);
      // Independent player reference: physically remove secret data rather than
      // relying on the renderer's visibility branch to hide it.
      const secretFloor = map.layout.floors.find((f) => f.secret);
      if (!secretFloor) throw new Error('Missing secret floor');
      const reference = createCanvas(map.layout.width * 32, map.layout.height * 32);
      renderMap(
        reference.getContext('2d'),
        {
          ...map,
          layout: {
            ...map.layout,
            floors: map.layout.floors.filter((f) => !f.secret),
            connections: map.layout.connections.filter((c) => c.kind === 'stairs'),
          },
          decoration: {
            ...map.decoration,
            props: map.decoration.props.filter(
              (p) =>
                p.x < secretFloor.x ||
                p.x >= secretFloor.x + secretFloor.width ||
                p.y < secretFloor.y ||
                p.y >= secretFloor.y + secretFloor.height,
            ),
          },
        },
        { grid: false, pixelsPerTile: 32, showSecrets: true },
      );
      const referencePixels = reference
        .getContext('2d')
        .getImageData(0, 0, reference.width, reference.height).data;
      expect(images[0]?.equals(Buffer.from(referencePixels))).toBe(true);
      // Floor one contains no portal and must remain byte-identical in both images.
      const a = images[0],
        b = images[1];
      if (!a || !b) throw new Error('Missing pixels');
      const stride = map.layout.width * 32 * 4;
      for (let y = 0; y < 18 * 32; y++)
        expect(
          a
            .subarray(y * stride, y * stride + 16 * 32 * 4)
            .equals(b.subarray(y * stride, y * stride + 16 * 32 * 4)),
        ).toBe(true);
      expect(exportFilename(map)).toContain('-player.png');
      expect(exportFilename(map, true)).toContain('-gm-secrets.png');
      for (const preset of EXPORT_PRESETS) {
        expect(exportDimensions(preset.pixelsPerTile, map)).toEqual({
          width: map.layout.width * preset.pixelsPerTile,
          height: map.layout.height * preset.pixelsPerTile,
        });
        if (preset.id !== 'standard')
          expect(configuredExportFilename(map, false, 15, preset)).toContain(
            `${map.layout.width}x${map.layout.height}`,
          );
      }
      expect(exportGuidance(EXPORT_PRESETS[1], map)).toContain(
        `${map.layout.width} columns and ${map.layout.height} rows`,
      );
    }
});
