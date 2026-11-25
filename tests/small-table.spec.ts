import { createCanvas } from '@napi-rs/canvas';
import { renderMap } from '../src/app/rendering/render-map';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { editorFixture } from '../scripts/editor-test-support';
import { forestEditorFixture } from '../scripts/forest-editor-test-support';
import { courtyardEditorFixture } from '../scripts/courtyard-editor-test-support';
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
async function position(page: Page, target: Point) {
  await page.getByRole('spinbutton', { name: 'Column', exact: true }).fill(String(target.x + 1));
  await page.getByRole('spinbutton', { name: 'Row', exact: true }).fill(String(target.y + 1));
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

for (const source of [
  editorFixture(),
  forestEditorFixture(),
  courtyardEditorFixture(),
  towerEditorFixture({ floorCount: 3, portalFloor: null }),
])
  test(`${source.type}: place, rotate, undo and reopen a one-square table`, async ({ page }) => {
    test.setTimeout(60000);
    if (source.type === 'tower') await page.setViewportSize({ width: 320, height: 700 });
    const map = clear(source),
      next = placement(map, (target) => ({ kind: 'add', propKind: 'small_table', target }));
    await page.goto('/');
    await page.locator('.import-label input').setInputFiles({
      name: 'table-source.json',
      mimeType: 'application/json',
      buffer: Buffer.from(serializeBundle([fixtureRecord(map, 'Table source', 'table-source')])),
    });
    await expect(page.locator('.library-message .notice')).toHaveText('Imported 1 map.');
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await ready(page);
    await page.getByRole('button', { name: 'Edit objects', exact: true }).click();
    await page.getByRole('button', { name: 'Add object', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Find an object', exact: true }).fill('table');
    const card = page.getByRole('button', { name: 'Add Small table', exact: true });
    await expect(card).toContainText('Blocks 1 square');
    await card.screenshot({ path: `artifacts/small-table/${source.type}-catalog.png` });
    await card.click();
    await position(page, next.target);
    await page.getByRole('button', { name: 'Place object', exact: true }).click();
    const rotation = applyEditorCommand(next.map, {
      kind: 'move',
      id: 'added-1',
      target: next.target,
      rotation: 1,
    });
    if (!rotation.ok) throw Error(rotation.error);
    const rotated = { map: rotation.document, target: next.target };
    await page
      .getByRole('combobox', { name: 'Objects on this map', exact: true })
      .selectOption('added-1');
    const canvas = page.locator('forge-preview canvas');
    await canvas.focus();
    await page.keyboard.press('e');
    await expect(page.getByRole('status', { name: 'Object rotation' })).toHaveText(
      '90° from original',
    );
    await position(page, rotated.target);
    await canvas.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Undo map change', exact: true }).click();
    expect((await snapshot(page, 'Table before turn')).map).toEqual(next.map);
    await page.getByRole('button', { name: 'Redo map change', exact: true }).click();
    const saved = await snapshot(page, 'Rotated table');
    expect(saved.map).toEqual(rotated.map);
    const prop = editorInstances(saved.map).find((item) => item.id === 'added-1')?.prop;
    expect(prop).toMatchObject({
      kind: 'small_table',
      artRotation: 1,
    });
    expect(prop?.footprint).toBeUndefined();
    expect(prop?.rotation).toBeUndefined();
    const image = await pngHash(page);
    await page.reload();
    await page
      .locator('.saved-item')
      .filter({ has: page.getByText('Rotated table', { exact: true }) })
      .getByRole('button', { name: 'Open', exact: true })
      .click();
    await ready(page);
    expect(await pngHash(page)).toBe(image);
    await page.getByRole('button', { name: 'Edit objects', exact: true }).click();
    await page
      .getByRole('combobox', { name: 'Objects on this map', exact: true })
      .selectOption('added-1');
    await page
      .locator('forge-object-editor')
      .screenshot({ path: `artifacts/small-table/${source.type}-editing.png` });
  });
