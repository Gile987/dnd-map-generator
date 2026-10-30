import { createCanvas, loadImage } from '@napi-rs/canvas';
import { expect, test, vi } from 'vitest';
import { generateTower, TOWER_STAIR_STYLES } from '../engine/tower';
import { generateDungeon } from '../engine/generate';
import { exportBounds } from './export-bounds';
import { EXPORT_PRESETS, exportDimensions, exportGuidance } from './export-presets';
import { configuredExportFilename, createPng } from './export';
import { renderMap } from './render-map';

function tower(stairStyle: 'separate' | 'spiral' = 'spiral') {
  const result = generateTower({
    seed: 'floor-export',
    floorCount: 4,
    portalFloor: 2,
    stairStyle,
    density: 'Balanced',
    laboratoryFloor: 2,
  });
  if (!result.ok) throw new Error(result.error);
  return result.map;
}

for (const style of TOWER_STAIR_STYLES)
  for (const pixelsPerTile of [64, 70, 100])
    test(`${style} floor pixels match their original sheet at ${pixelsPerTile} px/square`, async () => {
      const map = tower(style),
        before = structuredClone(map);
      // The final floor is offset in both axes; a crop must retain the original grid phase.
      const floor = map.layout.floors[3];
      if (!floor) throw new Error('Missing floor');
      const bounds = exportBounds(map, floor.number, true);
      const whole = createCanvas(
        map.layout.width * pixelsPerTile,
        map.layout.height * pixelsPerTile,
      );
      const single = createCanvas(bounds.width * pixelsPerTile, bounds.height * pixelsPerTile);
      vi.stubGlobal('document', {
        createElement: () => {
          const canvas = createCanvas(1, 1);
          return Object.assign(canvas, {
            toBlob: (callback: BlobCallback) =>
              callback(new Blob([new Uint8Array(canvas.toBuffer('image/png'))])),
          });
        },
      });
      try {
        for (const grid of [false, true]) {
          const options = { grid, gridOpacity: 0.35, pixelsPerTile, showSecrets: true };
          renderMap(whole.getContext('2d'), map, options);
          const blob = await createPng(map, grid, 0.35, pixelsPerTile, true, floor.number);
          const image = await loadImage(Buffer.from(await blob.arrayBuffer()));
          expect([image.width, image.height]).toEqual([single.width, single.height]);
          single.getContext('2d').drawImage(image, 0, 0);
          const expected = whole
            .getContext('2d')
            .getImageData(
              bounds.x * pixelsPerTile,
              bounds.y * pixelsPerTile,
              single.width,
              single.height,
            ).data;
          const actual = single
            .getContext('2d')
            .getImageData(0, 0, single.width, single.height).data;
          expect(Buffer.from(actual).equals(Buffer.from(expected))).toBe(true);
        }
      } finally {
        vi.unstubAllGlobals();
      }
      expect(map).toEqual(before);
    });

test('floor bounds, VTT guidance and filenames use the selected floor without unrelated laboratory metadata', () => {
  const map = tower();
  expect(exportBounds(map, 2)).toMatchObject({ width: 16, height: 18 });
  for (const preset of EXPORT_PRESETS) {
    expect(exportDimensions(preset.pixelsPerTile, map, 2)).toEqual({
      width: 16 * preset.pixelsPerTile,
      height: 18 * preset.pixelsPerTile,
    });
    const name = configuredExportFilename(map, false, 15, preset, false, 2);
    expect(name).toContain('-tower-floor-2-');
    expect(name).toContain('-laboratory-floor-2');
    expect(name).toContain(`-16x18-${preset.pixelsPerTile}px-grid-off.png`);
    expect(configuredExportFilename(map, false, 15, preset, false, 1)).not.toContain('laboratory');
  }
  expect(exportGuidance(EXPORT_PRESETS[1], map, 2)).toContain('16 columns and 18 rows');
  expect(exportGuidance(EXPORT_PRESETS[2], map, 2)).toContain('16 × 18 grid units');
});

test('hidden, invalid and non-tower floor requests are rejected before allocating a canvas', async () => {
  const map = tower();
  const secret = map.layout.floors.find((floor) => floor.secret);
  if (!secret) throw new Error('Missing secret');
  expect(() => exportBounds(map, secret.number)).toThrow('Show secrets');
  expect(() =>
    configuredExportFilename(map, false, 15, EXPORT_PRESETS[0], false, secret.number),
  ).toThrow('Show secrets');
  await expect(createPng(map, false, undefined, 64, false, secret.number)).rejects.toThrow(
    'Show secrets',
  );
  for (const floor of [0, -1, 5, 1.5, NaN, Infinity])
    await expect(createPng(map, false, undefined, 64, true, floor)).rejects.toThrow(
      'available tower floor',
    );
  const dungeon = generateDungeon({
    seed: 'floor-export',
    roomCount: 6,
    preset: 'Mosslit',
    density: 'Balanced',
  });
  if (!dungeon.ok) throw new Error(dungeon.error);
  await expect(createPng(dungeon.map, false, undefined, 64, true, 1)).rejects.toThrow(
    'only for towers',
  );
  expect(exportBounds(map, secret.number, true)).toMatchObject({ width: 16, height: 18 });
});

test('a missing crop drawing surface rejects the export without altering the accepted map', async () => {
  const map = tower(),
    before = structuredClone(map);
  const createElement = vi
    .fn()
    .mockImplementationOnce(() => createCanvas(1, 1))
    .mockImplementationOnce(() => ({ getContext: () => null }));
  vi.stubGlobal('document', { createElement });
  try {
    await expect(createPng(map, true, 0.15, 64, false, 2)).rejects.toThrow('drawing surface');
    expect(createElement).toHaveBeenCalledTimes(2);
    expect(map).toEqual(before);
  } finally {
    vi.unstubAllGlobals();
  }
});
