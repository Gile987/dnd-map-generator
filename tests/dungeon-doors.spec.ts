import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Point, DungeonDocument } from '../src/app/engine/model';
import { dungeonDoors, toggleDungeonDoor } from '../src/app/engine/dungeon-doors';
import { parseSavedMap, SAVE_STORAGE_KEY } from '../src/app/save/save-format';

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
  const raw: unknown = JSON.parse(
    (await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)) ?? '[]',
  );
  if (!Array.isArray(raw)) throw Error('Missing library');
  const saved = raw.map(parseSavedMap).find((s) => s?.name === name);
  if (!saved || saved.map.type !== 'dungeon') throw Error('Missing dungeon');
  return saved.map;
}
async function point(page: Page, p: Point, zoom = 1, pan = { x: 0, y: 0 }) {
  const canvas = page.locator('forge-preview canvas');
  await canvas.scrollIntoViewIfNeeded();
  const r = await canvas.boundingBox();
  if (!r) throw Error('Missing canvas');
  const scale = Math.min(r.width / 40, r.height / 30) * 0.94 * zoom;
  return {
    x: r.x + (r.width - 40 * scale) / 2 + pan.x + p.x * scale,
    y: r.y + (r.height - 30 * scale) / 2 + pan.y + p.y * scale,
  };
}
async function png(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  const file = await pending;
  const bytes = await readFile(await file.path());
  await ready(page);
  return bytes;
}
async function doors(page: Page) {
  await page.locator('.door-controls summary').click();
}
function centre(map: DungeonDocument, index = 0) {
  const door = dungeonDoors(map.layout)[index];
  if (!door) throw Error('Missing door');
  const d = door.threshold;
  return { door, point: d.axis === 'horizontal' ? { x: d.x + 1, y: d.y } : { x: d.x, y: d.y + 1 } };
}

test('clickable doors change exact accepted artwork, preserve drafts, survive shuffle/undo and saved PNG reopen', async ({
  page,
}) => {
  await page.goto('/');
  const base = await snapshot(page, 'Doors closed'),
    image = await png(page),
    entry = centre(base);
  await page.getByLabel('World seed').fill('pending-door-layout');
  const p = await point(page, entry.point);
  await page.mouse.move(p.x, p.y);
  await expect(page.locator('forge-preview canvas')).toHaveAttribute('title', 'Open door');
  await page.mouse.click(p.x, p.y);
  await ready(page);
  await expect(page.locator('.status')).toContainText('Door opened');
  await expect(page.locator('forge-preview canvas')).toHaveAttribute('title', 'Close door');
  const opened = await snapshot(page, 'One open door'),
    expected = toggleDungeonDoor(base, entry.door.id);
  if (!expected.ok) throw Error(expected.error);
  expect(opened).toEqual(expected.document);
  expect(opened.objectEdits).toBeUndefined();
  await expect(page.getByLabel('World seed')).toHaveValue('pending-door-layout');
  const openImage = await png(page);
  expect(openImage).not.toEqual(image);
  await page.getByRole('button', { name: 'Shuffle details', exact: true }).click();
  await ready(page);
  expect((await snapshot(page, 'Shuffled open door')).doorStates).toEqual(opened.doorStates);
  await page.getByRole('button', { name: 'Undo change', exact: true }).click();
  await ready(page);
  expect(await png(page)).toEqual(openImage);
  await page.getByRole('button', { name: 'Undo change', exact: true }).click();
  await ready(page);
  expect(await png(page)).toEqual(image);
  await page.getByRole('button', { name: 'Redo change', exact: true }).click();
  await ready(page);
  expect(await png(page)).toEqual(openImage);
  await page.reload();
  await page
    .locator('.saved-item')
    .filter({ has: page.locator('.saved-name').getByText('One open door', { exact: true }) })
    .getByRole('button', { name: 'Open', exact: true })
    .click();
  await ready(page);
  expect(await png(page)).toEqual(openImage);
  await doors(page);
  await page.getByRole('combobox', { name: 'Door', exact: true }).selectOption(entry.door.id);
  await page.getByRole('button', { name: 'Close door', exact: true }).click();
  await ready(page);
  expect(await snapshot(page, 'Restored closed doors')).toEqual(base);
  expect(await png(page)).toEqual(image);
  await page
    .locator('forge-object-editor')
    .screenshot({ path: 'artifacts/dungeon-doors/closed-controls.png' });
});

