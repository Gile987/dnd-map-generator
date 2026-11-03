import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { expect, test, vi } from 'vitest';
import { rotationFixture } from '../../../scripts/editor-test-support';
import { applyObjectCommand } from '../engine/object-editor/commands';
import { resolveDungeon } from '../engine/object-editor/document';
import { QUARTER_TURNS } from '../engine/prop-footprint';
import { makeSavedMap, parseSavedMap } from '../save/save-format';
import { renderMap } from './render-map';
import { drawDungeonRitualFloor } from './ritual-props';
import { ritualCenter } from '../engine/dungeon-ritual';
import { drawDungeonProp } from './dungeon-prop-layer';
import { drawProp } from './props';
import { studySurfaceMarks } from './study-surface';

function hash(data: Uint8ClampedArray) {
  return createHash('sha256').update(data).digest('hex');
}
test.each(['study', 'statue', 'table', 'ritual'] as const)(
  '%s produces four distinct reproducible orientations and restores exact unrotated pixels',
  (id) => {
    const { prepared, group, target } = rotationFixture(id);
    const canvas = createCanvas(1280, 960),
      ctx = canvas.getContext('2d');
    const sheet = createCanvas(4 * 256, 256),
      sheetContext = sheet.getContext('2d');
    const hashes = new Set<string>();
    let zero = '';
    for (const rotation of QUARTER_TURNS) {
      const result = applyObjectCommand(prepared, { kind: 'move-group', id, target, rotation });
      if (!result.ok) throw Error(result.error);
      renderMap(ctx, result.document, { grid: true, pixelsPerTile: 32 });
      const pixels = hash(ctx.getImageData(0, 0, 1280, 960).data);
      hashes.add(pixels);
      if (rotation === 0) zero = pixels;
      const saved = makeSavedMap(
        result.document,
        'Turn',
        'data:image/png;base64,AAAA',
        'turn',
        '2026-11-03T12:00:00Z',
      );
      const reopened = parseSavedMap(saved);
      if (!reopened) throw Error('Missing save');
      renderMap(ctx, reopened.map, { grid: true, pixelsPerTile: 32 });
      expect(hash(ctx.getImageData(0, 0, 1280, 960).data)).toBe(pixels);
      sheetContext.drawImage(
        canvas,
        (target.x - 1) * 32,
        (target.y - 1) * 32,
        256,
        256,
        rotation * 256,
        0,
        256,
        256,
      );
      const back = applyObjectCommand(result.document, {
        kind: 'move-group',
        id,
        target,
        rotation: 0,
      });
      if (!back.ok) throw Error(back.error);
      renderMap(ctx, back.document, { grid: true, pixelsPerTile: 32 });
      expect(hash(ctx.getImageData(0, 0, 1280, 960).data)).toBe(zero);
    }
    expect(hashes.size).toBe(4);
    mkdirSync('artifacts/addition-rotation', { recursive: true });
    writeFileSync(`artifacts/addition-rotation/${id}-turns.png`, sheet.toBuffer('image/png'));
    expect(group.members.length).toBeGreaterThan(0);
  },
);

test('ritual floor centre and orientation follow the same geometric rotation as its altar and candles', () => {
  const { base, prepared, group, target } = rotationFixture('ritual');
  const altar = base.decoration.props.find((p) => p.kind === 'ritual_altar');
  if (!altar) throw Error('Missing altar');
  const centre = ritualCenter(altar),
    local = { x: centre.x - group.area.x, y: centre.y - group.area.y };
  const points = [
    local,
    { x: group.area.height - 1 - local.y, y: local.x },
    { x: group.area.width - 1 - local.x, y: group.area.height - 1 - local.y },
    { x: local.y, y: group.area.width - 1 - local.x },
  ];
  for (const rotation of QUARTER_TURNS) {
    const result = applyObjectCommand(prepared, {
      kind: 'move-group',
      id: 'ritual',
      target,
      rotation,
    });
    if (!result.ok) throw Error(result.error);
    const ctx = createCanvas(1280, 960).getContext('2d');
    const translate = vi.spyOn(ctx, 'translate'),
      rotate = vi.spyOn(ctx, 'rotate');
    drawDungeonRitualFloor(ctx, resolveDungeon(result.document));
    const point = points[rotation];
    if (!point) throw Error('Missing expected centre');
    expect(translate.mock.calls[0]).toEqual([target.x + point.x + 0.5, target.y + point.y + 0.5]);
    expect(rotate.mock.calls[0]?.[0]).toBe(
      (((Math.floor(altar.variation * 4) + rotation) % 4) * Math.PI) / 2,
    );
  }
});

