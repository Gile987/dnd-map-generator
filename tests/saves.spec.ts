import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const itemByName = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.saved-item').filter({ has: page.getByText(name, { exact: true }) });

test('a successful backup clears a failed import error and shows its notice', async ({ page }) => {
  await page.goto('/');
  await page.locator('#save-name').fill('Backup recovery');
  await page.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(itemByName(page, 'Backup recovery')).toBeVisible();
  await page.setInputFiles('.import-label input', {
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('not json'),
  });
  await expect(page.locator('.library-message .error')).toContainText('not valid JSON');
  const pendingDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup', exact: true }).click();
  const download = await pendingDownload;
  expect(download.suggestedFilename()).toBe('encounter-map-forge-saves.json');
  expect(JSON.parse(readFileSync(await download.path(), 'utf8'))).toMatchObject({
    maps: [{ name: 'Backup recovery' }],
  });
  await expect(page.locator('.library-message .error')).toBeEmpty();
  await expect(page.locator('.library-message .notice')).toHaveText('Backup downloaded.');
  await expect(page.locator('a[href^="blob:"]')).toHaveCount(0);
});

test('a backup object-URL failure is reported and permits retry without changing saved maps', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('#save-name').fill('Retry backup');
  await page.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(itemByName(page, 'Retry backup')).toBeVisible();
  await page.evaluate(() => {
    const original = URL.createObjectURL;
    URL.createObjectURL = function () {
      URL.createObjectURL = original;
      throw new Error('Object URLs are unavailable.');
    };
  });
  await page.getByRole('button', { name: 'Download backup', exact: true }).click();
  await expect(page.locator('.library-message .error')).toContainText(
    'backup could not be downloaded',
  );
  await expect(page.locator('.library-message .notice')).toBeEmpty();
  await page.locator('.library').screenshot({ path: 'artifacts/ar09/backup-error.png' });
  await expect(page.locator('a[href^="blob:"]')).toHaveCount(0);
  await expect(page.locator('.saved-item')).toHaveCount(1);
  await expect(itemByName(page, 'Retry backup')).toBeVisible();
  expect(errors).toEqual([]);
  const pendingDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup', exact: true }).click();
  const download = await pendingDownload;
  expect(JSON.parse(readFileSync(await download.path(), 'utf8'))).toMatchObject({
    maps: [{ name: 'Retry backup' }],
  });
  await expect(page.locator('.library-message .error')).toBeEmpty();
  await expect(page.locator('.library-message .notice')).toHaveText('Backup downloaded.');
  expect(errors).toEqual([]);
  await page.locator('.library').screenshot({ path: 'artifacts/ar09/backup-recovered.png' });
});

test('imports a v3 library, reopens its original settings, and exports format-3 records', async ({
  page,
}) => {
  await page.goto('/');
  await page.setInputFiles('.import-label input', 'src/app/save/fixtures/forest-v3.json');
  await expect(page.locator('.saved-item')).toHaveCount(3);
  await expect(page.locator('.library-message .notice')).toContainText('Imported 3 maps');
  await page.reload();
  await itemByName(page, 'ancient-grove legacy clearing')
    .getByRole('button', { name: 'Open', exact: true })
    .click();
  await expect(page.getByRole('radio', { name: 'Verdant woodland', exact: true })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Cluttered', exact: true })).toBeChecked();
  await expect(page.locator('#map-summary')).toContainText('Verdant · Cluttered r2');
  await expect(page.getByRole('button', { name: 'Generate forest' })).toBeDisabled();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(JSON.parse(readFileSync(path, 'utf8'))).toMatchObject({
    saveFormatVersion: '3.0.0',
    maps: Array.from({ length: 3 }, () => ({
      saveFormatVersion: '3.0.0',
      map: { version: '3.0.0', decoration: { character: 'Verdant' } },
    })),
  });
});

test('a Fey save survives a format-3 backup round trip and refresh', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Forest', exact: true }).check();
  await page.getByRole('radio', { name: 'Fey glade', exact: true }).check();
  await page.getByRole('button', { name: 'Generate forest' }).click();
  await expect(page.locator('#map-summary')).toContainText('Fey · Balanced r0');
  await page.locator('#save-name').fill('Fey backup');
  await page.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(itemByName(page, 'Fey backup')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(JSON.parse(readFileSync(path, 'utf8'))).toMatchObject({
    saveFormatVersion: '3.0.0',
    maps: [{ saveFormatVersion: '3.0.0', map: { decoration: { character: 'Fey' } } }],
  });
  await itemByName(page, 'Fey backup').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('Your library is empty.')).toBeVisible();
  await page.setInputFiles('.import-label input', path);
  await expect(itemByName(page, 'Fey backup')).toBeVisible();
  await page.reload();
  await itemByName(page, 'Fey backup').getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Fey glade', exact: true })).toBeChecked();
  await expect(page.locator('#map-summary')).toContainText('Fey · Balanced r0');
  await expect(page.getByRole('button', { name: 'Generate forest' })).toBeDisabled();
});