test('door clicks use panned/zoomed coordinates while dragging, canceled pointers and object-edit clicks never toggle', async ({
  page,
}) => {
  await page.goto('/');
  const base = await snapshot(page, 'Gesture base'),
    entry = centre(base);
  let p = await point(page, entry.point);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 40, p.y + 20, { steps: 5 });
  await page.mouse.up();
  expect((await snapshot(page, 'After door pan')).doorStates).toBeUndefined();
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  p = await point(page, entry.point);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.locator('forge-preview canvas').dispatchEvent('pointercancel', { pointerId: 1 });
  await page.mouse.up();
  expect((await snapshot(page, 'Canceled door')).doorStates).toBeUndefined();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.locator('forge-preview canvas').focus();
  await page.keyboard.press('ArrowRight');
  p = await point(page, entry.point, 1.25, { x: -40, y: 0 });
  await page.mouse.click(p.x, p.y);
  await ready(page);
  expect((await snapshot(page, 'Zoomed door')).doorStates?.open).toEqual([entry.door.id]);
  await page.getByRole('button', { name: 'Edit objects', exact: true }).click();
  p = await point(page, entry.point, 1.25, { x: -40, y: 0 });
  await page.mouse.click(p.x, p.y);
  expect((await snapshot(page, 'Protected door in editor')).doorStates?.open).toEqual([
    entry.door.id,
  ]);
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page
    .locator('forge-preview')
    .screenshot({ path: 'artifacts/dungeon-doors/zoomed-open.png' });
});

test('keyboard and mobile door controls respect pinned/busy guards and recover after failed export', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const base = await snapshot(page, 'Mobile doors'),
    entry = centre(base);
  await page.getByRole('button', { name: 'Pin this map', exact: true }).click();
  await doors(page);
  const select = page.getByRole('combobox', { name: 'Door', exact: true });
  await select.selectOption(entry.door.id);
  const open = page.getByRole('button', { name: 'Open door', exact: true });
  await open.focus();
  await page.keyboard.press('Enter');
  await ready(page);
  expect((await snapshot(page, 'Keyboard opened')).doorStates?.open).toEqual([entry.door.id]);
  await page.getByRole('button', { name: 'Pinned', exact: true }).click();
  await ready(page);
  await expect(page.getByRole('button', { name: 'Open door', exact: true })).toBeDisabled();
  const p = await point(page, entry.point);
  await page.mouse.click(p.x, p.y);
  expect((await snapshot(page, 'Pinned stayed closed')).doorStates).toBeUndefined();
  await page.getByRole('button', { name: 'Current', exact: true }).click();
  await ready(page);
  const close = page.getByRole('button', { name: 'Close door', exact: true });
  await close.focus();
  await page
    .locator('forge-object-editor')
    .screenshot({ path: 'artifacts/dungeon-doors/mobile-controls.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => {
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      setTimeout(() => callback(null), 1200);
    };
  });
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  await expect(close).toBeDisabled();
  await ready(page);
  await expect(close).toBeEnabled();
  await expect(page.locator('#settings-error')).toContainText('could not create a PNG');
  await close.click();
  await ready(page);
  expect((await snapshot(page, 'Recovered close')).doorStates).toBeUndefined();
});

test.describe('touch door interaction', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, deviceScaleFactor: 2 });
  test('touch taps open and close doors at high DPI and after zooming', async ({ page }) => {
    await page.goto('/');
    const base = await snapshot(page, 'Touch base'),
      entry = centre(base);
    let p = await point(page, entry.point);
    await page.touchscreen.tap(p.x, p.y);
    await ready(page);
    expect((await snapshot(page, 'Touch opened')).doorStates?.open).toEqual([entry.door.id]);
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    p = await point(page, entry.point, 1.25);
    await page.touchscreen.tap(p.x, p.y);
    await ready(page);
    expect(await snapshot(page, 'Touch restored')).toEqual(base);
    await page
      .locator('forge-object-editor')
      .screenshot({ path: 'artifacts/dungeon-doors/touch-preview.png' });
  });
});
