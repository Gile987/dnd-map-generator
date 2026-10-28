import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { parseSavedMap, SAVE_STORAGE_KEY } from '../src/app/save/save-format';

const current = (page: Page) => page.getByRole('button', { name: 'Current', exact: true });
const pinned = (page: Page) => page.getByRole('button', { name: 'Pinned', exact: true });
const pin = (page: Page) =>
  page.getByRole('button', { name: /^(Pin this map|Replace pinned map)$/ });
const ready = (page: Page) =>
  expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');

async function save(page: Page, name: string) {
  await ready(page);
  await expect(page.locator('.library')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#save-name').fill(name);
  await page.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(page.locator('.library-message .notice')).toHaveText(`Saved “${name}”.`);
  const raw: unknown = JSON.parse(
    (await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)) ?? '[]',
  );
  if (!Array.isArray(raw)) throw new Error('Missing library');
  const record = raw.map(parseSavedMap).find((record) => record?.name === name);
  if (!record) throw new Error('Missing save');
  return record.map;
}

async function png(page: Page, configured = false) {
  await ready(page);
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: configured ? 'Download PNG' : 'Quick export PNG', exact: true })
    .click();
  const result = await download;
  return { name: result.suggestedFilename(), bytes: await readFile(await result.path()) };
}

for (const type of ['Dungeon', 'Forest', 'Courtyard'] as const) {
  test(`${type} switches exact candidates and saves/exports the displayed snapshot`, async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('radio', { name: type, exact: true }).check();
    await ready(page);
    await page.getByRole('checkbox', { name: 'Grid', exact: true }).uncheck();
    await pin(page).click();
    const original = await save(page, 'Original candidate');
    const originalPng = await png(page);
    await page.getByRole('button', { name: 'Shuffle details', exact: true }).click();
    await expect(page.locator('#map-summary')).toContainText('r1');
    const alternative = await save(page, 'Alternative candidate');
    const alternativePng = await png(page);
    expect(alternativePng.bytes).not.toEqual(originalPng.bytes);
    await page.getByLabel('World seed').fill('unapplied-comparison-draft');
    await page.locator('#save-name').fill('Unfinished name');
    const storage = await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY);
    await pinned(page).click();
    await expect(pinned(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#map-summary')).toContainText('r0');
    await expect(page.locator('.comparison-settings-note')).toContainText(
      'Settings and shuffle history belong to Current',
    );
    await expect(page.getByLabel('World seed')).toHaveValue('unapplied-comparison-draft');
    await expect(page.locator('#save-name')).toHaveValue('Unfinished name');
    expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)).toBe(storage);
    expect(await save(page, 'Saved pin')).toEqual(original);
    expect(await png(page)).toEqual(originalPng);
    await page.getByRole('button', { name: 'Export options', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Export options' });
    await expect(dialog.locator('.map-source')).toContainText(original.seed);
    await dialog.getByRole('checkbox', { name: 'Include grid' }).uncheck();
    const configured = await png(page, true);
    expect(configured.bytes).toEqual(originalPng.bytes);
    expect(configured.name).not.toContain('unapplied');
    await dialog.getByRole('button', { name: 'Done', exact: true }).click();
    await current(page).click();
    expect(await save(page, 'Saved current')).toEqual(alternative);
    expect(await png(page)).toEqual(alternativePng);
    await expect(page.getByLabel('World seed')).toHaveValue('unapplied-comparison-draft');
  });
}

