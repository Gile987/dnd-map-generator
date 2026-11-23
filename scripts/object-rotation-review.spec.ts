import { propBounds } from '../src/app/engine/prop-footprint';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from 'vitest';
import { editorFixture } from './editor-test-support';
import { forestEditorFixture } from './forest-editor-test-support';
import { courtyardEditorFixture } from './courtyard-editor-test-support';
import { towerEditorFixture } from './tower-editor-test-support';
import { applyEditorCommand } from '../src/app/engine/object-editor/editor-commands';
import {
  editorPalette,
  editorSelections,
  editorInstances,
  resolveEditorMap,
} from '../src/app/engine/object-editor/editor-view';
import type { EditableMapDocument } from '../src/app/engine/model';
import { mapDimensions } from '../src/app/engine/model';
import { drawEditorProp } from '../src/app/rendering/editor-prop';

for (const source of [
  editorFixture(),
  forestEditorFixture(),
  courtyardEditorFixture(),
  towerEditorFixture({ floorCount: 3, portalFloor: null }),
])
  test(`${source.type}: review every independent object's four orientations`, () => {
    let map: EditableMapDocument = source;
    for (const item of editorSelections(source))
      if (item.removable) {
        const result = applyEditorCommand(map, { kind: 'remove', id: item.id });
        if (!result.ok) throw Error(result.error);
        map = result.document;
      }
    const palette = editorPalette(map);
    const sheet = createCanvas(540, (palette.length + 1) * 100),
      ctx = sheet.getContext('2d');
    ctx.fillStyle = '#f7f4e9';
    ctx.fillRect(0, 0, sheet.width, sheet.height);
    ctx.fillStyle = '#243d35';
    ctx.font = '16px sans-serif';
    ctx.fillText(source.type, 12, 28);
    for (const [i, angle] of [0, 90, 180, 270].entries())
      ctx.fillText(`${angle}°`, 200 + i * 85, 28);
    for (const [row, entry] of palette.entries()) {
      const { width } = mapDimensions(map);
      let placed: EditableMapDocument | undefined;
      for (const [index, walkable] of map.layout.tiles.entries()) {
        if (!walkable) continue;
        const result = applyEditorCommand(map, {
          kind: 'add',
          propKind: entry.kind,
          target: { x: index % width, y: Math.floor(index / width) },
        });
        if (result.ok) {
          placed = result.document;
          break;
        }
      }
      if (!placed) throw Error(`No space for ${entry.kind}`);
      const original = editorInstances(placed).find((item) => item.id === 'added-1');
      if (!original) throw Error('Missing object');
      const hashes: string[] = [];
      ctx.fillStyle = '#243d35';
      ctx.fillText(entry.label, 12, 100 + row * 100);
      for (const rotation of [0, 1, 2, 3] as const) {
        const result = applyEditorCommand(placed, {
          kind: 'move',
          id: original.id,
          target: original.prop,
          rotation,
        });
        if (!result.ok) throw Error(result.error);
        const prop = editorInstances(result.document).find((item) => item.id === original.id)?.prop;
        if (!prop) throw Error('Missing rotated object');
        const cell = createCanvas(80, 80),
          paint = cell.getContext('2d');
        paint.fillStyle = '#536863';
        paint.fillRect(0, 0, 80, 80);
        paint.translate(40, 40);
        const scale = entry.kind === 'wooden_bench' ? 34 : entry.kind === 'rug' ? 24 : 64;
        paint.scale(scale, scale);
        const bounds = propBounds(prop);
        paint.translate(-prop.x - bounds.width / 2, -prop.y - bounds.height / 2);
        drawEditorProp(paint, prop, resolveEditorMap(result.document));
        hashes.push(createHash('sha256').update(cell.toBuffer('image/png')).digest('hex'));
        ctx.drawImage(cell, 185 + rotation * 85, 55 + row * 100);
      }
      if (['treasure_chest', 'weapon_rack', 'desk', 'bookshelf', 'bedroll'].includes(entry.kind))
        expect(new Set(hashes).size).toBe(4);
    }
    mkdirSync('artifacts/object-rotation', { recursive: true });
    writeFileSync(
      `artifacts/object-rotation/${source.type}-catalog.png`,
      sheet.toBuffer('image/png'),
    );
  });
