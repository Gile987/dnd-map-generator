import { createCanvas } from '@napi-rs/canvas';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { generateDungeon } from '../src/app/engine/generate';
import { generateForestClearing } from '../src/app/engine/forest-generate';
import { generateCourtyard } from '../src/app/engine/courtyard-generate';
import type { GeneratedMap, MapType } from '../src/app/engine/model';
import { makeSavedMap, SAVE_STORAGE_KEY } from '../src/app/save/save-format';
import { renderMap } from '../src/app/rendering/render-map';

const dungeon = generateDungeon({
  seed: 'stone-seed',
  roomCount: 6,
  density: 'Balanced',
  preset: 'Mosslit',
});
const forest = generateForestClearing({
  seed: 'woodland-seed',
  density: 'Balanced',
  character: 'Verdant',
});
const courtyard = generateCourtyard({ seed: 'ivy-seed', density: 'Balanced', fountain: true });
if (!dungeon.ok || !forest.ok || !courtyard.ok) throw new Error('Missing browser fixtures');
const maps: Readonly<Record<Exclude<MapType, 'tower'>, GeneratedMap>> = {
  dungeon: dungeon.map,
  forest: forest.map,
  courtyard: courtyard.map,
};

function saved(
  id: string,
  name: string,
  type: Exclude<MapType, 'tower'>,
  day: number,
  favorite = false,
) {
  const canvas = createCanvas(320, 240);
  renderMap(canvas.getContext('2d'), maps[type], { grid: false, pixelsPerTile: 8 });
  return {
    ...makeSavedMap(maps[type], name, canvas.toDataURL(), id, `2026-10-${day}T12:00:00Z`),
    favorite,
  };
}

const records = [
  saved('vault', 'Ashen vault', 'dungeon', 26),
  saved('hall', 'Amber hall', 'dungeon', 21, true),
  saved('fey', 'Fey camp', 'forest', 24, true),
  saved('clearing', 'Quiet clearing', 'forest', 23),
  saved('ivy', 'Ivy court', 'courtyard', 22, true),
  saved('ruin', 'Fallen arcade', 'courtyard', 25),
];
const original = JSON.stringify(records);
const item = (page: Page, name: string) =>
  page
    .locator('.saved-item')
    .filter({ has: page.locator('.saved-name').getByText(name, { exact: true }) });
const search = (page: Page) =>
  page.getByRole('searchbox', { name: 'Search saved maps', exact: true });
const typeFilter = (page: Page) => page.getByRole('combobox', { name: 'Map type', exact: true });
const sort = (page: Page) => page.getByRole('combobox', { name: 'Sort by', exact: true });
const favorites = (page: Page) =>
  page.getByRole('checkbox', { name: 'Favorites only', exact: true });
const names = (page: Page) => page.locator('.saved-name');

async function seed(page: Page, raw = original, total = 6) {
  await page.addInitScript(
    ({ key, raw }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, raw);
    },
    { key: SAVE_STORAGE_KEY, raw },
  );
  await page.goto('/');
  await expect(page.locator('#library-result-count')).toHaveText(
    `Showing ${total} of ${total} saved maps`,
  );
}

test('a collection of dozens stays searchable, countable, and naturally sorted', async ({
  page,
}) => {
  const many = Array.from({ length: 36 }, (_, i) => {
    const source = records[i % records.length];
    if (!source) throw new Error('Missing source');
    return { ...source, id: `expedition-${i + 1}`, name: `Expedition ${i + 1}` };
  });
  await seed(page, JSON.stringify(many), 36);
  await sort(page).selectOption('name');
  await expect(names(page)).toHaveText(many.map((record) => record.name));
  await search(page).fill('  EXPEDITION 2  ');
  await expect(page.locator('#library-result-count')).toHaveText('Showing 11 of 36 saved maps');
  await typeFilter(page).selectOption('forest');
  await favorites(page).check();
  await expect(names(page)).toHaveText(['Expedition 21', 'Expedition 27']);
  await expect(page.locator('#library-result-count')).toHaveText('Showing 2 of 36 saved maps');
});

