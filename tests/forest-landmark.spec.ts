import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { parseSavedMap, SAVE_STORAGE_KEY } from '../src/app/save/save-format';
import { PNG } from './png';

async function snapshot(page: Page, name: string) {
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.library')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#save-name').fill(name);
  await page.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(page.locator('.library-message .notice')).toHaveText(`Saved “${name}”.`);
  await expect(page.locator('.saved-name').getByText(name, { exact: true })).toBeVisible();
  const stored: unknown = JSON.parse(
    (await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)) ?? '[]',
  );
  if (!Array.isArray(stored)) throw new Error('Expected saved library');
  const saved = stored.map(parseSavedMap).find((record) => record?.name === name);
  if (!saved || saved.map.type !== 'forest') throw new Error('Expected saved forest');
  return saved.map;
}

test('landmarks remain pending until generated, compose with camps, and survive saves and exports', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  await expect(page.getByRole('combobox', { name: /^Landmark/ })).toHaveCount(0);
  await page.getByRole('radio', { name: 'Forest', exact: true }).check();
  const original = await snapshot(page, 'Original');
  await page
    .getByRole('combobox', { name: /^Landmark/ })
    .selectOption({ label: 'Standing-stone circle' });
  expect(await snapshot(page, 'Pending landmark')).toEqual(original);
  await page.getByRole('button', { name: 'Generate forest' }).click();
  await expect(page.locator('#map-summary')).toContainText('Standing-stone circle');
  const marked = await snapshot(page, 'Circle');
  expect(marked.layout).toEqual(original.layout);
  expect(marked.surfaceSeed).toBe(original.surfaceSeed);
  expect(marked.decoration.landmark).toBe('Suggested landmark');
  await page.getByRole('combobox', { name: /^Landmark/ }).selectOption('None');
  await page.getByRole('button', { name: 'Shuffle details' }).click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  expect((await snapshot(page, 'Shuffled')).decoration.landmark).toBe('Suggested landmark');
  await page.getByRole('button', { name: 'Reset changes' }).click();
  await expect(page.getByRole('combobox', { name: /^Landmark/ })).toHaveValue('Suggested landmark');
  await page.getByRole('radio', { name: 'Abandoned camp', exact: true }).check();
  await page.getByRole('button', { name: 'Generate forest' }).click();
  await expect(page.locator('#map-summary')).toContainText('Abandoned camp');
  const combined = await snapshot(page, 'Camp and circle');
  expect(combined.decoration).toMatchObject({
    scene: 'Abandoned camp',
    landmark: 'Suggested landmark',
    revision: 1,
  });
  await page.getByRole('combobox', { name: /^Landmark/ }).focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('combobox', { name: /^Landmark/ })).toHaveValue('None');
  await page.getByRole('button', { name: 'Generate forest' }).click();
  await expect(page.locator('#map-summary')).not.toContainText('Standing-stone circle');
  await page
    .locator('.saved-item')
    .filter({ has: page.getByText('Camp and circle', { exact: true }) })
    .getByRole('button', { name: 'Open', exact: true })
    .click();
  await expect(page.getByRole('combobox', { name: /^Landmark/ })).toHaveValue('Suggested landmark');
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      const canvas = this;
      document.addEventListener(
        'release-landmark-export',
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
  await page.getByRole('button', { name: 'Export PNG', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-export-waiting', 'true');
  await expect(page.getByRole('combobox', { name: /^Landmark/ })).toBeDisabled();
  await page.screenshot({ path: 'artifacts/f10/disabled.png', fullPage: true });
  await page.evaluate(() => document.dispatchEvent(new Event('release-landmark-export')));
  const png = await download;
  expect(png.suggestedFilename()).toContain('-standing-stone-circle-abandoned-camp-');
  expect(await PNG.read(await png.path())).toEqual({ width: 2560, height: 1920 });
  await page.getByRole('combobox', { name: /^Landmark/ }).focus();
  await page.screenshot({ path: 'artifacts/f10/desktop.png', fullPage: true });
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await page.screenshot({ path: `artifacts/f10/mobile-${width}.png`, fullPage: true });
  }
  const backupDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup', exact: true }).click();
  const backup = await backupDownload;
  const path = await backup.path();
  expect(JSON.parse(readFileSync(path, 'utf8'))).toMatchObject({ saveFormatVersion: '5.0.0' });
  await page.reload();
  await page
    .locator('.saved-item')
    .filter({ has: page.getByText('Camp and circle', { exact: true }) })
    .getByRole('button', { name: 'Open', exact: true })
    .click();
  expect(await snapshot(page, 'After refresh')).toEqual(combined);
  const fresh = await browser.newPage();
  try {
    await fresh.goto('http://127.0.0.1:4200/');
    await fresh.setInputFiles('.import-label input', path);
    await expect(fresh.locator('.library-message .notice')).toHaveText('Imported 5 maps.');
    await fresh
      .locator('.saved-item')
      .filter({ has: fresh.getByText('Camp and circle', { exact: true }) })
      .getByRole('button', { name: 'Open', exact: true })
      .click();
    expect(await snapshot(fresh, 'Imported circle')).toEqual(combined);
  } finally {
    await fresh.close();
  }
});
test('a landmark that cannot fit preserves an imported map and recovers with a new seed', async ({
  page,
}) => {
  const fixture: {
    format: string;
    saveFormatVersion: string;
    maps: {
      map: { layout: { tiles: boolean[]; route: number[] }; decoration: { props: unknown[] } };
    }[];
  } = JSON.parse(readFileSync('src/app/save/fixtures/forest-v3.json', 'utf8'));
  const record = fixture.maps[0];
  if (!record) throw new Error('Expected fixture map');
  record.map.layout.route = record.map.layout.tiles.flatMap((floor, tile) => (floor ? [tile] : []));
  record.map.decoration.props = [];
  await page.goto('/');
  await page.setInputFiles('.import-label input', {
    name: 'cramped.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...fixture, maps: [record] })),
  });
  await expect(page.locator('.library-message .notice')).toHaveText('Imported 1 map.');
  await page.locator('.saved-item').getByRole('button', { name: 'Open', exact: true }).click();
  const before = await snapshot(page, 'No landmark space');
  await page
    .getByRole('combobox', { name: /^Landmark/ })
    .selectOption({ label: 'Standing-stone circle' });
  await page.getByRole('button', { name: 'Generate forest' }).click();
  await expect(page.locator('#settings-error')).toContainText('landmark could not fit');
  await expect(page.getByRole('combobox', { name: /^Landmark/ })).toHaveValue('Suggested landmark');
  expect(await snapshot(page, 'After rejected landmark')).toEqual(before);
  await page.getByLabel('World seed').fill('landmark-recovery');
  await page.getByRole('button', { name: 'Generate forest' }).click();
  await expect(page.locator('#settings-error')).toBeEmpty();
  await expect(page.locator('#map-summary')).toContainText('Standing-stone circle');
  expect((await snapshot(page, 'Recovered landmark')).decoration.landmark).toBe(
    'Suggested landmark',
  );
});
