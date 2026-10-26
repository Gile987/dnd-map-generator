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

test('study settings preserve layouts and drafts through shuffle, switching and removal', async ({
  page,
}) => {
  await page.goto('/');
  const original = await snapshot(page, 'Original');
  const pixels = await page
    .locator('canvas')
    .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
  await page.getByRole('checkbox', { name: 'Forgotten study', exact: true }).check();
  expect(
    await page.locator('canvas').evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL()),
  ).toBe(pixels);
  expect(await snapshot(page, 'Pending study')).toEqual(original);
  await page.getByRole('radio', { name: 'Forest', exact: true }).check();
  await expect(page.getByRole('checkbox', { name: 'Abandoned camp', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Dungeon', exact: true }).check();
  await expect(page.getByRole('checkbox', { name: 'Forgotten study', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  await expect(page.locator('#map-summary')).toContainText('Forgotten study');
  const study = await snapshot(page, 'Study');
  expect(study.layout).toEqual(original.layout);
  expect(study.surfaceSeed).toBe(original.surfaceSeed);
  expect(study.decoration).toMatchObject({ scene: 'Forgotten study', revision: 0 });
  await page.getByRole('checkbox', { name: 'Forgotten study', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Shuffle details' }).click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  const shuffled = await snapshot(page, 'Shuffled');
  expect(shuffled.decoration.scene).toBe('Forgotten study');
  expect(shuffled.decoration.props).not.toEqual(study.decoration.props);
  expect(shuffled.layout).toEqual(study.layout);
  await page.getByRole('button', { name: 'Reset changes' }).click();
  await expect(page.getByRole('checkbox', { name: 'Forgotten study', exact: true })).toBeChecked();
  await page.getByRole('radio', { name: 'Crypt', exact: true }).check();
  await page.getByRole('radio', { name: 'Cluttered', exact: true }).check();
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  const crypt = await snapshot(page, 'Crypt study');
  expect(crypt.decoration).toMatchObject({
    scene: 'Forgotten study',
    preset: 'Crypt',
    density: 'Cluttered',
    revision: 1,
  });
  expect(crypt.layout).toEqual(study.layout);
  await page.getByRole('checkbox', { name: 'Forgotten study', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  expect((await snapshot(page, 'No study')).decoration).not.toHaveProperty('scene');
  await page
    .locator('.saved-item')
    .filter({ has: page.getByText('Study', { exact: true }) })
    .getByRole('button', { name: 'Open', exact: true })
    .click();
  await expect(page.getByRole('checkbox', { name: 'Forgotten study', exact: true })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Generate dungeon' })).toBeDisabled();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG', exact: true }).click();
  const png = await pending;
  expect(png.suggestedFilename()).toContain('-forgotten-study-');
  expect(await PNG.read(await png.path())).toEqual({ width: 2560, height: 1920 });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.getByRole('checkbox', { name: 'Forgotten study', exact: true }).focus();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await page.screenshot({ path: `artifacts/study/browser-${width}.png`, fullPage: true });
  }
});

test('study artwork survives refresh and portable backup import', async ({ page, browser }) => {
  await page.goto('/');
  await page.getByRole('checkbox', { name: 'Forgotten study', exact: true }).check();
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  const saved = await snapshot(page, 'Portable study');
  await page.reload();
  await page.locator('.saved-item').getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Forgotten study', exact: true })).toBeChecked();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup', exact: true }).click();
  const backup = await pending;
  const path = await backup.path();
  expect(JSON.parse(readFileSync(path, 'utf8'))).toMatchObject({ saveFormatVersion: '8.0.0' });
  const fresh = await browser.newPage();
  try {
    await fresh.goto('http://127.0.0.1:4200/');
    await fresh.setInputFiles('.import-label input', path);
    await expect(fresh.locator('.library-message .notice')).toHaveText('Imported 1 map.');
    await fresh.locator('.saved-item').getByRole('button', { name: 'Open', exact: true }).click();
    await expect(
      fresh.getByRole('checkbox', { name: 'Forgotten study', exact: true }),
    ).toBeChecked();
    expect(await snapshot(fresh, 'Imported study')).toEqual(saved);
  } finally {
    await fresh.close();
  }
});

test('an imported dungeon with insufficient study space stays intact and permits correction', async ({
  page,
}) => {
  const result = generateDungeon({
    seed: 'tiny-study',
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
  await page.getByRole('checkbox', { name: 'Forgotten study', exact: true }).check();
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  await expect(page.locator('#settings-error')).toContainText('study could not fit');
  expect(await snapshot(page, 'After rejected study')).toEqual(map);
  await expect(page.getByRole('checkbox', { name: 'Forgotten study', exact: true })).toBeChecked();
  await page.getByLabel('World seed').fill('study-recovery');
  await page.getByRole('radio', { name: 'Balanced', exact: true }).check();
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  await expect(page.locator('#settings-error')).toBeEmpty();
  expect((await snapshot(page, 'Recovered study')).decoration.scene).toBe('Forgotten study');
});
