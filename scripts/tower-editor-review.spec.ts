import { createCanvas } from '@napi-rs/canvas';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import {
  towerStairFixture,
  towerGroupFixture,
  acceptTower,
  clearTower,
  towerEditorFixture,
  validTowerCommand,
} from './tower-editor-test-support';
import { resolveTower } from '../src/app/engine/object-editor/tower-document';
import type { TowerDocument } from '../src/app/engine/object-editor/tower-document';
import { makeSavedMap, parseSavedMap } from '../src/app/save/save-format';
import { drawEditorProp } from '../src/app/rendering/editor-prop';
import { drawProp } from '../src/app/rendering/props';
import { drawRitualCandles } from '../src/app/rendering/ritual-props';
import { renderMap } from '../src/app/rendering/render-map';
import { exportBounds } from '../src/app/rendering/export-bounds';
const hash = (bytes: Uint8ClampedArray) => createHash('sha256').update(bytes).digest('hex');
test.each(['laboratory', 'observatory'] as const)(
  '%s retains scale, upright candle flames, four turns, exact saved pixels and Reset',
  (id) => {
    const { base, prepared, group, target, floor } = towerGroupFixture(id),
      canvas = createCanvas(base.layout.width * 16, base.layout.height * 16),
      ctx = canvas.getContext('2d');
    const draw = (map: TowerDocument) => {
      renderMap(ctx, map, { grid: true, showSecrets: true, pixelsPerTile: 16 });
      return hash(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
    };
    const original = draw(base),
      seen = new Set<string>(),
      contact = createCanvas(1024, 256),
      cc = contact.getContext('2d');
    for (const rotation of [0, 1, 2, 3] as const) {
      const edited = acceptTower(prepared, { kind: 'move-group', id, target, rotation }),
        drawing = resolveTower(edited),
        pixels = draw(edited);
      seen.add(pixels);
      if (drawing.objectEdits !== 'resolved') throw Error('Missing drawing');
      const saved = makeSavedMap(
          edited,
          'Tower artwork',
          'data:image/png;base64,AAAA',
          'art',
          '2026-11-05T12:00:00Z',
        ),
        reopened = parseSavedMap(saved);
      if (reopened?.map.type !== 'tower') throw Error('Missing reopened Tower');
      expect(draw(reopened.map)).toBe(pixels);
      for (const item of drawing.instances.filter((i) => group.members.includes(i.id))) {
        const sprite = (custom: boolean) => {
          const p = item.prop,
            s = createCanvas(64, 64),
            sc = s.getContext('2d');
          sc.setTransform(64, 0, 0, 64, -p.x * 64, -p.y * 64);
          if (custom) drawEditorProp(sc, p, drawing);
          else if (rotation && p.kind === 'ritual_candles') {
            sc.translate(p.x + 0.5, p.y + 0.5);
            sc.lineWidth = 0.025;
            drawRitualCandles(sc, p, rotation);
          } else {
            if (rotation) {
              sc.translate(p.x + 0.5, p.y + 0.5);
              sc.rotate((rotation * Math.PI) / 2);
              sc.translate(-p.x - 0.5, -p.y - 0.5);
            }
            drawProp(sc, p);
          }
          return hash(sc.getImageData(0, 0, 64, 64).data);
        };
        expect(sprite(true)).toBe(sprite(false));
      }
      cc.drawImage(
        canvas,
        (floor.x - 1) * 16,
        (floor.y - 2) * 16,
        256,
        256,
        rotation * 256,
        0,
        256,
        256,
      );
      expect(draw(acceptTower(edited, { kind: 'reset' }))).toBe(original);
    }
    expect(seen.size).toBe(4);
    mkdirSync('artifacts/tower-editor', { recursive: true });
    writeFileSync(`artifacts/tower-editor/${id}-turns.png`, contact.toBuffer('image/png'));
  },
);

test('player images and public-floor crops omit secret edits and their layer annotations; GM images retain both', () => {
  const base = towerEditorFixture(),
    secret = base.layout.floors.find((f) => f.secret),
    prepared = clearTower(base);
  if (!secret) throw Error('Missing secret floor');
  const command = validTowerCommand(prepared, secret.number, (target) => ({
    kind: 'add',
    propKind: 'crate',
    target,
  }));
  if (command.kind !== 'add') throw Error('Missing placement');
  const box = acceptTower(prepared, command),
    cover = acceptTower(box, { kind: 'add', propKind: 'moss', target: command.target }),
    edited = acceptTower(cover, { kind: 'order', id: 'added-2', direction: 'forward' });
  const draw = (map: TowerDocument, showSecrets: boolean, layers = false) => {
    const c = createCanvas(map.layout.width * 16, map.layout.height * 16),
      ctx = c.getContext('2d'),
      labels: string[] = [];
    const fillText = ctx.fillText.bind(ctx);
    ctx.fillText = (text, ...args) => {
      labels.push(text);
      fillText(text, ...args);
    };
    renderMap(ctx, map, {
      grid: false,
      showSecrets,
      showLayerIndicators: layers,
      pixelsPerTile: 16,
    });
    return { c, ctx, labels, pixels: hash(ctx.getImageData(0, 0, c.width, c.height).data) };
  };
  const player = draw(edited, false),
    playerLayers = draw(edited, false, true),
    gm = draw(edited, true),
    gmLayers = draw(edited, true, true);
  expect(player.pixels).toBe(draw(prepared, false).pixels);
  expect(playerLayers.pixels).toBe(player.pixels);
  expect(playerLayers.labels.some((s) => s.includes('underneath'))).toBe(false);
  expect(gm.pixels).not.toBe(draw(prepared, true).pixels);
  expect(gmLayers.pixels).not.toBe(gm.pixels);
  expect(gmLayers.labels).toContain('Crate underneath');
  const publicFloor = base.layout.floors.find((f) => !f.secret);
  if (!publicFloor) throw Error('Missing public floor');
  const bounds = exportBounds(edited, publicFloor.number, false),
    before = draw(prepared, false);
  expect(
    playerLayers.ctx.getImageData(
      bounds.x * 16,
      bounds.y * 16,
      bounds.width * 16,
      bounds.height * 16,
    ).data,
  ).toEqual(
    before.ctx.getImageData(bounds.x * 16, bounds.y * 16, bounds.width * 16, bounds.height * 16)
      .data,
  );
  expect(() => exportBounds(edited, secret.number, false)).toThrow('Show secrets');
  expect(exportBounds(edited, secret.number, true).width).toBe(16);
});

test.each(['spiral', 'separate'] as const)(
  '%s moved stairs preserve route captions, other floors, saved pixels and Reset artwork',
  (stairStyle) => {
    const { base, prepared, stair, moved } = towerStairFixture(stairStyle),
      canvas = createCanvas(base.layout.width * 16, base.layout.height * 16),
      ctx = canvas.getContext('2d');
    const draw = (map: TowerDocument) => {
      const labels: string[] = [],
        native = ctx.fillText.bind(ctx);
      ctx.fillText = (value, x, y, ...rest) => {
        labels.push(value);
        native(value, x, y, ...rest);
      };
      try {
        renderMap(ctx, map, { grid: true, showSecrets: true, pixelsPerTile: 16 });
      } finally {
        ctx.fillText = native;
      }
      return {
        labels,
        pixels: hash(ctx.getImageData(0, 0, canvas.width, canvas.height).data),
        floors: base.layout.floors.map((f) =>
          hash(ctx.getImageData((f.x - 1) * 16, (f.y - 4) * 16, 256, 288).data),
        ),
      };
    };
    const original = draw(prepared),
      authored = draw(moved);
    expect(authored.labels).toEqual(original.labels);
    expect(authored.pixels).not.toBe(original.pixels);
    for (const floor of base.layout.floors) {
      if (floor.number === stair.floor)
        expect(authored.floors[floor.number - 1]).not.toBe(original.floors[floor.number - 1]);
      else expect(authored.floors[floor.number - 1]).toBe(original.floors[floor.number - 1]);
    }
    const reopened = parseSavedMap(
      makeSavedMap(
        moved,
        'Moved staircases',
        'data:image/png;base64,AAAA',
        'stairs',
        '2026-11-05T12:00:00Z',
      ),
    );
    if (reopened?.map.type !== 'tower') throw Error('Missing saved Tower');
    expect(draw(reopened.map)).toEqual(authored);
    mkdirSync('artifacts/tower-editor', { recursive: true });
    writeFileSync(
      `artifacts/tower-editor/${stairStyle}-moved-stairs.png`,
      canvas.toBuffer('image/png'),
    );
    expect(draw(acceptTower(moved, { kind: 'move', id: stair.id, target: stair }))).toEqual(
      original,
    );
    expect(draw(acceptTower(moved, { kind: 'reset' }))).toEqual(draw(base));
  },
);
