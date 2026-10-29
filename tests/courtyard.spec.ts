import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { parseSavedMap, SAVE_STORAGE_KEY } from '../src/app/save/save-format';
import { openAdditions, setAddition } from './additions';
import { PNG } from './png';

async function settled(page: Page): Promise<void> {
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
}

async function selectCourtyard(page: Page): Promise<void> {
  await page.getByRole('radio', { name: 'Courtyard', exact: true }).check();
  await expect(page.getByRole('heading', { name: 'Ruined Courtyard', exact: true })).toBeVisible();
  await settled(page);
}

async function snapshot(page: Page, name: string) {
  await settled(page);
  await expect(page.locator('.library')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#save-name').fill(name);
  await page.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(page.locator('.library-message .notice')).toHaveText(`Saved “${name}”.`);
  const data: unknown = JSON.parse(
    (await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)) ?? '[]',
  );
  if (!Array.isArray(data)) throw new Error('Missing library');
  const record = data.map(parseSavedMap).find((record) => record?.name === name);
  if (!record || record.map.type !== 'courtyard') throw new Error('Missing courtyard');
  return record;
}

async function png(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  const download = await pending;
  await settled(page);
  const path = await download.path();
  expect(await PNG.read(path)).toEqual({ width: 2560, height: 1920 });
  return { name: download.suggestedFilename(), bytes: await readFile(path) };
}

