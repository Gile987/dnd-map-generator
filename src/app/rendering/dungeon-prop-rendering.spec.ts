import { createHash } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from 'vitest';
import { editorFixture } from '../../../scripts/editor-test-support';
import type { Dungeon, DungeonDocument } from '../engine/model';
import { applyObjectCommand } from '../engine/object-editor/commands';
import { DUNGEON_PALETTE_V2 } from '../engine/object-editor/catalog';
import { dungeonBase, dungeonInstances } from '../engine/object-editor/document';
import { individualObjectLock } from '../engine/object-editor/dungeon-authoring-rules';
import { makeSavedMap, parseSavedMap } from '../save/save-format';
import { renderMap } from './render-map';

function pixels(map: DungeonDocument) {
  const canvas = createCanvas(800, 600);
  renderMap(canvas.getContext('2d'), map, { grid: true, pixelsPerTile: 20 });
  return createHash('sha256')
    .update(canvas.getContext('2d').getImageData(0, 0, 800, 600).data)
    .digest('hex');
}

test.each(DUNGEON_PALETTE_V2.map((item) => item.kind))(
  '%s uses exactly the generated drawing at its chosen wall-side grid position, including after save/reopen',
  (kind) => {
    const base = editorFixture(),
      source = dungeonInstances(base).find((item) => item.prop.kind === kind);
    let document: DungeonDocument = base;
    for (const item of dungeonInstances(base)) {
      if (item.id === source?.id || individualObjectLock(base, item.id, item.prop)) continue;
      const result = applyObjectCommand(document, { kind: 'remove', id: item.id });
      if (!result.ok) throw Error(result.error);
      document = result.document;
    }
    const target = kind === 'rug' ? { x: 18, y: 25 } : { x: 20, y: 26 };
    const moved = applyObjectCommand(
      document,
      source ? { kind: 'move', id: source.id, target } : { kind: 'add', propKind: kind, target },
    );
    if (!moved.ok) throw Error(moved.error);
    // Painting reference only: identical resolved props through the unedited
    // renderer. It need not satisfy the generator's room-distribution rules.
    const canonical: Dungeon = {
      ...dungeonBase(moved.document),
      decoration: {
        ...base.decoration,
        props: dungeonInstances(moved.document).map((item) => item.prop),
      },
    };
    expect(pixels(moved.document)).toEqual(pixels(canonical));
    const saved = makeSavedMap(
      moved.document,
      'Wall placement',
      'data:image/png;base64,AAAA',
      'wall-placement',
      '2026-11-02T12:00:00Z',
    );
    const reopened = parseSavedMap(saved);
    if (reopened?.map.type !== 'dungeon') throw Error('Missing reopened map');
    expect(pixels(reopened.map)).toEqual(pixels(canonical));
  },
);
