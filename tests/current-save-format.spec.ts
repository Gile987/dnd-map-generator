import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import fixture from '../src/app/save/fixtures/forest-current.json';
import { SAVE_FORMAT_VERSION, SAVE_STORAGE_KEY } from '../src/app/save/save-format';

for (const version of ['1.0.0', '33.0.0']) {
  test(`rejects a format-${version} backup without changing the library or accepted map`, async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator('#save-name').fill('Current map');
    await page.getByRole('button', { name: 'Save map', exact: true }).click();
    await expect(page.locator('.saved-item')).toHaveCount(1);
    const before = await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY);
    const summary = await page.locator('#map-summary').textContent();
    await page.locator('.import-label input').setInputFiles({
      name: 'unsupported.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          ...fixture,
          saveFormatVersion: version,
          maps: fixture.maps.map((record) => ({ ...record, saveFormatVersion: version })),
        }),
      ),
    });
    await expect(page.locator('.library-message .error')).toContainText('cannot read');
    expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)).toBe(before);
    await expect(page.locator('#map-summary')).toHaveText(summary ?? '');
    await expect(page.locator('.saved-item')).toHaveCount(1);
    // A rejected import must not prevent a subsequent valid import.
    await page.locator('.import-label input').setInputFiles({
      name: 'current.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(fixture)),
    });
    await expect(page.locator('.library-message .notice')).toHaveText('Imported 3 maps.');
    await expect(page.locator('.saved-item')).toHaveCount(4);
  });
}

test('a retired record in a current bundle is skipped and counted', async ({ page }) => {
  const record = fixture.maps[0];
  if (!record) throw Error('Missing fixture');
  await page.goto('/');
  await page.locator('.import-label input').setInputFiles({
    name: 'mixed.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        ...fixture,
        saveFormatVersion: SAVE_FORMAT_VERSION,
        maps: [record, { ...record, id: 'retired', saveFormatVersion: '33.0.0' }],
      }),
    ),
  });
  await expect(page.locator('.saved-item')).toHaveCount(1);
  await expect(page.locator('.library-message .notice')).toContainText('skipped');
  const raw = await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY);
  expect(JSON.parse(raw ?? '[]')).toEqual([record]);
});

test('stored retired records pause writes and remain recoverable byte for byte', async ({
  page,
}) => {
  const record = fixture.maps[0];
  if (!record) throw Error('Missing fixture');
  const raw = JSON.stringify(
    [record, { ...record, id: 'retired', saveFormatVersion: '33.0.0' }],
    null,
    2,
  );
  await page.addInitScript(
    ({ key, raw }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, raw);
    },
    { key: SAVE_STORAGE_KEY, raw },
  );
  await page.goto('/');
  await expect(page.locator('.library-recovery')).toContainText('Changes are paused');
  await expect(page.locator('.saved-item')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Save map', exact: true })).toBeDisabled();
  await expect(page.locator('.import-label input')).toBeDisabled();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download recovery data', exact: true }).click();
  const download = await pending;
  expect(await readFile(await download.path(), 'utf8')).toBe(raw);
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Forest Clearing', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.library-recovery')).toContainText('Changes are paused');
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)).toBe(raw);
});