test('a truly empty library keeps filters usable through the first save and last deletion', async ({
  page,
}) => {
  await seed(page, '[]', 0);
  await expect(page.locator('.library-empty')).toContainText('Your library is empty.');
  await search(page).fill('First map');
  await typeFilter(page).selectOption('forest');
  await page.locator('#save-name').fill('First map');
  await page.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(page.locator('.library-message .notice')).toHaveText('Saved “First map”.');
  await expect(page.locator('#library-result-count')).toHaveText('Showing 0 of 1 saved map');
  await expect(page.getByText('No matching maps', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await search(page).fill('First map');
  await item(page, 'First map').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('.library-empty')).toContainText('Your library is empty.');
  await expect(search(page)).toBeFocused();
  await expect(search(page)).toHaveValue('First map');
  await expect(page.locator('#library-result-count')).toHaveText('Showing 0 of 0 saved maps');
});

test('search and combined filters change only the visible library; sorting and clearing are explicit', async ({
  page,
}) => {
  await seed(page);
  const before = await page.locator('#map-summary').textContent();
  await page.getByLabel('World seed').fill('unapplied-library-draft');
  await expect(names(page)).toHaveText([
    'Fey camp',
    'Ivy court',
    'Amber hall',
    'Ashen vault',
    'Fallen arcade',
    'Quiet clearing',
  ]);
  await sort(page).selectOption('newest');
  await expect(names(page)).toHaveText([
    'Ashen vault',
    'Fallen arcade',
    'Fey camp',
    'Quiet clearing',
    'Ivy court',
    'Amber hall',
  ]);
  await sort(page).selectOption('name');
  await expect(names(page)).toHaveText([
    'Amber hall',
    'Ashen vault',
    'Fallen arcade',
    'Fey camp',
    'Ivy court',
    'Quiet clearing',
  ]);
  await search(page).fill('  VAULT  ');
  await expect(names(page)).toHaveText(['Ashen vault']);
  await search(page).fill('WOODLAND-SEED');
  await expect(names(page)).toHaveText(['Fey camp', 'Quiet clearing']);
  await search(page).fill('ivy');
  await typeFilter(page).selectOption('courtyard');
  await favorites(page).check();
  await expect(names(page)).toHaveText(['Ivy court']);
  await expect(page.locator('#library-result-count')).toHaveText('Showing 1 of 6 saved maps');
  await typeFilter(page).selectOption('forest');
  await expect(page.getByText('No matching maps', { exact: true })).toBeVisible();
  await expect(page.locator('.filtered-empty')).toContainText('still in the library');
  await expect(page.locator('#library-result-count')).toHaveText('Showing 0 of 6 saved maps');
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(search(page)).toBeFocused();
  await expect(search(page)).toHaveValue('');
  await expect(typeFilter(page)).toHaveValue('all');
  await expect(favorites(page)).not.toBeChecked();
  await expect(sort(page)).toHaveValue('name');
  await expect(names(page)).toHaveCount(6);
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)).toBe(original);
  expect(await page.locator('#map-summary').textContent()).toBe(before);
  await expect(page.getByLabel('World seed')).toHaveValue('unapplied-library-draft');
  await page.reload();
  await expect(sort(page)).toHaveValue('favorites');
  await expect(names(page)).toHaveCount(6);
});

test('renaming and removing favorites update matching results and preserve keyboard focus', async ({
  page,
}) => {
  await seed(page);
  await search(page).fill('Fey camp');
  await item(page, 'Fey camp').getByRole('button', { name: 'Rename', exact: true }).click();
  await page.getByRole('textbox', { name: 'Rename map', exact: true }).fill('Hidden glade');
  await page.locator('.rename-form button[type=submit]').click();
  await expect(page.locator('.library-message .notice')).toHaveText('Renamed to “Hidden glade”.');
  await expect(names(page)).toHaveCount(0);
  await expect(search(page)).toBeFocused();
  await search(page).fill('Hidden');
  await favorites(page).check();
  await expect(names(page)).toHaveText(['Hidden glade']);
  await item(page, 'Hidden glade')
    .getByRole('button', { name: 'Remove from favorites', exact: true })
    .click();
  await expect(names(page)).toHaveCount(0);
  await expect(search(page)).toBeFocused();
  await expect(page.locator('#library-result-count')).toHaveText('Showing 0 of 6 saved maps');
  await favorites(page).uncheck();
  await item(page, 'Hidden glade').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(search(page)).toBeFocused();
  await expect(page.locator('#library-result-count')).toHaveText('Showing 0 of 5 saved maps');
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(names(page)).toHaveCount(5);
});

