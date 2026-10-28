import { selectedAddition, setAddition } from './additions';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  parseSavedMap,
  SAVE_STORAGE_KEY,
  makeSavedMap,
  serializeBundle,
} from '../src/app/save/save-format';
import { generateDungeon } from '../src/app/engine/generate';
import { createLayout } from '../src/app/engine/topology';
import { PNG } from './png';

async function snapshot(page: Page, name: string) {
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.library')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#save-name').fill(name);
  await page.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(page.locator('.library-message .notice')).toHaveText(`Saved “${name}”.`);
  await expect(page.locator('.saved-name').getByText(name, { exact: true })).toBeVisible();
  const data: unknown = JSON.parse(
    (await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)) ?? '[]',
  );
  if (!Array.isArray(data)) throw new Error('Missing library');
  const record = data.map(parseSavedMap).find((record) => record?.name === name);
  if (!record || record.map.type !== 'dungeon') throw new Error('Missing dungeon');
  return record.map;
}

test('furniture stays pending, applies without rebuilding, and combines with other dungeon features', async ({
  page,
}) => {
  await page.goto('/');
  const furniture = selectedAddition(page, 'Dining table');
  await expect(furniture).toHaveCount(0);
  const original = await snapshot(page, 'Original');
  await setAddition(page, 'Dining table');
  await expect(furniture).toBeVisible();
  expect(await snapshot(page, 'Pending furniture')).toEqual(original);
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  await expect(page.locator('#map-summary')).toContainText('Dining table');
  await expect(page.locator('canvas')).toHaveAttribute(
    'aria-label',
    /dining table blocks two tiles/,
  );
  const furnished = await snapshot(page, 'Dining table');
  expect(furnished.layout).toEqual(original.layout);
  expect(furnished.surfaceSeed).toBe(original.surfaceSeed);
  expect(furnished.decoration).toMatchObject({ furniture: 'dining-table', revision: 0 });
  expect(furnished.decoration.props.find((p) => p.kind === 'dining_table')).toMatchObject({
    footprint: { width: 2, height: 1 },
    rotation: expect.any(Number),
    blocking: true,
  });
  await furniture.click();
  await page.getByRole('button', { name: 'Shuffle details' }).click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  expect((await snapshot(page, 'Shuffled table')).decoration.furniture).toBe('dining-table');
  await expect(furniture).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset changes' }).click();
  await expect(furniture).toBeVisible();
  await page.getByLabel('World seed').fill('table-0');
  await setAddition(page, 'Forgotten study');
  await setAddition(page, 'Weathered statue');
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  await expect(page.locator('#map-summary')).toContainText('Forgotten study');
  const combined = await snapshot(page, 'Table study and statue');
  expect(combined.decoration).toMatchObject({
    furniture: 'dining-table',
    scene: 'Forgotten study',
    landmark: 'weathered-statue',
    revision: 0,
  });
  await page.getByRole('radio', { name: 'Forest', exact: true }).check();
  await expect(furniture).toHaveCount(0);
  await page.getByRole('radio', { name: 'Dungeon', exact: true }).check();
  await expect(furniture).toBeVisible();
  await furniture.click();
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  await expect(page.locator('#map-summary')).not.toContainText('Dining table');
  await page
    .locator('.saved-item')
    .filter({ has: page.getByText('Table study and statue', { exact: true }) })
    .getByRole('button', { name: 'Open', exact: true })
    .click();
  await expect(furniture).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate dungeon' })).toBeDisabled();
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      const canvas = this;
      document.addEventListener(
        'release-table-export',
        () => {
          HTMLCanvasElement.prototype.toBlob = original;
          original.call(canvas, callback, type, quality);
        },
        { once: true },
      );
      document.documentElement.dataset['exportWaiting'] = 'true';
    };
  });
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-export-waiting', 'true');
  await expect(furniture).toBeDisabled();
  await page.screenshot({ path: 'artifacts/f11/disabled.png', fullPage: true });
  await page.evaluate(() => document.dispatchEvent(new Event('release-table-export')));
  const png = await pending;
  expect(png.suggestedFilename()).toContain('-dining-table-weathered-statue-forgotten-study-');
  expect(await PNG.read(await png.path())).toEqual({ width: 2560, height: 1920 });
  await furniture.focus();
  await page.screenshot({ path: 'artifacts/f11/desktop.png', fullPage: true });
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await page.screenshot({ path: `artifacts/f11/mobile-${width}.png`, fullPage: true });
  }
});

test('table footprints and orientations survive refresh and portable backups', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  await setAddition(page, 'Dining table');
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  const saved = await snapshot(page, 'Portable table');
  await page.reload();
  await page.locator('.saved-item').getByRole('button', { name: 'Open', exact: true }).click();
  await expect(selectedAddition(page, 'Dining table')).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup', exact: true }).click();
  const backup = await pending,
    path = await backup.path();
  expect(JSON.parse(readFileSync(path, 'utf8'))).toMatchObject({ saveFormatVersion: '10.0.0' });
  const fresh = await browser.newPage();
  try {
    await fresh.goto('http://127.0.0.1:4200/');
    await fresh.setInputFiles('.import-label input', path);
    await expect(fresh.locator('.library-message .notice')).toHaveText('Imported 1 map.');
    await fresh.locator('.saved-item').getByRole('button', { name: 'Open', exact: true }).click();
    await expect(selectedAddition(fresh, 'Dining table')).toBeVisible();
    expect(await snapshot(fresh, 'Imported table')).toEqual(saved);
  } finally {
    await fresh.close();
  }
});
test('an imported dungeon with insufficient table budget stays intact and permits correction', async ({
  page,
}) => {
  const result = generateDungeon({
    seed: 'tiny-table',
    roomCount: 4,
    preset: 'Mosslit',
    density: 'Sparse',
  });
  if (!result.ok) throw new Error(result.error);
  const rooms = [
    { x: 4, y: 4 },
    { x: 20, y: 4 },
    { x: 20, y: 18 },
    { x: 4, y: 18 },
  ].map((point, id) => ({ ...point, id, width: 5, height: 4 }));
  const map = {
    ...result.map,
    layout: createLayout(rooms, [
      { from: 0, to: 1, bend: 'horizontal' },
      { from: 1, to: 2, bend: 'vertical' },
      { from: 2, to: 3, bend: 'horizontal' },
    ]),
    decoration: { ...result.map.decoration, props: [] },
  };
  const record = makeSavedMap(
    map,
    'Tiny dungeon',
    'data:image/png;base64,AAAA',
    'tiny',
    '2026-10-23T10:00:00Z',
  );
  await page.goto('/');
  await page.setInputFiles('.import-label input', {
    name: 'tiny.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serializeBundle([record])),
  });
  await expect(page.locator('.library-message .notice')).toHaveText('Imported 1 map.');
  await page.locator('.saved-item').getByRole('button', { name: 'Open', exact: true }).click();
  await setAddition(page, 'Dining table');
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  await expect(page.locator('#settings-error')).toContainText('table could not fit');
  expect(await snapshot(page, 'After rejected table')).toEqual(map);
  await expect(selectedAddition(page, 'Dining table')).toBeVisible();
  await page.getByLabel('World seed').fill('table-0');
  await page.getByRole('radio', { name: 'Balanced', exact: true }).check();
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  await expect(page.locator('#settings-error')).toBeEmpty();
  expect((await snapshot(page, 'Recovered table')).decoration.furniture).toBe('dining-table');
});