test('rotating a bookshelf preserves its original book colours and weathering', () => {
  const { prepared, target } = rotationFixture('study');
  const result = applyObjectCommand(prepared, {
    kind: 'move-group',
    id: 'study',
    target,
    rotation: 1,
  });
  if (!result.ok) throw Error(result.error);
  const drawing = resolveDungeon(result.document),
    prop = drawing.decoration.props.find((p) => p.kind === 'bookshelf');
  if (!prop || drawing.objectEdits !== 'resolved') throw Error('Missing shelf');
  const canvas = createCanvas(200, 200),
    ctx = canvas.getContext('2d');
  ctx.scale(64, 64);
  ctx.translate(1 - prop.x, 1 - prop.y);
  drawDungeonProp(ctx, prop, {
    ...drawing,
    layout: { ...drawing.layout, tiles: Array<boolean>(1200).fill(true) },
  });
  const actual = hash(ctx.getImageData(0, 0, 200, 200).data);
  ctx.resetTransform();
  ctx.clearRect(0, 0, 200, 200);
  ctx.scale(64, 64);
  ctx.translate(1.5, 1.5);
  ctx.rotate(Math.PI / 2);
  ctx.translate(-prop.x - 0.5, -prop.y - 0.5);
  drawProp(ctx, prop);
  expect(hash(ctx.getImageData(0, 0, 200, 200).data)).toBe(actual);
});

test('study papers turn with their arrangement; doorway wear remains attached to the architecture', () => {
  const { base, prepared, target } = rotationFixture('study');
  const source = studySurfaceMarks(base);
  for (const rotation of QUARTER_TURNS) {
    const result = applyObjectCommand(prepared, {
      kind: 'move-group',
      id: 'study',
      target,
      rotation,
    });
    if (!result.ok) throw Error(result.error);
    const marks = studySurfaceMarks(resolveDungeon(result.document));
    expect(marks.filter((m) => m.kind === 'wear')).toEqual(source.filter((m) => m.kind === 'wear'));
    for (const mark of marks.filter((m) => m.kind !== 'wear'))
      expect(
        source.some(
          (s) => s.kind === mark.kind && s.angle + (rotation * Math.PI) / 2 === mark.angle,
        ),
      ).toBe(true);
  }
});

test('ritual candle clusters rotate while each flame remains upright', () => {
  const { prepared, target } = rotationFixture('ritual');
  for (const rotation of QUARTER_TURNS) {
    const result = applyObjectCommand(prepared, {
      kind: 'move-group',
      id: 'ritual',
      target,
      rotation,
    });
    if (!result.ok) throw Error(result.error);
    const drawing = resolveDungeon(result.document),
      candle = drawing.decoration.props.find((p) => p.kind === 'ritual_candles');
    if (!candle) throw Error('Missing candle cluster');
    const ctx = createCanvas(1280, 960).getContext('2d'),
      rotate = vi.spyOn(ctx, 'rotate');
    drawDungeonProp(ctx, candle, drawing);
    const clusterAngle = rotate.mock.calls[0]?.[0],
      flameAngle = rotate.mock.calls[1]?.[0];
    expect(clusterAngle).toBe(((Math.floor(candle.variation * 4) + rotation) * Math.PI) / 2);
    expect((clusterAngle ?? NaN) + (flameAngle ?? NaN)).toBe(0);
  }
});
