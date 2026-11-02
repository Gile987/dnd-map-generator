import { createHash } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from 'vitest';
import fixture from '../save/fixtures/dungeon-editor-v1.json';
import { parseBundle, serializeBundle } from '../save/save-format';
import { renderMap } from './render-map';

// Captured before authored-v2 rules or artwork were introduced; never regenerate
// these expectations from the new authoring implementation.
const hashes = [
  '5c7034a8292d0dfdde6406cd0a852157f163e745350b96a4b7d4ef12f6545b61',
  '05161f6b99d185266fefc6c27c19f9132fea4fae4355a4561d961a72e26b815d',
  '96465df5da42d605a2184fcc7b9a2c8a813a7b93c8099750598777b7c01653cb',
  'eb2e84208ea74bfbb87592892c32187f3d3209f504ba818b2fcfbb7c6c1f262e',
];
test('format-19 authored-v1 snapshots retain their original models and pixels through opening and backup', () => {
  const result = parseBundle(JSON.stringify(fixture));
  if (!result.ok) throw new Error(result.error);
  for (const [i, saved] of result.maps.entries()) {
    expect(saved.map).toEqual(fixture.maps[i]?.map);
    if (saved.map.type !== 'dungeon') throw new Error('Missing dungeon');
    expect(saved.map.objectEdits?.version).toBe(1);
    const canvas = createCanvas(1280, 960),
      ctx = canvas.getContext('2d');
    renderMap(ctx, saved.map, { grid: true, pixelsPerTile: 32 });
    expect(
      createHash('sha256')
        .update(ctx.getImageData(0, 0, 1280, 960).data)
        .digest('hex'),
    ).toBe(hashes[i]);
  }
  expect(parseBundle(serializeBundle(result.maps))).toEqual(result);
});