test('courtyard additions, drafts, shuffle history and type switching preserve accepted maps', async ({
  page,
}) => {
  await page.goto('/');
  await selectCourtyard(page);
  const initial = await snapshot(page, 'Open ruin');
  await setAddition(page, 'Dry fountain');
  const pending = await snapshot(page, 'Still open');
  expect(pending.map).toEqual(initial.map);
  await page.getByRole('button', { name: 'Generate courtyard', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('Dry fountain');
  const accepted = await snapshot(page, 'Fountain courtyard');
  expect(accepted.map.layout).toEqual(initial.map.layout);
  expect(accepted.map.surfaceSeed).toBe(initial.map.surfaceSeed);
  const original = await png(page);
  expect(original.name).toBe('encounter-ivy-court-courtyard-dry-fountain-balanced-r0-v4.0.0.png');
  await page.getByRole('button', { name: 'Shuffle details', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  await settled(page);
  const shuffled = await snapshot(page, 'Shuffled courtyard');
  expect(shuffled.map.layout).toEqual(accepted.map.layout);
  await page.getByLabel('World seed').fill('pending-ruin');
  await page.getByRole('radio', { name: 'Cluttered', exact: true }).check();
  await page.getByRole('button', { name: 'Undo shuffle', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('r0');
  await settled(page);
  expect((await snapshot(page, 'Undone courtyard')).map).toEqual(accepted.map);
  expect(await png(page)).toEqual(original);
  await page.getByRole('button', { name: 'Redo shuffle', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  await settled(page);
  expect((await snapshot(page, 'Redone courtyard')).map).toEqual(shuffled.map);
  for (const type of ['Forest', 'Dungeon']) {
    await page.getByRole('radio', { name: type, exact: true }).check();
    await expect(
      page.getByRole('heading', {
        name: type === 'Forest' ? 'Forest Clearing' : 'Stone Dungeon',
        exact: true,
      }),
    ).toBeVisible();
    await settled(page);
    await page.getByLabel('World seed').fill(`pending-${type}`);
  }
  await selectCourtyard(page);
  await expect(page.getByLabel('World seed')).toHaveValue('pending-ruin');
  await expect(page.getByRole('radio', { name: 'Cluttered', exact: true })).toBeChecked();
  await expect(page.locator('#map-summary')).toContainText('r1');
  await page.getByLabel('World seed').fill(' ');
  await page.getByRole('button', { name: 'Generate courtyard', exact: true }).click();
  await expect(page.locator('#settings-error')).toContainText('Enter a seed');
  expect((await snapshot(page, 'Rejected courtyard')).map).toEqual(shuffled.map);
  await page.getByLabel('World seed').fill('fallen-crown');
  await page.getByRole('button', { name: 'Generate courtyard', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('fallen-crown');
  await settled(page);
  await expect(page.getByRole('button', { name: 'Undo shuffle', exact: true })).toBeDisabled();
  const regenerated = await snapshot(page, 'New ruin');
  expect(regenerated.map.layout).not.toEqual(initial.map.layout);
  expect(regenerated.map.decoration).toMatchObject({
    revision: 0,
    density: 'Cluttered',
    fountain: true,
  });
});

test('courtyard saves and backups reopen exact artwork and PNGs after a refresh', async ({
  page,
}) => {
  await page.goto('/');
  await selectCourtyard(page);
  await setAddition(page, 'Dry fountain');
  await page.getByRole('button', { name: 'Generate courtyard', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('Dry fountain');
  await settled(page);
  const saved = await snapshot(page, 'Old courtyard');
  const original = await png(page);
  const backupPending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup', exact: true }).click();
  const backup = await backupPending;
  const backupBytes = await readFile(await backup.path());
  expect(JSON.parse(backupBytes.toString())).toMatchObject({
    saveFormatVersion: '15.0.0',
    maps: [{ map: saved.map }],
  });
  await page.reload();
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ruined Courtyard', exact: true })).toBeVisible();
  await settled(page);
  expect(await png(page)).toEqual(original);
  await expect(page.getByRole('button', { name: 'Undo shuffle', exact: true })).toBeDisabled();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page
    .locator('.import-label input')
    .setInputFiles({ name: 'courtyard.json', mimeType: 'application/json', buffer: backupBytes });
  await expect(page.locator('.saved-item')).toHaveCount(1);
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ruined Courtyard', exact: true })).toBeVisible();
  await settled(page);
  await expect(
    page.getByRole('button', { name: 'Remove Dry fountain', exact: true }),
  ).toBeVisible();
  expect(await png(page)).toEqual(original);
  await page.getByRole('checkbox', { name: 'Grid', exact: true }).uncheck();
  const ungridded = await png(page);
  expect(ungridded.bytes).not.toEqual(original.bytes);
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  expect(await png(page)).toEqual(ungridded);
});

test('courtyard controls recover from an export failure without accepting drafts', async ({
  page,
}) => {
  await page.goto('/');
  await selectCourtyard(page);
  await page.getByRole('button', { name: 'Shuffle details', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  await settled(page);
  await page.getByLabel('World seed').fill('keep-courtyard-draft');
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      document.addEventListener(
        'fail-courtyard-export',
        () => {
          HTMLCanvasElement.prototype.toBlob = original;
          callback(null);
        },
        { once: true },
      );
      document.documentElement.dataset['courtyardExportHeld'] = 'true';
    };
  });
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-courtyard-export-held', 'true');
  await expect(page.getByRole('radio', { name: 'Courtyard', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Choose additions', exact: true })).toBeDisabled();
  const undo = page.getByRole('button', { name: 'Undo shuffle', exact: true });
  await expect(undo).toBeDisabled();
  await undo.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#map-summary')).toContainText('r1');
  await page.locator('.workbench').screenshot({ path: 'artifacts/courtyard/disabled.png' });
  await page.evaluate(() => document.dispatchEvent(new Event('fail-courtyard-export')));
  await expect(page.locator('#settings-error')).toContainText('could not create a PNG');
  await settled(page);
  await expect(page.getByLabel('World seed')).toHaveValue('keep-courtyard-draft');
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(page.locator('#map-summary')).toContainText('r0');
  await settled(page);
  expect((await png(page)).name).toContain('encounter-ivy-court-courtyard-balanced-r0-');
});

for (const width of [1440, 768, 320])
  test(`courtyard picker, map and keyboard controls fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 1100 });
    await page.goto('/');
    await selectCourtyard(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    const radio = page.getByRole('radio', { name: 'Courtyard', exact: true });
    await radio.focus();
    await page.keyboard.press('Tab');
    expect(await page.getByLabel('World seed').evaluate((el) => el.matches(':focus-visible'))).toBe(
      true,
    );
    const picker = await openAdditions(page);
    await expect(picker.getByRole('heading', { name: 'Choose additions' })).toBeFocused();
    const checkbox = picker.getByRole('checkbox', { name: 'Dry fountain', exact: true });
    await checkbox.focus();
    await page.keyboard.press('Space');
    await expect(checkbox).toBeChecked();
    await picker.screenshot({ path: `artifacts/courtyard/picker-${width}.png` });
    const done = picker.getByRole('button', { name: 'Done', exact: true });
    const bounds = await done.boundingBox();
    expect(bounds).not.toBeNull();
    expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(
      width === 320 ? 568 : 1100,
    );
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Choose additions', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Generate courtyard', exact: true }).click();
    await expect(page.locator('#map-summary')).toContainText('Dry fountain');
    await settled(page);
    const canvas = page.getByLabel(/Ruined courtyard map/);
    await canvas.focus();
    await page.keyboard.press('+');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Home');
    await page
      .locator('.workbench')
      .screenshot({ path: `artifacts/courtyard/workbench-${width}.png` });
    await expect(
      page.getByRole('button', { name: 'Generate courtyard', exact: true }),
    ).toBeDisabled();
  });
