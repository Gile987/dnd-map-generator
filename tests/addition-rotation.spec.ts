import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { rotationFixture, validCommand } from '../scripts/editor-test-support';
import { applyObjectCommand } from '../src/app/engine/object-editor/commands';
import {
  makeSavedMap,
  parseSavedMap,
  serializeBundle,
  SAVE_STORAGE_KEY,
} from '../src/app/save/save-format';
import type { DungeonDocument, Point } from '../src/app/engine/model';
import { dungeonInstances } from '../src/app/engine/object-editor/document';
import { propBounds } from '../src/app/engine/prop-footprint';

async function ready(page: Page) {
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
}
async function position(page: Page, p: Point) {
  await page.getByRole('spinbutton', { name: 'Column', exact: true }).fill(String(p.x + 1));
  await page.getByRole('spinbutton', { name: 'Row', exact: true }).fill(String(p.y + 1));
}
async function snapshot(page: Page, name: string) {
  await ready(page);
  await expect(page.locator('.library')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#save-name').fill(name);
  await page.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(page.locator('.library-message .notice')).toHaveText(`Saved “${name}”.`);
  const raw: unknown = JSON.parse(
    (await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)) ?? '[]',
  );
  if (!Array.isArray(raw)) throw Error('Missing library');
  const saved = raw.map(parseSavedMap).find((s) => s?.name === name);
  if (!saved || saved.map.type !== 'dungeon') throw Error('Missing dungeon');
  return saved.map;
}
async function png(page: Page) {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  const file = await download;
  const data = await readFile(await file.path());
  await ready(page);
  return data;
}
async function open(page: Page, doc: DungeonDocument) {
  const saved = makeSavedMap(
    doc,
    'Rotation fixture',
    'data:image/png;base64,AAAA',
    'rotation-fixture',
    '2026-11-03T12:00:00Z',
  );
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({
    name: 'rotation.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serializeBundle([saved])),
  });
  await expect(page.locator('.library-message .notice')).toContainText('Imported 1 map');
  await page.locator('.saved-item').getByRole('button', { name: 'Open', exact: true }).click();
  await ready(page);
  await page.getByRole('button', { name: 'Edit objects', exact: true }).click();
}
for (const id of ['study', 'statue', 'table', 'ritual'] as const)
  test(`${id} rotation previews, cancellation, exact undo/reopen/PNG and correction use one grid transform`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    const { prepared, target } = rotationFixture(id);
    await open(page, prepared);
    const select = page.getByRole('combobox', { name: 'Objects on this map', exact: true });
    await select.selectOption(`group-${id}`);
    await position(page, target);
    for (let i = 0; i < 4; i++)
      await page.getByRole('button', { name: 'Rotate addition right', exact: true }).click();
    await expect(page.getByRole('status', { name: 'Addition rotation' })).toHaveText(
      '0° from generated',
    );
    await page.getByRole('button', { name: 'Rotate addition left', exact: true }).click();
    await expect(page.getByRole('status', { name: 'Addition rotation' })).toHaveText(
      '270° from generated',
    );
    await page.keyboard.press('Escape');
    expect(await snapshot(page, 'Canceled turn')).toEqual(prepared);
    await select.selectOption(`group-${id}`);
    await position(page, target);
    await page.getByRole('button', { name: 'Rotate addition right', exact: true }).click();
    await expect(page.getByRole('status', { name: 'Addition rotation' })).toHaveText(
      '90° from generated',
    );
    await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeEnabled();
    await expect(page.locator('.placement-status')).toHaveText(
      'Valid position — choose Place object',
    );
    await page
      .locator('forge-object-editor')
      .screenshot({ path: `artifacts/addition-rotation/${id}-preview.png` });
    await page.getByRole('button', { name: 'Place object', exact: true }).click();
    const turned = await snapshot(page, `Turned ${id}`),
      expected = applyObjectCommand(prepared, { kind: 'move-group', id, target, rotation: 1 });
    if (!expected.ok) throw Error(expected.error);
    expect(turned).toEqual(expected.document);
    const image = await png(page);
    await page.getByRole('button', { name: 'Undo map change', exact: true }).click();
    await ready(page);
    expect(await snapshot(page, 'Undo turn')).toEqual(prepared);
    await page.getByRole('button', { name: 'Redo map change', exact: true }).click();
    await ready(page);
    expect(await png(page)).toEqual(image);
    await page.reload();
    await page
      .locator('.saved-item')
      .filter({ has: page.locator('.saved-name').getByText(`Turned ${id}`, { exact: true }) })
      .getByRole('button', { name: 'Open', exact: true })
      .click();
    await ready(page);
    expect(await png(page)).toEqual(image);
    await page.getByRole('button', { name: 'Edit objects', exact: true }).click();
    await select.selectOption(`group-${id}`);
    await expect(page.getByRole('status', { name: 'Addition rotation' })).toHaveText(
      '90° from generated',
    );
    await page.getByRole('button', { name: 'Rotate addition left', exact: true }).click();
    await position(page, { x: 39, y: 29 });
    await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeDisabled();
    await expect(page.locator('.placement-status')).toContainText('complete addition');
    await position(page, target);
    await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeEnabled();
    if (id === 'study') {
      await page.setViewportSize({ width: 375, height: 812 });
      const left = page.getByRole('button', { name: 'Rotate addition left', exact: true });
      await left.focus();
      await expect(left).toBeFocused();
      await page
        .locator('forge-object-editor')
        .screenshot({ path: 'artifacts/addition-rotation/study-mobile.png' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.evaluate(() => {
        HTMLCanvasElement.prototype.toBlob = function (callback) {
          setTimeout(() => callback(null), 1200);
        };
      });
      await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
      await expect(left).toBeDisabled();
      await ready(page);
      await expect(left).toBeEnabled();
      await expect(page.locator('#settings-error')).toContainText('could not create a PNG');
    } else await page.keyboard.press('Escape');
  });

test('a staged table rotation survives dragging to a new anchor', async ({ page }) => {
  const fixture = rotationFixture('table');
  const start = applyObjectCommand(fixture.prepared, {
    kind: 'move-group',
    id: 'table',
    target: fixture.target,
    rotation: 0,
  });
  if (!start.ok) throw Error(start.error);
  const command = validCommand(
    start.document,
    (target) => ({ kind: 'move-group', id: 'table', target, rotation: 1 }),
    fixture.target,
  );
  if (command.kind !== 'move-group') throw Error('Missing destination');
  const table = dungeonInstances(start.document).find((i) => i.prop.kind === 'dining_table');
  if (!table) throw Error('Missing table');
  await open(page, start.document);
  await page
    .getByRole('combobox', { name: 'Objects on this map', exact: true })
    .selectOption('group-table');
  await page.getByRole('button', { name: 'Rotate addition right', exact: true }).click();
  const canvas = page.locator('forge-preview canvas');
  await canvas.scrollIntoViewIfNeeded();
  const rect = await canvas.boundingBox();
  if (!rect) throw Error('Missing canvas');
  const scale = Math.min(rect.width / 40, rect.height / 30) * 0.94;
  const bounds = propBounds(table.prop);
  const x = rect.x + (rect.width - 40 * scale) / 2 + (bounds.x + bounds.width / 2) * scale;
  const y = rect.y + (rect.height - 30 * scale) / 2 + (bounds.y + bounds.height / 2) * scale;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(
    x + (command.target.x - fixture.target.x) * scale,
    y + (command.target.y - fixture.target.y) * scale,
    { steps: 6 },
  );
  await expect(page.locator('.placement-status')).toHaveText('Valid position — release to place');
  await page.mouse.up();
  const expected = applyObjectCommand(start.document, command);
  if (!expected.ok) throw Error(expected.error);
  expect(await snapshot(page, 'Dragged rotation')).toEqual(expected.document);
});
