import { createCanvas } from '@napi-rs/canvas';
import { renderMap } from '../src/app/rendering/render-map';
import { generateCourtyard } from '../src/app/engine/courtyard-generate';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { editorFixture } from '../scripts/editor-test-support';
import { forestEditorFixture } from '../scripts/forest-editor-test-support';
import { towerEditorFixture } from '../scripts/tower-editor-test-support';
import { applyEditorCommand } from '../src/app/engine/object-editor/editor-commands';
import { editorSelections, editorInstances } from '../src/app/engine/object-editor/editor-view';
import { mapDimensions } from '../src/app/engine/model';
import type { EditableMapDocument, Point } from '../src/app/engine/model';
import type { ObjectCommand } from '../src/app/engine/object-editor/object-command';
import { towerFloorAt } from '../src/app/engine/tower';
import {
  makeSavedMap,
  parseSavedMap,
  serializeBundle,
  SAVE_STORAGE_KEY,
} from '../src/app/save/save-format';

function fixtureRecord(map: EditableMapDocument, name: string, id: string) {
  const { width, height } = mapDimensions(map);
  const canvas = createCanvas(width * 8, height * 8);
  renderMap(canvas.getContext('2d'), map, { pixelsPerTile: 8, grid: false });
  return makeSavedMap(map, name, canvas.toDataURL(), id, '2026-11-19T12:00:00Z');
}

function clear(base: EditableMapDocument): EditableMapDocument {
  let map = base;
  for (const item of editorSelections(base)) {
    if (!item.removable) continue;
    const result = applyEditorCommand(map, { kind: 'remove', id: item.id });
    if (!result.ok) throw Error(result.error);
    map = result.document;
  }
  return map;
}
function placement(map: EditableMapDocument, make: (target: Point) => ObjectCommand, skip?: Point) {
  const { width } = mapDimensions(map);
  for (const [index, walkable] of map.layout.tiles.entries()) {
    if (!walkable) continue;
    const target = { x: index % width, y: Math.floor(index / width) };
    if (target.x === skip?.x && target.y === skip.y) continue;
    if (map.type === 'tower' && towerFloorAt(map, target)?.number !== 1) continue;
    const command = make(target),
      result = applyEditorCommand(map, command);
    if (result.ok && result.document !== map) return { command, map: result.document, target };
  }
  throw Error('Fixture needs a valid placement');
}
async function ready(page: Page) {
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('forge-preview canvas')).toBeVisible();
}
async function snapshot(page: Page, name: string) {
  await ready(page);
  await expect(page.locator('.library')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#save-name').fill(name);
  await page.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(page.locator('.library-message .notice')).toHaveText(`Saved “${name}”.`);
  const saved: unknown = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? '[]'),
    SAVE_STORAGE_KEY,
  );
  if (!Array.isArray(saved)) throw Error('Missing library');
  const record = saved.map(parseSavedMap).find((entry) => entry?.name === name);
  if (!record) throw Error('Missing saved map');
  return record;
}
async function download(page: Page, label: string) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: label, exact: true }).click();
  const file = await pending;
  return readFile(await file.path());
}
async function pngHash(page: Page) {
  return createHash('sha256')
    .update(await download(page, 'Quick export PNG'))
    .digest('hex');
}
const definitions = [
  { type: 'Dungeon', create: () => editorFixture('Storehouse'), extra: ['desk', 'bookshelf'] },
  { type: 'Forest', create: () => forestEditorFixture('Fey'), extra: ['bedroll'] },
  {
    type: 'Courtyard',
    create: () => {
      const result = generateCourtyard({
        seed: 'ivy-court',
        density: 'Balanced',
        character: 'Frostbound',
        fountain: true,
        wagon: true,
      });
      if (!result.ok) throw Error(result.error);
      return result.map;
    },
    extra: ['log', 'stump'],
  },
  {
    type: 'Tower',
    create: () => towerEditorFixture({ floorCount: 3, portalFloor: null }),
    extra: ['fern'],
  },
] as const;

