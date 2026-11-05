import { createHash } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from 'vitest';
import fixture from '../save/fixtures/forest-editor-v25.json';
import { parseBundle } from '../save/save-format';
import { renderMap } from './render-map';
import { forestEditorFixture } from '../../../scripts/forest-editor-test-support';

// Captured before the Forest editor changed any model or rendering code.
const baselines = [
  [
    'Verdant',
    'da2dafa103a9ef0658d55f39e8e3990deb5c0dfeb381865223e66dd0b5fb7f58',
    '7b96c739a52784717fef1b4097bfb54e91fab5a924c6cbe8cb10bd743cd27839',
    '241f7e79ce622cfdeb9142ef5aea96555c3ccfe0372f5233c7475940495db77b',
  ],
  [
    'Autumn',
    '82d454dd7cc67d027e98b33ba144634497ad40cc9a149f62fd4554007ed3a7b1',
    '54f170788ec7653328d679270ae4daccdbf112a1271d2510ac2a17b483db942f',
    'a6a2af9ac18e8233c9680cae7ae03bce9619b023be637f0432915a515d5a7eb3',
  ],
  [
    'Pines',
    'de70d61c5bf1fe39658b9cbedd274385becee6468efcdc31781305ca5683812f',
    '5f02b55d12553cf25f5a982d9adbc365dde24efb5edcdb1f24f2616adb8e31f0',
    '8348781d19d36b6251fffa6262a7dd0e6af88f0d57bf5dbf224741c3e5725f8a',
  ],
  [
    'Fey',
    'bfe4cd2c2e8e5f8218320c75a75198ac07b575a0663ce5f891fcdbd1fbbf3ed5',
    'c80649bbd9e1852ee858e57acdf63907fc9af291528642cb5ca45a10298a9d83',
    'c0995a2a5786b49fc8b75dc60bc387db95e46eb05016c877942e5e83c24cc780',
  ],
] as const;
const hash = (bytes: string | Uint8ClampedArray) =>
  createHash('sha256').update(bytes).digest('hex');
test.each(baselines)(
  'preserves independent %s pre-editor models and both grid pixel baselines',
  (character, model, withoutGrid, withGrid) => {
    const before = structuredClone(fixture),
      parsed = parseBundle(JSON.stringify(fixture));
    if (!parsed.ok) throw Error(parsed.error);
    const map = parsed.maps.find(
      (record) => record.map.type === 'forest' && record.map.decoration.character === character,
    )?.map;
    if (!map || map.type !== 'forest' || map.objectEdits) throw Error('Missing canonical fixture');
    expect(hash(JSON.stringify(map))).toBe(model);
    expect(hash(JSON.stringify(forestEditorFixture(character)))).toBe(model);
    for (const grid of [false, true]) {
      const canvas = createCanvas(1280, 960),
        ctx = canvas.getContext('2d');
      renderMap(ctx, map, { grid, pixelsPerTile: 32 });
      expect(hash(ctx.getImageData(0, 0, 1280, 960).data)).toBe(grid ? withGrid : withoutGrid);
    }
    expect(fixture).toEqual(before);
  },
);