test('saves a generated map, restores it after refresh, and keeps drafts out of the save', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#map-summary')).toContainText('mosslit-sanctum');

  await page.getByLabel('World seed').fill('amber-vault');
  await page.getByRole('spinbutton', { name: 'Rooms' }).fill('4');
  await page.getByRole('radio', { name: 'Crypt', exact: true }).check();
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  await expect(page.locator('#map-summary')).toContainText('amber-vault');
  await expect(page.locator('#map-summary')).toContainText('4 connected');
  await expect(page.locator('#map-summary')).toContainText('Crypt');

  await page.locator('#save-name').fill('Amber crypt');
  await page.getByRole('button', { name: 'Save map' }).click();
  const saved = itemByName(page, 'Amber crypt');
  await expect(saved).toBeVisible();
  await expect(saved).toContainText('4 rooms · Crypt · Balanced r0');
  await expect(saved).toContainText('amber-vault');

  await page.getByRole('button', { name: 'Randomize seed', exact: true }).click();
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  await expect(page.locator('#map-summary')).toContainText('dungeon-');
  await expect(page.locator('#map-summary')).not.toContainText('amber-vault');

  await saved.getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('#map-summary')).toContainText('amber-vault');
  await expect(page.locator('#map-summary')).toContainText('4 connected');
  await expect(page.locator('#map-summary')).toContainText('Crypt');
  await expect(page.locator('.status')).toContainText('library');

  await page.reload();
  await expect(itemByName(page, 'Amber crypt')).toBeVisible();
});

test('renames, favorites, duplicates, deletes, and exports a backup', async ({ page }) => {
  await page.goto('/');
  await page.locator('#save-name').fill('First');
  await page.getByRole('button', { name: 'Save map' }).click();
  const first = itemByName(page, 'First');
  await expect(first).toBeVisible();

  await first.getByRole('button', { name: 'Mark as favorite' }).click();
  await expect(first.getByRole('button', { name: 'Remove from favorites' })).toBeVisible();

  await first.getByRole('button', { name: 'Rename' }).click();
  await page.locator('.rename-form input').fill('Renamed');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const renamed = itemByName(page, 'Renamed');
  await expect(renamed).toBeVisible();

  await renamed.getByRole('button', { name: 'Duplicate' }).click();
  await expect(itemByName(page, 'Renamed (copy)')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('encounter-map-forge-saves.json');

  await itemByName(page, 'Renamed (copy)').getByRole('button', { name: 'Delete' }).click();
  await itemByName(page, 'Renamed').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Your library is empty.')).toBeVisible();
});

test('saving with an unapplied seed draft records the generated map, not the draft', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('World seed').fill('unapplied-draft');
  await expect(page.getByText('Settings changed. Generate to apply.')).toBeVisible();
  await expect(page.locator('#map-summary')).toContainText('mosslit-sanctum');

  await page.locator('#save-name').fill('Kept draft');
  await page.getByRole('button', { name: 'Save map' }).click();
  const saved = itemByName(page, 'Kept draft');
  await expect(saved).toContainText('mosslit-sanctum');
  await expect(saved).not.toContainText('unapplied-draft');
  await expect(page.locator('#map-summary')).toContainText('mosslit-sanctum');
});

test('renaming a map does not reload the app and preserves the current map and drafts', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Forest' }).check();
  await expect(page.locator('#map-summary')).toContainText('Open clearing');
  await page.getByLabel('World seed').fill('forest-draft');
  await expect(page.getByText('Settings changed. Generate to apply.')).toBeVisible();

  await page.locator('#save-name').fill('Forest save');
  await page.getByRole('button', { name: 'Save map' }).click();
  await itemByName(page, 'Forest save').getByRole('button', { name: 'Rename' }).click();
  await page.locator('.rename-form input').fill('Forest save 2');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(itemByName(page, 'Forest save 2')).toBeVisible();
  await expect(page.locator('#map-summary')).toContainText('Open clearing');
  await expect(page.getByLabel('World seed')).toHaveValue('forest-draft');
});

test('duplicating a long name stays within the limit and survives refresh', async ({ page }) => {
  await page.goto('/');
  const long = 'x'.repeat(64);
  await page.locator('#save-name').fill(long);
  await page.getByRole('button', { name: 'Save map' }).click();
  await expect(itemByName(page, long)).toBeVisible();

  await itemByName(page, long).getByRole('button', { name: 'Duplicate' }).click();
  const copyName = 'x'.repeat(57) + ' (copy)';
  await expect(itemByName(page, copyName)).toBeVisible();

  await page.reload();
  await expect(itemByName(page, long)).toBeVisible();
  await expect(itemByName(page, copyName)).toBeVisible();
});

test('exports and re-imports a backup round trip', async ({ page }) => {
  await page.goto('/');
  await page.locator('#save-name').fill('Round trip');
  await page.getByRole('button', { name: 'Save map' }).click();
  await expect(itemByName(page, 'Round trip')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup' }).click();
  const download = await downloadPromise;
  await download.saveAs('artifacts/saves-backup.json');

  await itemByName(page, 'Round trip').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Your library is empty.')).toBeVisible();

  await page.setInputFiles('.import-label input', 'artifacts/saves-backup.json');
  await expect(itemByName(page, 'Round trip')).toBeVisible();
  await expect(page.locator('.library-message .notice')).toContainText('Imported 1 map');
});

test('storage failures on duplicate are reported and leave the library unchanged', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#save-name').fill('Quota test');
  await page.getByRole('button', { name: 'Save map' }).click();
  await expect(itemByName(page, 'Quota test')).toBeVisible();

  await page.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new Error('quota');
    };
  });

  await itemByName(page, 'Quota test').getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.locator('.library-message .error')).toContainText('local storage');
  await expect(itemByName(page, 'Quota test (copy)')).not.toBeVisible();
  await expect(itemByName(page, 'Quota test')).toBeVisible();
});

test('opening a saved map clears a previous generation error', async ({ page }) => {
  await page.goto('/');
  await page.locator('#save-name').fill('Clear errors');
  await page.getByRole('button', { name: 'Save map' }).click();
  await expect(itemByName(page, 'Clear errors')).toBeVisible();

  await page.getByLabel('World seed').fill('   ');
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  await expect(page.locator('#settings-error')).toContainText('seed between 1 and 64');

  await itemByName(page, 'Clear errors').getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('#settings-error')).toBeEmpty();
});
