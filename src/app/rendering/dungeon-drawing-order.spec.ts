import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { expect, test, vi } from 'vitest';
import { layeredRugFixture } from '../../../scripts/layer-test-support';
import { renderMap } from './render-map';
import type { DungeonDocument } from '../engine/model';
import { makeSavedMap, parseSavedMap } from '../save/save-format';
import { configuredExportFilename } from './export';

function hash(data: Uint8ClampedArray) {
  return createHash('sha256').update(data).digest('hex');
}

test('ordering changes only the overlapped artwork; annotations are opt-in and saved reopen is pixel exact', () => {
  const { rug, prepared, covered } = layeredRugFixture();
  const canvas = createCanvas(1280, 960),
    ctx = canvas.getContext('2d');
  function draw(map: DungeonDocument, showLayerIndicators = false) {
    renderMap(ctx, map, { grid: true, pixelsPerTile: 32, showLayerIndicators });
    return ctx.getImageData(0, 0, 1280, 960).data;
  }
  const text = vi.spyOn(ctx, 'fillText');
  const before = draw(prepared),
    after = draw(covered),
    annotated = draw(covered, true);
  expect(text).toHaveBeenCalledWith(
    'Crate + Barrel underneath',
    expect.any(Number),
    expect.any(Number),
  );
  text.mockRestore();
  expect(hash(before)).not.toBe(hash(after));
  expect(hash(after)).not.toBe(hash(annotated));
  let changes = 0;
  for (let i = 0; i < before.length; i += 4) {
    if (
      before[i] === after[i] &&
      before[i + 1] === after[i + 1] &&
      before[i + 2] === after[i + 2] &&
      before[i + 3] === after[i + 3]
    )
      continue;
    changes++;
    const x = ((i / 4) % 1280) / 32,
      y = Math.floor(i / 4 / 1280) / 32;
    if (x < rug.prop.x - 2 || x > rug.prop.x + 3 || y < rug.prop.y - 2 || y > rug.prop.y + 3)
      throw Error('Reordering changed unrelated artwork');
  }
  expect(changes).toBeGreaterThan(100);
  const saved = makeSavedMap(
    covered,
    'Covered',
    'data:image/png;base64,AAAA',
    'covered',
    '2026-11-03T12:00:00Z',
  );
  const reopened = parseSavedMap(saved);
  if (reopened?.map.type !== 'dungeon') throw Error('Missing reopened dungeon');
  expect(hash(draw(reopened.map))).toBe(hash(after));
  expect(hash(draw(covered))).toBe(hash(after));
  expect(configuredExportFilename(covered, true, 15, undefined, false, undefined, true)).toMatch(
    /-layers.png$/,
  );
  expect(configuredExportFilename(covered, true, 15)).not.toContain('-layers');
  mkdirSync('artifacts/dungeon-layers', { recursive: true });
  const contact = createCanvas(576, 192),
    c = contact.getContext('2d');
  const examples: readonly (readonly [DungeonDocument, boolean])[] = [
    [prepared, false],
    [covered, false],
    [covered, true],
  ];
  for (const [i, [map, indicators]] of examples.entries()) {
    draw(map, indicators);
    c.drawImage(
      canvas,
      (rug.prop.x - 2) * 32,
      (rug.prop.y - 2) * 32,
      192,
      192,
      i * 192,
      0,
      192,
      192,
    );
  }
  writeFileSync('artifacts/dungeon-layers/order-and-indicators.png', contact.toBuffer('image/png'));
});