test('a failed favorite write retains filtered results and retries without losing the view', async ({
  page,
}) => {
  await seed(page);
  await typeFilter(page).selectOption('forest');
  await favorites(page).check();
  await search(page).fill('Fey');
  await sort(page).selectOption('name');
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) {
        Storage.prototype.setItem = original;
        throw new DOMException('Full', 'QuotaExceededError');
      }
      original.call(this, name, value);
    };
  }, SAVE_STORAGE_KEY);
  await item(page, 'Fey camp')
    .getByRole('button', { name: 'Remove from favorites', exact: true })
    .click();
  await expect(page.locator('.library-message .error')).toContainText('could not write');
  await expect(names(page)).toHaveText(['Fey camp']);
  await expect(search(page)).toHaveValue('Fey');
  await expect(typeFilter(page)).toHaveValue('forest');
  await expect(favorites(page)).toBeChecked();
  await expect(sort(page)).toHaveValue('name');
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)).toBe(original);
  await item(page, 'Fey camp')
    .getByRole('button', { name: 'Remove from favorites', exact: true })
    .click();
  await expect(names(page)).toHaveCount(0);
  await expect(page.locator('.library-message .error')).toBeEmpty();
  await expect(search(page)).toBeFocused();
  await expect(sort(page)).toHaveValue('name');
});

test('filters react to cross-tab renames, favorites, duplicates, and deletion without resetting', async ({
  page,
  context,
}) => {
  await seed(page);
  const other = await context.newPage();
  await other.goto('/');
  await typeFilter(page).selectOption('forest');
  await favorites(page).check();
  await search(page).fill('Fey');
  await sort(page).selectOption('name');
  await item(other, 'Fey camp').getByRole('button', { name: 'Rename', exact: true }).click();
  await other.getByRole('textbox', { name: 'Rename map', exact: true }).fill('Hidden camp');
  await other.locator('.rename-form button[type=submit]').click();
  await expect(names(page)).toHaveCount(0);
  await expect(search(page)).toHaveValue('Fey');
  await search(page).fill('Hidden');
  await expect(names(page)).toHaveText(['Hidden camp']);
  await item(other, 'Hidden camp')
    .getByRole('button', { name: 'Remove from favorites', exact: true })
    .click();
  await expect(names(page)).toHaveCount(0);
  await item(other, 'Hidden camp')
    .getByRole('button', { name: 'Mark as favorite', exact: true })
    .click();
  await expect(names(page)).toHaveCount(1);
  await item(other, 'Hidden camp').getByRole('button', { name: 'Duplicate', exact: true }).click();
  await expect(page.locator('#library-result-count')).toHaveText('Showing 1 of 7 saved maps');
  await item(other, 'Hidden camp').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('#library-result-count')).toHaveText('Showing 0 of 6 saved maps');
  await expect(search(page)).toHaveValue('Hidden');
  await expect(typeFilter(page)).toHaveValue('forest');
  await expect(favorites(page)).toBeChecked();
  await expect(sort(page)).toHaveValue('name');
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(item(page, 'Hidden camp (copy)')).toBeVisible();
  await expect(item(page, 'Hidden camp')).toHaveCount(0);
});

test('a filtered-out save and a full-library backup retain their exact models', async ({
  page,
}) => {
  await seed(page);
  await typeFilter(page).selectOption('forest');
  await search(page).fill('not-present');
  await page.locator('#save-name').fill('Hidden dungeon');
  await page.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(page.locator('.library-message .notice')).toHaveText('Saved “Hidden dungeon”.');
  await expect(names(page)).toHaveCount(0);
  await expect(page.locator('#library-result-count')).toHaveText('Showing 0 of 7 saved maps');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup', exact: true }).click();
  const download = await pending;
  const bundle: unknown = JSON.parse((await readFile(await download.path())).toString());
  expect(bundle).toMatchObject({
    saveFormatVersion: '16.0.0',
    maps: expect.arrayContaining(
      records.map((record) => expect.objectContaining({ id: record.id, map: record.map })),
    ),
  });
  if (
    typeof bundle !== 'object' ||
    bundle === null ||
    !('maps' in bundle) ||
    !Array.isArray(bundle.maps)
  )
    throw new Error('Missing backup');
  expect(bundle.maps).toHaveLength(7);
  await expect(search(page)).toHaveValue('not-present');
  await expect(typeFilter(page)).toHaveValue('forest');
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(item(page, 'Hidden dungeon')).toBeVisible();
});

