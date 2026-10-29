import { createHash } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from 'vitest';
import fixture from '../save/fixtures/tower-v1.json';
import sharedFixture from '../save/fixtures/tower-v2.json';
import { parseBundle, parseSavedMap, serializeBundle } from '../save/save-format';
import { changeTowerDensity, shuffleTowerDetails, isUsableTower } from '../engine/tower';
import { renderMap } from './render-map';

// Original v1 output was checked against its pre-change full pixel captures.
// Pin vector pixels and text drawing commands separately: installed system fonts
// can change glyph rasterization between local machines and CI runners.
const hashes = [
  [
    '7ce2e520cbf02c3f32888f984b55e0a83c720b4478b84066d35d9a7327ee23b2',
    '4d85eede08a53594a467a1fd42f0a79fc4ddee0267c21c3a4bfc43d7d900e581',
    '1dd4229e1eeec86329f3606f07f730e2bdb3c0e707d0c797c9d2c9ef7b725456',
    'b3614f1949e315633262e2ad886de40ee5872dd9fafac25c50748bf8d83d7fbd',
  ],
  [
    'fe2a20c7b598482ed7e0f7efcbd5b59c0bddd6e8e8f06386ee0cf6c7442dcff0',
    '1af4f1456beebb8bfd70ec365799eebf71ac386dd715a5633d44d228e0b85430',
  ],
  [
    '6160f64d8208abcccac7f41feb6ee107cef7228d2c5068bd83883e4d51fb2b8a',
    '704c6eff1c58db5662db44064de80a189663d98783c7c0f99ccfd282b3f48633',
    'a8b94a44bfbcbd86c6c6d12dabb76fa68a4d041afa86793e743e1cef859ee2d8',
    '49e7fe19692e8a0be8a3c15c10b121863f61636c3ad4d5df95aaecc2249899ac',
  ],
] as const;
const originalText = [
  '5461d599bb07787226a9e5212e910c99429ee99f67916b737fa3a2ff384dc6b3',
  'ee3cbc5a4ee9c2687949d6303e689be25fef3f21facd46737fc590b1401f2f37',
];
const textHashes = [
  originalText,
  originalText,
  [
    '196f9bd3b79da788907a65df72e80532a094fb192e441bb7ddcb693bb07f0c69',
    '9951d15685a3650ae9edca74f6c4b65ef25aadbfb337316f910f35606caa4256',
  ],
];
test('frozen Tower-v1/v2 saves preserve original models, vector pixels and text commands', () => {
  const sources = [...fixture.maps, ...sharedFixture.maps];
  const before = structuredClone([fixture, sharedFixture]);
  const parsed = parseBundle(JSON.stringify({ ...fixture, maps: sources }));
  if (!parsed.ok) throw new Error(parsed.error);
  expect(parsed.skipped).toBe(0);
  expect(parsed.maps).toHaveLength(3);
  for (const [i, saved] of parsed.maps.entries()) {
    const map = saved.map;
    if (map.type !== 'tower') throw new Error('Expected tower');
    expect(map.version).toBe(sources[i]?.map.version);
    expect(map).toEqual(sources[i]?.map);
    expect(parseSavedMap(saved)?.map).toBe(map);
    expect(isUsableTower({ ...map, version: '3.0.0' })).toBe(false);
    if (map.version === '1.0.0') expect(isUsableTower({ ...map, version: '2.0.0' })).toBe(false);
    let h = 0;
    for (const grid of [false, true])
      for (const showSecrets of map.layout.portalFloor === null ? [false] : [false, true]) {
        const canvas = createCanvas(map.layout.width * 64, map.layout.height * 64),
          ctx = canvas.getContext('2d');
        const commands: unknown[] = [];
        ctx.fillText = (text, x, y) => {
          const m = ctx.getTransform();
          commands.push([
            text,
            x,
            y,
            ctx.font,
            ctx.textAlign,
            ctx.fillStyle,
            m.a,
            m.b,
            m.c,
            m.d,
            m.e,
            m.f,
          ]);
        };
        renderMap(ctx, map, { grid, showSecrets, pixelsPerTile: 64 });
        expect(
          createHash('sha256')
            .update(ctx.getImageData(0, 0, canvas.width, canvas.height).data)
            .digest('hex'),
        ).toBe(hashes[i]?.[h++]);
        expect(createHash('sha256').update(JSON.stringify(commands)).digest('hex')).toBe(
          textHashes[i]?.[showSecrets ? 1 : 0],
        );
      }
    const shuffled = shuffleTowerDetails(map),
      sparse = changeTowerDensity(map, 'Sparse');
    for (const updated of [shuffled, sparse]) {
      expect(updated.version).toBe(map.version);
      expect(updated.layout).toBe(map.layout);
      expect(isUsableTower(updated)).toBe(true);
    }
  }
  expect(parseBundle(serializeBundle(parsed.maps))).toEqual(parsed);
  expect([fixture, sharedFixture]).toEqual(before);
});