test('Generate and opening a save retain the pin and return to Current; invalid settings retain Pinned', async ({
  page,
}) => {
  await page.goto('/');
  await pin(page).click();
  const original = await save(page, 'Pinned original');
  await pinned(page).click();
  await page.getByLabel('World seed').fill('');
  await page.getByRole('button', { name: 'Generate dungeon', exact: true }).click();
  await expect(page.locator('#settings-error')).not.toBeEmpty();
  await expect(pinned(page)).toHaveAttribute('aria-pressed', 'true');
  await current(page).click();
  await expect(page.locator('#settings-error')).not.toBeEmpty();
  await pinned(page).click();
  await expect(page.getByLabel('World seed')).toHaveValue('');
  await page.getByLabel('World seed').fill('comparison-new-layout');
  await page.getByRole('button', { name: 'Generate dungeon', exact: true }).click();
  await expect(current(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#map-summary')).toContainText('comparison-new-layout');
  const generated = await save(page, 'New layout');
  expect(generated.layout).not.toEqual(original.layout);
  await pinned(page).click();
  expect(await save(page, 'Pin after generate')).toEqual(original);
  await page
    .locator('.saved-item')
    .filter({ has: page.locator('.saved-name').getByText('New layout', { exact: true }) })
    .getByRole('button', { name: 'Open', exact: true })
    .click();
  await expect(current(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('World seed')).toHaveValue('comparison-new-layout');
  await pinned(page).click();
  expect(await save(page, 'Pin after open')).toEqual(original);
});

test('each map type retains its pin and selected candidate, while refresh clears all pins', async ({
  page,
}) => {
  await page.goto('/');
  for (const type of ['Dungeon', 'Forest', 'Courtyard']) {
    await page.getByRole('radio', { name: type, exact: true }).check();
    await ready(page);
    await pin(page).click();
    await page.getByRole('button', { name: 'Shuffle details', exact: true }).click();
    await expect(page.locator('#map-summary')).toContainText('r1');
    await pinned(page).click();
  }
  for (const type of ['Dungeon', 'Forest', 'Courtyard']) {
    await page.getByRole('radio', { name: type, exact: true }).check();
    await expect(pinned(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#map-summary')).toContainText('r0');
    await current(page).click();
    await expect(page.locator('#map-summary')).toContainText('r1');
  }
  await page.reload();
  for (const type of ['Dungeon', 'Forest', 'Courtyard']) {
    await page.getByRole('radio', { name: type, exact: true }).check();
    await expect(page.getByRole('button', { name: 'Pin this map', exact: true })).toBeVisible();
    await expect(pinned(page)).toHaveCount(0);
  }
});

test('comparison is keyboard accessible in normal and focused layouts, with safe clearing and replacement', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Focus map', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(pin(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(pin(page)).toBeFocused();
  await expect(current(page)).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(current(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(pinned(page)).toBeFocused();
  await page.keyboard.press('Space');
  await expect(pinned(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(pin(page)).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('button', { name: 'Focus map', exact: true }).click();
  await expect(pinned(page)).toHaveAttribute('aria-pressed', 'true');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await pinned(page).focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(pinned(page)).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `artifacts/f14/focused-${width}.png`, fullPage: true });
  }
  await page.keyboard.press('Escape');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page
      .locator('section[forge-map-panel]')
      .screenshot({ path: `artifacts/f14/workbench-map-${width}.png` });
  }
  await page.getByRole('button', { name: 'Clear pin', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(pin(page)).toBeFocused();
  await expect(pin(page)).toHaveText('Pin this map');
  await expect(pinned(page)).toHaveCount(0);
  await pin(page).click();
  await page.getByRole('button', { name: 'Shuffle details', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  await pin(page).click();
  await pinned(page).click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  await page.screenshot({ path: 'artifacts/f14/workbench-320.png', fullPage: true });
});

test('a historical study pin keeps original model and PNG artwork through generation and shuffle undo', async ({
  page,
}) => {
  await page.goto('/');
  await page.setInputFiles('.import-label input', 'src/app/save/fixtures/study-v9.json');
  await expect(page.locator('.library-message .notice')).toHaveText('Imported 1 map.');
  await page.locator('.saved-item').getByRole('button', { name: 'Open', exact: true }).click();
  await pin(page).click();
  const original = await save(page, 'Historical pin');
  expect(original.decoration).not.toHaveProperty('studySurface');
  const before = await png(page);
  await page.getByRole('button', { name: 'Shuffle details', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  await pinned(page).click();
  expect(await png(page)).toEqual(before);
  await page.getByRole('button', { name: 'Undo shuffle', exact: true }).click();
  await expect(current(page)).toHaveAttribute('aria-pressed', 'true');
  expect(await save(page, 'Undone current')).toEqual(original);
  await page.getByLabel('World seed').fill('historical-comparison');
  await page.getByRole('button', { name: 'Generate dungeon', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('historical-comparison');
  await pinned(page).click();
  expect(await save(page, 'Historical after generation')).toEqual(original);
  expect(await png(page)).toEqual(before);
});

test('comparison controls stay guarded during PNG preparation and recover after export failure', async ({
  page,
}) => {
  await page.goto('/');
  await pin(page).click();
  await page.getByRole('button', { name: 'Shuffle details', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
      HTMLCanvasElement.prototype.toBlob = original;
      document.addEventListener(
        'release-comparison-export',
        () => original.call(this, callback, ...args),
        { once: true },
      );
    };
  });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'true');
  for (const button of [
    pin(page),
    current(page),
    pinned(page),
    page.getByRole('button', { name: 'Clear pin', exact: true }),
  ]) {
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await button.focus();
    await page.keyboard.press('Enter');
  }
  await expect(current(page)).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => document.dispatchEvent(new Event('release-comparison-export')));
  await download;
  await ready(page);
  await pinned(page).click();
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      HTMLCanvasElement.prototype.toBlob = original;
      callback(null);
    };
  });
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  await expect(page.locator('#settings-error')).not.toBeEmpty();
  await expect(pinned(page)).toHaveAttribute('aria-pressed', 'true');
  expect((await png(page)).bytes.length).toBeGreaterThan(1000);
});
