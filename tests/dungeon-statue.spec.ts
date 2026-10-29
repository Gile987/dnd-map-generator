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

test('statue drafts preserve accepted maps, combine with studies and export the accepted landmark', async ({
  page,
}) => {
  await page.goto('/');
  const original = await snapshot(page, 'Original dungeon');
  const landmark = selectedAddition(page, 'Weathered statue');
  await expect(landmark).toHaveCount(0);
  await setAddition(page, 'Weathered statue');
  await expect(landmark).toBeVisible();
  expect(await snapshot(page, 'Pending statue')).toEqual(original);
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  await expect(page.locator('#map-summary')).toContainText('Weathered statue');
  await expect(page.locator('canvas')).toHaveAttribute(
    'aria-label',
    /Weathered statue\. A weathered stone figure/,
  );
  const marked = await snapshot(page, 'Statue');
  expect(marked.layout).toEqual(original.layout);
  expect(marked.surfaceSeed).toBe(original.surfaceSeed);
  expect(marked.decoration).toMatchObject({ landmark: 'weathered-statue', revision: 0 });
  await landmark.click();
  await page.getByRole('button', { name: 'Shuffle details' }).click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  expect((await snapshot(page, 'Shuffled statue')).decoration.landmark).toBe('weathered-statue');
  await expect(landmark).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset changes' }).click();
  await expect(landmark).toBeVisible();
  await setAddition(page, 'Forgotten study');
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  await expect(page.locator('#map-summary')).toContainText('Forgotten study');
  const combined = await snapshot(page, 'Statue and study');
  expect(combined.decoration).toMatchObject({
    scene: 'Forgotten study',
    landmark: 'weathered-statue',
    revision: 1,
  });
  await page.getByRole('radio', { name: 'Forest', exact: true }).check();
  await expect(page.getByRole('button', { name: 'Choose additions', exact: true })).toBeVisible();
  await expect(landmark).toHaveCount(0);
  await page.getByRole('radio', { name: 'Dungeon', exact: true }).check();
  await expect(landmark).toBeVisible();
  await landmark.click();
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  await expect(page.locator('#map-summary')).not.toContainText('Weathered statue');
  await page
    .locator('.saved-item')
    .filter({ has: page.getByText('Statue and study', { exact: true }) })
    .getByRole('button', { name: 'Open', exact: true })
    .click();
  await expect(landmark).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate dungeon' })).toBeDisabled();
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      const canvas = this;
      document.addEventListener(
        'release-statue-export',
        () => {
          HTMLCanvasElement.prototype.toBlob = original;
          original.call(canvas, callback, type, quality);
        },
        { once: true },
      );
      document.documentElement.dataset['exportWaiting'] = 'true';
    };
  });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-export-waiting', 'true');
  await expect(landmark).toBeDisabled();
  await page.screenshot({ path: 'artifacts/statue/disabled.png', fullPage: true });
  await page.evaluate(() => document.dispatchEvent(new Event('release-statue-export')));
  const png = await download;
  expect(png.suggestedFilename()).toContain('-weathered-statue-forgotten-study-');
  expect(await PNG.read(await png.path())).toEqual({ width: 2560, height: 1920 });
  await landmark.focus();
  await page.screenshot({ path: 'artifacts/statue/desktop.png', fullPage: true });
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await page.screenshot({ path: `artifacts/statue/mobile-${width}.png`, fullPage: true });
  }
});

test('statues survive refresh and backup import with their exact saved layout and settings', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  await setAddition(page, 'Weathered statue');
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  const saved = await snapshot(page, 'Portable statue');
  await page.reload();
  await page.locator('.saved-item').getByRole('button', { name: 'Open', exact: true }).click();
  await expect(selectedAddition(page, 'Weathered statue')).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup', exact: true }).click();
  const backup = await pending;
  const path = await backup.path();
  expect(JSON.parse(readFileSync(path, 'utf8'))).toMatchObject({ saveFormatVersion: '14.0.0' });
  const fresh = await browser.newPage();
  try {
    await fresh.goto('http://127.0.0.1:4200/');
    await fresh.setInputFiles('.import-label input', path);
    await expect(fresh.locator('.library-message .notice')).toHaveText('Imported 1 map.');
    await fresh.locator('.saved-item').getByRole('button', { name: 'Open', exact: true }).click();
    await expect(selectedAddition(fresh, 'Weathered statue')).toBeVisible();
    expect(await snapshot(fresh, 'Imported statue')).toEqual(saved);
  } finally {
    await fresh.close();
  }
});
test('an imported dungeon with insufficient statue space stays intact and permits correction', async ({
  page,
}) => {
  const result = generateDungeon({
    seed: 'tiny-statue',
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
  await setAddition(page, 'Weathered statue');
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  await expect(page.locator('#settings-error')).toContainText('statue could not fit');
  expect(await snapshot(page, 'After rejected statue')).toEqual(map);
  await expect(selectedAddition(page, 'Weathered statue')).toBeVisible();
  await page.getByLabel('World seed').fill('statue-recovery');
  await page.getByRole('radio', { name: 'Balanced', exact: true }).check();
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  await expect(page.locator('#settings-error')).toBeEmpty();
  expect((await snapshot(page, 'Recovered statue')).decoration.landmark).toBe('weathered-statue');
});