test('readable saved maps remain filterable during recovery without replacing raw data', async ({
  page,
}) => {
  const raw = JSON.stringify([
    ...records,
    { ...records[0], id: 'future', saveFormatVersion: '99.0.0' },
  ]);
  await seed(page, raw);
  await expect(page.locator('.library-recovery')).toContainText('Changes are paused');
  await expect(page.getByRole('button', { name: 'Save map', exact: true })).toBeDisabled();
  await search(page).fill('ivy');
  await typeFilter(page).selectOption('courtyard');
  await expect(names(page)).toHaveText(['Ivy court', 'Fallen arcade']);
  await item(page, 'Ivy court').getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ruined Courtyard', exact: true })).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download recovery data', exact: true }).click();
  expect((await readFile(await (await pending).path())).toString()).toBe(raw);
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)).toBe(raw);
  await page.getByRole('button', { name: 'Retry library', exact: true }).click();
  await expect(search(page)).toHaveValue('ivy');
  await expect(typeFilter(page)).toHaveValue('courtyard');
});

for (const width of [1440, 1024, 900, 801, 768, 320])
  test(`library browsing is responsive and keyboard accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 });
    await seed(page);
    await search(page).focus();
    await page.keyboard.press('Tab');
    await expect(typeFilter(page)).toBeFocused();
    await typeFilter(page).selectOption('courtyard');
    await page.keyboard.press('Tab');
    await expect(sort(page)).toBeFocused();
    await expect(sort(page)).toHaveCSS('outline-style', 'solid');
    await sort(page).selectOption('name');
    await page.keyboard.press('Tab');
    await expect(favorites(page)).toBeFocused();
    await page.keyboard.press('Space');
    await expect(names(page)).toHaveText(['Ivy court']);
    await expect(page.locator('.favorites-filter')).toHaveCSS('outline-style', 'solid');
    const favoriteBounds = await page.locator('.favorites-filter').boundingBox();
    expect(favoriteBounds?.height).toBeLessThanOrEqual(42);
    const card = page.locator('.saved-item').first();
    const cardBounds = await card.boundingBox();
    if (!cardBounds) throw new Error('Missing saved card');
    for (const button of await card.locator('.saved-actions button').all()) {
      const bounds = await button.boundingBox();
      if (!bounds) throw new Error('Missing saved action');
      expect(bounds.x).toBeGreaterThanOrEqual(cardBounds.x);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(cardBounds.x + cardBounds.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(cardBounds.y + cardBounds.height);
    }
    await page.locator('.library').screenshot({ path: `artifacts/f15/library-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Clear filters', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(search(page)).toBeFocused();
    await expect(names(page)).toHaveCount(6);
    await search(page).fill('unmatched-query');
    await page.locator('.library').screenshot({ path: `artifacts/f15/empty-${width}.png` });
    await expect(page.getByText('No matching maps', { exact: true })).toBeVisible();
  });

test('export disables browsing controls and a failed export restores the same view', async ({
  page,
}) => {
  await seed(page);
  await search(page).fill('ivy');
  await typeFilter(page).selectOption('courtyard');
  await favorites(page).check();
  await sort(page).selectOption('name');
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      document.addEventListener(
        'fail-browse-export',
        () => {
          HTMLCanvasElement.prototype.toBlob = original;
          callback(null);
        },
        { once: true },
      );
      document.documentElement.dataset['browseExportHeld'] = 'true';
    };
  });
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-browse-export-held', 'true');
  for (const control of [
    search(page),
    typeFilter(page),
    sort(page),
    favorites(page),
    page.getByRole('button', { name: 'Clear filters', exact: true }),
  ])
    await expect(control).toBeDisabled();
  await page.locator('.library').screenshot({ path: 'artifacts/f15/disabled.png' });
  await page.evaluate(() => document.dispatchEvent(new Event('fail-browse-export')));
  await expect(page.locator('#settings-error')).toContainText('could not create a PNG');
  for (const control of [search(page), typeFilter(page), sort(page), favorites(page)])
    await expect(control).toBeEnabled();
  await expect(search(page)).toHaveValue('ivy');
  await expect(typeFilter(page)).toHaveValue('courtyard');
  await expect(favorites(page)).toBeChecked();
  await expect(sort(page)).toHaveValue('name');
  await expect(names(page)).toHaveText(['Ivy court']);
});
