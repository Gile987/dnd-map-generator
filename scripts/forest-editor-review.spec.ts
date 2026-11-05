import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from 'vitest';
import { forestGroupFixture, acceptForest } from './forest-editor-test-support';
import { resolveForest } from '../src/app/engine/object-editor/forest-document';
import type {
  ForestDocument,
  ForestGroupId,
} from '../src/app/engine/object-editor/forest-document';
import { drawEditorProp } from '../src/app/rendering/editor-prop';
import { drawProp } from '../src/app/rendering/props';
import { FOREST_PALETTES } from '../src/app/rendering/forest-palette';
import { renderMap } from '../src/app/rendering/render-map';
import { forestSurfacePatches } from '../src/app/rendering/forest-surface';
import { makeSavedMap, parseSavedMap } from '../src/app/save/save-format';
import { propBounds } from '../src/app/engine/prop-footprint';
import type { ForestCharacter } from '../src/app/engine/model';
const hash = (bytes: Uint8ClampedArray) => createHash('sha256').update(bytes).digest('hex');
const cases: readonly [ForestGroupId, ForestCharacter][] = [
  ['camp', 'Verdant'],
  ['stone-circle', 'Verdant'],
  ['fallen-tree', 'Verdant'],
  ['fallen-tree', 'Autumn'],
  ['fallen-tree', 'Pines'],
  ['fallen-tree', 'Fey'],
];
test.each(cases)(
  '%s/%s artwork retains exact native scale, palette, four orientations and saved/reset pixels',
  (id, character) => {
    const { base, prepared, group, target } = forestGroupFixture(id, character),
      canvas = createCanvas(1280, 960),
      ctx = canvas.getContext('2d');
    const draw = (map: ForestDocument) => {
      renderMap(ctx, map, { grid: true, pixelsPerTile: 32 });
      return hash(ctx.getImageData(0, 0, 1280, 960).data);
    };
    const original = draw(base),
      contact = createCanvas(1024, 224),
      contactCtx = contact.getContext('2d'),
      seen = new Set<string>();
    for (const rotation of [0, 1, 2, 3] as const) {
      const map = acceptForest(prepared, { kind: 'move-group', id, target, rotation }),
        drawing = resolveForest(map),
        pixels = draw(map);
      if (drawing.objectEdits !== 'resolved') throw Error('Missing drawing');
      seen.add(pixels);
      const saved = makeSavedMap(
          map,
          'Edited forest',
          'data:image/png;base64,AAAA',
          'review',
          '2026-11-05T12:00:00Z',
        ),
        reopened = parseSavedMap(saved);
      if (reopened?.map.type !== 'forest') throw Error('Missing reopened forest');
      expect(draw(reopened.map)).toBe(pixels);
      for (const item of drawing.instances.filter((item) => group.members.includes(item.id))) {
        const sprite = (custom: boolean) => {
          const p = item.prop,
            b = propBounds(p),
            surface = createCanvas(b.width * 64, b.height * 64),
            sc = surface.getContext('2d');
          sc.setTransform(64, 0, 0, 64, -b.x * 64, -b.y * 64);
          if (custom) drawEditorProp(sc, p, drawing);
          else {
            if (!p.footprint) {
              sc.translate(p.x + 0.5, p.y + 0.5);
              sc.rotate((rotation * Math.PI) / 2);
              sc.translate(-p.x - 0.5, -p.y - 0.5);
            }
            drawProp(sc, p, FOREST_PALETTES[character]);
          }
          return hash(sc.getImageData(0, 0, surface.width, surface.height).data);
        };
        expect(sprite(true)).toBe(sprite(false));
      }
      if (id === 'camp') {
        const hearth = drawing.decoration.props.find((prop) => prop.kind === 'fire_ring');
        if (!hearth) throw Error('Missing hearth');
        expect(
          forestSurfacePatches(drawing).some(
            (p) => p.kind === 'ash' && p.x === hearth.x + 0.5 && p.y === hearth.y + 0.5,
          ),
        ).toBe(true);
      }
      contactCtx.drawImage(
        canvas,
        target.x * 32,
        target.y * 32,
        256,
        224,
        rotation * 256,
        0,
        256,
        224,
      );
      expect(draw(acceptForest(map, { kind: 'reset' }))).toBe(original);
    }
    expect(seen.size).toBe(4);
    mkdirSync('artifacts/forest-editor', { recursive: true });
    writeFileSync(`artifacts/forest-editor/${id}-${character}.png`, contact.toBuffer('image/png'));
  },
);
