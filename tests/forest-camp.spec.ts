import { selectedAddition, setAddition } from './additions';
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

test('camp drafts preserve accepted maps and apply without rebuilding the clearing', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Forest', exact: true }).check();
  await expect(page.getByRole('button', { name: 'Generate forest' })).toBeDisabled();
  const original = await snapshot(page, 'Original');
  const pixels = await page
    .locator('canvas')
    .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
  await setAddition(page, 'Abandoned camp');
  expect(
    await page.locator('canvas').evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL()),
  ).toBe(pixels);
  expect(await snapshot(page, 'Pending')).toEqual(original);
  await page.getByRole('button', { name: 'Generate forest' }).click();
  await expect(page.locator('#map-summary')).toContainText('Abandoned camp');
  const camp = await snapshot(page, 'Camp');
  expect(camp.decoration.scene).toBe('Abandoned camp');
  expect(camp.layout).toEqual(original.layout);
  expect(camp.surfaceSeed).toBe(original.surfaceSeed);
  await setAddition(page, 'Abandoned camp', false);
  await page.getByRole('button', { name: 'Shuffle details' }).click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  const shuffled = await snapshot(page, 'Shuffled camp');
  expect(shuffled.decoration.scene).toBe('Abandoned camp');
  expect(shuffled.layout).toEqual(camp.layout);
  expect(shuffled.decoration.props).not.toEqual(camp.decoration.props);
  await page.getByRole('button', { name: 'Reset changes' }).click();
  await expect(selectedAddition(page, 'Abandoned camp')).toBeVisible();
  await page.getByRole('radio', { name: 'Fey glade', exact: true }).check();
  await page.getByRole('radio', { name: 'Sparse', exact: true }).check();
  await page.getByRole('button', { name: 'Generate forest' }).click();
  const fey = await snapshot(page, 'Fey camp');
  expect(fey.decoration).toMatchObject({
    scene: 'Abandoned camp',
    character: 'Fey',
    density: 'Sparse',
    revision: 1,
  });
  expect(fey.layout).toEqual(camp.layout);
  await setAddition(page, 'Abandoned camp', false);
  await page.getByRole('button', { name: 'Generate forest' }).click();
  await expect(page.locator('#map-summary')).not.toContainText('Abandoned camp');
  await page
    .locator('.saved-item')
    .filter({ has: page.getByText('Camp', { exact: true }) })
    .getByRole('button', { name: 'Open', exact: true })
    .click();
  await expect(selectedAddition(page, 'Abandoned camp')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate forest' })).toBeDisabled();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  const png = await download;
  expect(png.suggestedFilename()).toContain('-abandoned-camp-');
  expect(await PNG.read(await png.path())).toEqual({ width: 2560, height: 1920 });
  await selectedAddition(page, 'Abandoned camp').focus();
  await page.screenshot({ path: 'artifacts/f09/desktop.png', fullPage: true });
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await page.screenshot({ path: `artifacts/f09/camp-${width}.png`, fullPage: true });
  }
});

test('a camp survives refresh and a current-format backup imported into an empty browser', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Forest', exact: true }).check();
  await setAddition(page, 'Abandoned camp');
  await page.getByRole('button', { name: 'Generate forest' }).click();
  const saved = await snapshot(page, 'Portable camp');
  await page.reload();
  await page.locator('.saved-item').getByRole('button', { name: 'Open', exact: true }).click();
  await expect(selectedAddition(page, 'Abandoned camp')).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup', exact: true }).click();
  const backup = await pending;
  const path = await backup.path();
  expect(JSON.parse(readFileSync(path, 'utf8'))).toMatchObject({ saveFormatVersion: '10.0.0' });
  const fresh = await browser.newPage();
  try {
    await fresh.goto('http://127.0.0.1:4200/');
    await fresh.setInputFiles('.import-label input', path);
    await expect(fresh.locator('.library-message .notice')).toHaveText('Imported 1 map.');
    await fresh.locator('.saved-item').getByRole('button', { name: 'Open', exact: true }).click();
    await expect(selectedAddition(fresh, 'Abandoned camp')).toBeVisible();
    expect(await snapshot(fresh, 'Imported snapshot')).toEqual(saved);
  } finally {
    await fresh.close();
  }
});

test('a camp that cannot fit preserves an imported map and recovers with a new seed', async ({
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
  const before = await snapshot(page, 'No camp space');
  await setAddition(page, 'Abandoned camp');
  await page.getByRole('button', { name: 'Generate forest' }).click();
  await expect(page.locator('#settings-error')).toContainText('camp could not fit');
  await expect(selectedAddition(page, 'Abandoned camp')).toBeVisible();
  expect(await snapshot(page, 'After rejected camp')).toEqual(before);
  await page.getByLabel('World seed').fill('camp-recovery');
  await page.getByRole('button', { name: 'Generate forest' }).click();
  await expect(page.locator('#settings-error')).toBeEmpty();
  await expect(page.locator('#map-summary')).toContainText('Abandoned camp');
  expect((await snapshot(page, 'Recovered camp')).decoration.scene).toBe('Abandoned camp');
});