for (const definition of definitions)
  test(`${definition.type}: independent rotation stages, cancels, undoes and reopens with exact PNGs`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    if (definition.type === 'Tower') await page.setViewportSize({ width: 320, height: 700 });
    const source = clear(definition.create());
    const next = placement(source, (target) => ({ kind: 'add', propKind: 'weapon_rack', target }));
    const record = fixtureRecord(next.map, 'Rotation source', 'rotation-source');
    await page.goto('/');
    await page.locator('.import-label input').setInputFiles({
      name: 'rotation.json',
      mimeType: 'application/json',
      buffer: Buffer.from(serializeBundle([record])),
    });
    await expect(page.locator('.library-message .notice')).toHaveText('Imported 1 map.');
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await ready(page);
    await page.getByRole('button', { name: 'Edit objects', exact: true }).click();
    await page.getByRole('combobox', { name: 'Objects on this map' }).selectOption('added-1');
    const original = await pngHash(page);
    const right = page.getByRole('button', { name: 'Rotate object right', exact: true });
    await right.click();
    await expect(page.getByRole('status', { name: 'Object rotation' })).toHaveText(
      '90° from original',
    );
    await expect(page.locator('.placement-status')).toHaveText(
      'Valid position — choose Place object',
    );
    await page.screenshot({
      path: `artifacts/object-rotation/${definition.type}-preview.png`,
      fullPage: true,
    });
    await page.keyboard.press('Escape');
    expect(await pngHash(page)).toBe(original);
    await right.click();
    await page.getByRole('button', { name: 'Place object', exact: true }).click();
    const rotated = await pngHash(page);
    expect(rotated).not.toBe(original);
    const saved = await snapshot(page, 'Rotated rack');
    expect(editorInstances(saved.map).find((item) => item.id === 'added-1')?.prop.artRotation).toBe(
      1,
    );
    await page.getByRole('button', { name: 'Undo map change', exact: true }).click();
    expect(await pngHash(page)).toBe(original);
    await page.getByRole('button', { name: 'Redo map change', exact: true }).click();
    expect(await pngHash(page)).toBe(rotated);
    await page.reload();
    await page
      .locator('.saved-item')
      .filter({ hasText: 'Rotated rack' })
      .getByRole('button', { name: 'Open', exact: true })
      .click();
    await ready(page);
    expect(await pngHash(page)).toBe(rotated);
    await page.getByRole('button', { name: 'Edit objects', exact: true }).click();
    await page.getByRole('combobox', { name: 'Objects on this map' }).selectOption('added-1');
    await page.screenshot({
      path: `artifacts/object-rotation/${definition.type}.png`,
      fullPage: true,
    });
  });

test('new object rotation supports keyboard activation and invalid-placement recovery', async ({
  page,
}) => {
  const source = clear(editorFixture());
  const next = placement(source, (target) => ({
    kind: 'add',
    propKind: 'treasure_chest',
    target,
    rotation: 3,
  }));
  await page.goto('/');
  await page.locator('.import-label input').setInputFiles({
    name: 'source.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serializeBundle([fixtureRecord(source, 'Source', 'source')])),
  });
  await expect(page.locator('.library-message .notice')).toHaveText('Imported 1 map.');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await ready(page);
  await page.getByRole('button', { name: 'Edit objects', exact: true }).click();
  await page.getByRole('button', { name: 'Add object', exact: true }).click();
  await page.getByRole('button', { name: 'Add Treasure chest', exact: true }).click();
  const left = page.getByRole('button', { name: 'Rotate object left', exact: true });
  await left.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status', { name: 'Object rotation' })).toHaveText(
    '270° from original',
  );
  await page.getByRole('spinbutton', { name: 'Column', exact: true }).fill('0');
  await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeDisabled();
  await page
    .getByRole('spinbutton', { name: 'Column', exact: true })
    .fill(String(next.target.x + 1));
  await page.getByRole('spinbutton', { name: 'Row', exact: true }).fill(String(next.target.y + 1));
  await page.getByRole('button', { name: 'Place object', exact: true }).click();
  const record = await snapshot(page, 'Turned chest');
  expect(record.map).toEqual(next.map);

  await page.getByRole('combobox', { name: 'Objects on this map' }).selectOption('added-1');
  const destination = placement(
    next.map,
    (target) => ({ kind: 'move', id: 'added-1', target, rotation: 2 }),
    next.target,
  );
  await left.click();
  const canvas = page.locator('forge-preview canvas');
  await canvas.scrollIntoViewIfNeeded();
  const rect = await canvas.boundingBox();
  if (!rect) throw Error('Missing canvas');
  const scale = Math.min(rect.width / 40, rect.height / 30) * 0.94;
  const x = rect.x + (rect.width - 40 * scale) / 2 + (next.target.x + 0.5) * scale;
  const y = rect.y + (rect.height - 30 * scale) / 2 + (next.target.y + 0.5) * scale;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(
    x + (destination.target.x - next.target.x) * scale,
    y + (destination.target.y - next.target.y) * scale,
    { steps: 6 },
  );
  await expect(page.locator('.placement-status')).toHaveText('Valid position — release to place');
  await page.mouse.up();
  const dragged = await snapshot(page, 'Dragged chest');
  expect(dragged.map).toEqual(destination.map);
});
