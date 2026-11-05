import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from 'vitest';
import { courtyardGroupFixture, acceptCourtyard } from './courtyard-editor-test-support';
import { renderMap } from '../src/app/rendering/render-map';
import { drawEditorProp } from '../src/app/rendering/editor-prop';
import { drawProp } from '../src/app/rendering/props';
import { propBounds } from '../src/app/engine/prop-footprint';
import { resolveCourtyard } from '../src/app/engine/object-editor/courtyard-document';
import { makeSavedMap, parseSavedMap } from '../src/app/save/save-format';
import type { CourtyardDocument } from '../src/app/engine/object-editor/courtyard-document';
import type { Prop } from '../src/app/engine/model';
const hash = (bytes: Uint8ClampedArray) => createHash('sha256').update(bytes).digest('hex');

test.each(['fountain', 'wagon'] as const)(
  '%s accepted artwork roundtrips exactly, resets to original pixels, and shares unscaled prop drawing with ghosts',
  (id) => {
    const { base, prepared, group, target } = courtyardGroupFixture(id),
      canvas = createCanvas(1280, 960),
      ctx = canvas.getContext('2d');
    const draw = (map: CourtyardDocument) => {
      renderMap(ctx, map, { grid: true, pixelsPerTile: 32 });
      return hash(ctx.getImageData(0, 0, 1280, 960).data);
    };
    const basePixels = draw(base),
      preparedPixels = draw(prepared),
      contact = createCanvas(id === 'wagon' ? 768 : 192, 192),
      c = contact.getContext('2d');
    const hashes: string[] = [];
    for (const rotation of id === 'wagon' ? ([0, 1, 2, 3] as const) : ([0] as const)) {
      const edited = acceptCourtyard(prepared, { kind: 'move-group', id, target, rotation }),
        pixels = draw(edited);
      hashes.push(pixels);
      expect(pixels).not.toBe(preparedPixels);
      const saved = makeSavedMap(
          edited,
          'Authored courtyard',
          'data:image/png;base64,AAAA',
          'authored-court',
          '2026-11-03T12:00:00Z',
        ),
        reopened = parseSavedMap(saved);
      if (reopened?.map.type !== 'courtyard') throw Error('Missing saved courtyard');
      expect(draw(reopened.map)).toBe(pixels);
      c.drawImage(canvas, target.x * 32, target.y * 32, 192, 192, rotation * 192, 0, 192, 192);
      const drawing = resolveCourtyard(edited);
      if (drawing.objectEdits !== 'resolved') throw Error('Missing drawing');
      const body = drawing.instances.find(
        (item) => group.members.includes(item.id) && item.prop.footprint,
      )?.prop;
      if (!body) throw Error('Missing body');
      function sprite(prop: Prop, custom: boolean) {
        const b = propBounds(prop),
          surface = createCanvas(b.width * 64, b.height * 64),
          sc = surface.getContext('2d');
        sc.setTransform(64, 0, 0, 64, -b.x * 64, -b.y * 64);
        if (custom) drawEditorProp(sc, prop, drawing);
        else drawProp(sc, prop);
        return hash(sc.getImageData(0, 0, surface.width, surface.height).data);
      }
      // Footprint rotation is already part of the established asset renderer;
      // resolving or moving the group must add no fitting or scaling.
      expect(sprite(body, true)).toBe(sprite(body, false));
      expect(draw(acceptCourtyard(edited, { kind: 'reset' }))).toBe(basePixels);
    }
    expect(new Set(hashes).size).toBe(id === 'wagon' ? 4 : 1);
    mkdirSync('artifacts/courtyard-editor', { recursive: true });
    writeFileSync(`artifacts/courtyard-editor/${id}-native.png`, contact.toBuffer('image/png'));
  },
);
