import { createHash } from 'node:crypto';
import { dungeonInstances } from '../src/app/engine/object-editor/document';
import { individualObjectLock } from '../src/app/engine/object-editor/dungeon-authoring-rules';
import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from 'vitest';
import { editorFixture, validCommand } from './editor-test-support';
import { DUNGEON_PALETTE_V2 } from '../src/app/engine/object-editor/catalog';
import { applyObjectCommand } from '../src/app/engine/object-editor/commands';
import { renderMap } from '../src/app/rendering/render-map';
import { resolveDungeon } from '../src/app/engine/object-editor/document';
import { exportFilename } from '../src/app/rendering/export';

test('authored artwork is shared by rendering/export, original pixels restore exactly, and all catalog kinds place without changing the base', () => {
  const base = editorFixture();
  const canvas = createCanvas(1280, 960),
    ctx = canvas.getContext('2d');
  renderMap(ctx, base, { grid: true, pixelsPerTile: 32 });
  const pixels = () =>
    createHash('sha256')
      .update(ctx.getImageData(0, 0, 1280, 960).data)
      .digest('hex');
  const original = pixels();
  let cleared: import('../src/app/engine/model').DungeonDocument = base;
  for (const item of dungeonInstances(base).filter(
    (item) => item.prop.blocking && !individualObjectLock(base, item.id, item.prop),
  )) {
    const result = applyObjectCommand(cleared, { kind: 'remove', id: item.id });
    if (!result.ok) throw new Error(result.error);
    cleared = result.document;
  }
  const timings: Record<string, number> = {};
  mkdirSync('artifacts/object-editor', { recursive: true });
  for (const item of DUNGEON_PALETTE_V2) {
    const command = validCommand(cleared, (target) => ({
      kind: 'add',
      propKind: item.kind,
      target,
    }));
    const start = performance.now();
    for (let n = 0; n < 30; n++) expect(applyObjectCommand(cleared, command).ok).toBe(true);
    timings[item.kind] = (performance.now() - start) / 30;
    const result = applyObjectCommand(cleared, command);
    if (!result.ok) throw new Error(result.error);
    expect(result.document.decoration).toBe(base.decoration);
    expect(resolveDungeon(result.document).decoration.props).toHaveLength(
      resolveDungeon(cleared).decoration.props.length + 1,
    );
    renderMap(ctx, result.document, { grid: true, pixelsPerTile: 32 });
    expect(pixels()).not.toEqual(original);
    expect(exportFilename(result.document)).toContain('-customized-');
    writeFileSync(`artifacts/object-editor/${item.kind}.png`, canvas.toBuffer('image/png'));
    const reset = applyObjectCommand(result.document, { kind: 'reset' });
    if (!reset.ok) throw new Error(reset.error);
    renderMap(ctx, reset.document, { grid: true, pixelsPerTile: 32 });
    expect(pixels()).toEqual(original);
  }
  expect(exportFilename(base)).not.toContain('customized');
  writeFileSync(
    'artifacts/object-editor/validation-timings.json',
    JSON.stringify(
      {
        note: 'Local mean milliseconds per pure validation/command, 30 repeats. Not a browser or low-end-device benchmark.',
        timings,
      },
      null,
      2,
    ),
  );
});
