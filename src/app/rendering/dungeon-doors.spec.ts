import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from 'vitest';
import { editorFixture } from '../../../scripts/editor-test-support';
import { dungeonDoors, toggleDungeonDoor } from '../engine/dungeon-doors';
import { renderMap } from './render-map';
import { makeSavedMap, parseSavedMap } from '../save/save-format';

function hash(data: Uint8ClampedArray) {
  return createHash('sha256').update(data).digest('hex');
}
test.each(['horizontal', 'vertical'] as const)(
  '%s open-door artwork changes only the doorway and restores exact closed pixels through save/reopen',
  (axis) => {
    const base = editorFixture(),
      door = dungeonDoors(base.layout).find((d) => d.threshold.axis === axis);
    if (!door) throw Error('Missing doorway axis');
    const canvas = createCanvas(1280, 960),
      ctx = canvas.getContext('2d');
    renderMap(ctx, base, { grid: true, pixelsPerTile: 32 });
    const before = ctx.getImageData(0, 0, 1280, 960).data;
    const opened = toggleDungeonDoor(base, door.id);
    if (!opened.ok) throw Error(opened.error);
    renderMap(ctx, opened.document, { grid: true, pixelsPerTile: 32 });
    const after = ctx.getImageData(0, 0, 1280, 960).data;
    let changed = 0;
    for (let i = 0; i < before.length; i += 4) {
      if (
        before[i] === after[i] &&
        before[i + 1] === after[i + 1] &&
        before[i + 2] === after[i + 2] &&
        before[i + 3] === after[i + 3]
      )
        continue;
      changed++;
      const x = (i / 4) % 1280,
        y = Math.floor(i / 4 / 1280),
        d = door.threshold;
      if (x < (d.x - 1) * 32 || x > (d.x + 3) * 32 || y < (d.y - 1) * 32 || y > (d.y + 3) * 32)
        throw Error('Door toggle changed unrelated artwork');
    }
    expect(changed).toBeGreaterThan(50);
    const saved = makeSavedMap(
      opened.document,
      'Open',
      'data:image/png;base64,AAAA',
      'door',
      '2026-11-03T12:00:00Z',
    );
    const reopened = parseSavedMap(saved);
    if (!reopened) throw Error('Missing opened map');
    renderMap(ctx, reopened.map, { grid: true, pixelsPerTile: 32 });
    expect(hash(ctx.getImageData(0, 0, 1280, 960).data)).toBe(hash(after));
    const close = toggleDungeonDoor(opened.document, door.id);
    if (!close.ok) throw Error(close.error);
    renderMap(ctx, close.document, { grid: true, pixelsPerTile: 32 });
    expect(hash(ctx.getImageData(0, 0, 1280, 960).data)).toBe(hash(before));
    mkdirSync('artifacts/dungeon-doors', { recursive: true });
    const contact = createCanvas(384, 192),
      c = contact.getContext('2d'),
      d = door.threshold;
    c.drawImage(canvas, (d.x - 2) * 32, (d.y - 2) * 32, 192, 192, 0, 0, 192, 192);
    renderMap(ctx, opened.document, { grid: true, pixelsPerTile: 32 });
    c.drawImage(canvas, (d.x - 2) * 32, (d.y - 2) * 32, 192, 192, 192, 0, 192, 192);
    writeFileSync(`artifacts/dungeon-doors/${axis}-closed-open.png`, contact.toBuffer('image/png'));
  },
);
