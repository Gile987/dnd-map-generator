import { createCanvas } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { generateDungeon } from '../src/app/engine/generate';
import { generateCourtyard } from '../src/app/engine/courtyard-generate';
import type { GeneratedMap } from '../src/app/engine/model';
import {
  makeSavedMap,
  parseBundle,
  parseSavedMap,
  SAVE_STORAGE_KEY,
  serializeBundle,
} from '../src/app/save/save-format';
import type { SavedMap } from '../src/app/save/save-format';
import { renderMap } from '../src/app/rendering/render-map';

const dungeon = generateDungeon({
  seed: 'mosslit-sanctum',
  roomCount: 6,
  density: 'Balanced',
  preset: 'Mosslit',
});
const courtyard = generateCourtyard({ seed: 'ivy-court', density: 'Balanced', fountain: true });
const legacy = parseBundle(readFileSync('src/app/save/fixtures/forest-v3.json', 'utf8'));
if (!dungeon.ok || !courtyard.ok || !legacy.ok || !legacy.maps[0])
  throw new Error('Missing undo fixtures');

function saved(map: GeneratedMap, name: string, favorite: boolean): SavedMap {
  const canvas = createCanvas(320, 240);
  renderMap(canvas.getContext('2d'), map, { grid: false, pixelsPerTile: 8 });
  return {
    ...makeSavedMap(
      map,
      name,
      canvas.toDataURL(),
      name.replaceAll(' ', '-'),
      '2026-10-25T12:00:00Z',
    ),
    favorite,
  };
}
const records = [
  saved(dungeon.map, 'Amber vault', true),
  { ...legacy.maps[0], name: 'Legacy clearing' },
  saved(courtyard.map, 'Ivy court', true),
];
if (records.some((record) => !parseSavedMap(record))) throw new Error('Invalid undo fixture');
const banner = (page: Page) => page.locator('.undo-delete');
const undo = (page: Page) => page.getByRole('button', { name: 'Undo delete', exact: true });
const search = (page: Page) => page.getByRole('searchbox', { name: 'Search saved maps' });
const item = (page: Page, name: string) =>
  page
    .locator('.saved-item')
    .filter({ has: page.locator('.saved-name').getByText(name, { exact: true }) });
const disk = (page: Page) =>
  page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? '[]') as unknown,
    SAVE_STORAGE_KEY,
  );

async function seed(page: Page, data: readonly SavedMap[] = records) {
  await page.addInitScript(
    ({ key, raw }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, raw);
    },
    { key: SAVE_STORAGE_KEY, raw: JSON.stringify(data) },
  );
  await page.goto('/');
  await expect(page.locator('.saved-item')).toHaveCount(data.length);
}

async function remove(page: Page, name: string) {
  await item(page, name).getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('.library-message .notice')).toHaveText(`Deleted “${name}”.`);
  await expect(banner(page)).toContainText(`Deleted “${name}”.`);
}

async function png(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  const path = await (await pending).path();
  if (!path) throw new Error('Missing PNG');
  return readFile(path);
}

for (const record of records) {
  test(`${record.map.type} undo restores the exact saved record, artwork, and PNG`, async ({
    page,
  }) => {
    await seed(page);
    await item(page, record.name).getByRole('button', { name: 'Open', exact: true }).click();
    await expect(page.locator('.seed-summary')).toHaveText(record.map.seed);
    const exported = await png(page);
    await page.getByLabel('World seed').fill('unapplied-undo-draft');
    const canvas = page.locator('canvas');
    await canvas.focus();
    await page.keyboard.press('+');
    await page.keyboard.press('ArrowRight');
    const pixels = await canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL());
    await search(page).fill(record.name);
    await remove(page, record.name);
    await expect(search(page)).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(undo(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(banner(page)).toHaveCount(0);
    await expect(search(page)).toBeFocused();
    await expect(item(page, record.name)).toBeVisible();
    await expect(search(page)).toHaveValue(record.name);
    expect(await disk(page)).toEqual([
      record,
      ...records.filter((value) => value.id !== record.id),
    ]);
    await expect(page.getByLabel('World seed')).toHaveValue('unapplied-undo-draft');
    expect(await canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL())).toBe(pixels);
    expect(await png(page)).toEqual(exported);
    await page.reload();
    await item(page, record.name).getByRole('button', { name: 'Open', exact: true }).click();
    await expect(page.locator('.seed-summary')).toHaveText(record.map.seed);
    expect(await png(page)).toEqual(exported);
  });
}

test('the last successful deletion survives other actions and expires after the next deletion or refresh', async ({
  page,
}) => {
  await seed(page);
  await remove(page, 'Amber vault');
  await page.locator('#save-name').fill('New saved map');
  await page.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(page.locator('.library-message .notice')).toHaveText('Saved “New saved map”.');
  await expect(banner(page)).toContainText('Amber vault');
  await remove(page, 'Ivy court');
  await expect(banner(page)).not.toContainText('Amber vault');
  await undo(page).click();
  await expect(banner(page)).toHaveCount(0);
  await expect(item(page, 'Ivy court')).toBeVisible();
  await expect(item(page, 'New saved map')).toBeVisible();
  await expect(item(page, 'Amber vault')).toHaveCount(0);
  await remove(page, 'Ivy court');
  await page.reload();
  await expect(undo(page)).toHaveCount(0);
  await expect(item(page, 'Ivy court')).toHaveCount(0);
});

test('undo preserves filters and reports a restored map that they hide', async ({ page }) => {
  await seed(page);
  await remove(page, 'Amber vault');
  await search(page).fill('no matching map');
  await page.getByRole('combobox', { name: 'Map type', exact: true }).selectOption('courtyard');
  await page.getByRole('combobox', { name: 'Sort by' }).selectOption('name');
  await page.getByRole('checkbox', { name: 'Favorites only' }).check();
  await page.locator('#save-name').fill('Unfinished save');
  await undo(page).click();
  await expect(page.locator('.library-message .notice')).toHaveText(
    'Restored “Amber vault”. Current filters hide this map.',
  );
  await expect(search(page)).toBeFocused();
  await expect(search(page)).toHaveValue('no matching map');
  await expect(page.getByRole('combobox', { name: 'Map type', exact: true })).toHaveValue(
    'courtyard',
  );
  await expect(page.getByRole('combobox', { name: 'Sort by' })).toHaveValue('name');
  await expect(page.getByRole('checkbox', { name: 'Favorites only' })).toBeChecked();
  await expect(page.locator('#save-name')).toHaveValue('Unfinished save');
  await expect(page.locator('#library-result-count')).toHaveText('Showing 0 of 3 saved maps');
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(item(page, 'Amber vault')).toBeVisible();
});

test('a failed undo stays focused, keeps the snapshot, and retries without losing data', async ({
  page,
}) => {
  await seed(page);
  await remove(page, 'Amber vault');
  const before = await disk(page);
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name !== key) {
        original.call(this, name, value);
        return;
      }
      Storage.prototype.setItem = original;
      throw new DOMException('Full storage', 'QuotaExceededError');
    };
  }, SAVE_STORAGE_KEY);
  await undo(page).focus();
  await page.keyboard.press('Enter');
  await expect(banner(page).getByRole('alert')).toContainText('could not write');
  await expect(undo(page)).toBeFocused();
  await expect(undo(page)).toBeEnabled();
  expect(await disk(page)).toEqual(before);
  await banner(page).screenshot({ path: 'artifacts/f16/write-error.png' });
  await page.keyboard.press('Enter');
  await expect(banner(page)).toHaveCount(0);
  await expect(search(page)).toBeFocused();
  await expect(item(page, 'Amber vault')).toBeVisible();
});

test('deletion reads the latest name and favorite from another tab, and undo restores that version', async ({
  page,
  context,
}) => {
  await page.addInitScript(() =>
    window.addEventListener('storage', (event) => event.stopImmediatePropagation()),
  );
  await seed(page);
  const other = await context.newPage();
  await other.goto('/');
  await item(other, 'Amber vault').getByRole('button', { name: 'Rename', exact: true }).click();
  await other
    .getByRole('textbox', { name: 'Rename map', exact: true })
    .fill('Updated in another tab');
  await other.locator('.rename-form button[type="submit"]').click();
  await expect(item(other, 'Updated in another tab')).toBeVisible();
  await item(other, 'Updated in another tab')
    .getByRole('button', { name: 'Remove from favorites' })
    .click();
  await expect(item(other, 'Updated in another tab')).not.toHaveClass(/favorite/);
  await item(page, 'Amber vault').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(banner(page)).toContainText('Updated in another tab');
  await expect(page.locator('.library-message .notice')).toHaveText(
    'Deleted “Updated in another tab”.',
  );
  await undo(page).click();
  await expect(item(page, 'Updated in another tab')).toBeVisible();
  await expect(item(other, 'Updated in another tab')).toBeVisible();
  const restored = await disk(page);
  expect(restored).toEqual([
    { ...records[0], name: 'Updated in another tab', favorite: false },
    ...records.slice(1),
  ]);
});

test('a reused identifier cannot overwrite another tab’s newer save or duplicate its ID', async ({
  page,
  context,
}) => {
  await page.addInitScript(() =>
    window.addEventListener('storage', (event) => event.stopImmediatePropagation()),
  );
  await seed(page);
  await remove(page, 'Amber vault');
  const other = await context.newPage();
  await other.goto('/');
  const first = records[0];
  const third = records[2];
  if (!first || !third) throw new Error('Missing records');
  const replacement = { ...third, id: first.id, name: 'Newer replacement' };
  await other.setInputFiles('.import-label input', {
    name: 'replacement.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serializeBundle([replacement])),
  });
  await expect(item(other, 'Newer replacement')).toBeVisible();
  const before = await disk(page);
  await undo(page).click();
  await expect(banner(page).getByRole('alert')).toContainText('will not overwrite');
  expect(await disk(page)).toEqual(before);
  await expect(item(page, 'Newer replacement')).toBeVisible();
  await expect(undo(page)).toBeFocused();
  await banner(page).screenshot({ path: 'artifacts/f16/conflict.png' });
  await remove(other, 'Newer replacement');
  await undo(page).click();
  await expect(item(page, 'Amber vault')).toBeVisible();
  await expect(item(other, 'Amber vault')).toBeVisible();
  await undo(other).click();
  await expect(banner(other).getByRole('alert')).toContainText('will not overwrite');
  expect(await disk(page)).toEqual([first, ...records.slice(1)]);
});

test('queued undo keeps focus and ignores repeated activation while preserving another tab’s write', async ({
  page,
  context,
}) => {
  await seed(page);
  await remove(page, 'Amber vault');
  const other = await context.newPage();
  await other.goto('/');
  await other.evaluate(() => {
    void navigator.locks.request(
      'encounter-map-forge.saves.write',
      () =>
        new Promise<void>((resolve) => {
          document.addEventListener('release-undo-lock', () => resolve(), { once: true });
          document.documentElement.dataset['undoLockHeld'] = 'true';
        }),
    );
  });
  await expect(other.locator('html')).toHaveAttribute('data-undo-lock-held', 'true');
  await item(other, 'Ivy court').getByRole('button', { name: 'Rename', exact: true }).click();
  await other
    .getByRole('textbox', { name: 'Rename map', exact: true })
    .fill('Keep this newer name');
  await other.locator('.rename-form button[type="submit"]').click();
  await undo(page).click();
  await expect(undo(page)).toBeDisabled();
  await expect(undo(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect
    .poll(() => page.evaluate(async () => (await navigator.locks.query()).pending?.length))
    .toBe(2);
  await banner(page).screenshot({ path: 'artifacts/f16/queued.png' });
  await other.evaluate(() => document.dispatchEvent(new Event('release-undo-lock')));
  await expect(banner(page)).toHaveCount(0);
  await expect(search(page)).toBeFocused();
  for (const tab of [page, other]) {
    await expect(item(tab, 'Amber vault')).toBeVisible();
    await expect(item(tab, 'Keep this newer name')).toBeVisible();
  }
  expect(await disk(page)).toEqual([
    records[0],
    records[1],
    { ...records[2], name: 'Keep this newer name' },
  ]);
});

test('deleting a card with an unfinished rename restores its saved name', async ({ page }) => {
  await seed(page);
  await item(page, 'Amber vault').getByRole('button', { name: 'Rename', exact: true }).click();
  await page.getByRole('textbox', { name: 'Rename map', exact: true }).fill('Uncommitted rename');
  await page
    .locator('.saved-item')
    .filter({ has: page.getByRole('textbox', { name: 'Rename map', exact: true }) })
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await expect(banner(page)).toContainText('Amber vault');
  await undo(page).click();
  await expect(item(page, 'Amber vault')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Rename map', exact: true })).toHaveCount(0);
  expect(await disk(page)).toEqual(records);
});

test('export temporarily disables undo without consuming it or changing the saved library', async ({
  page,
}) => {
  await seed(page);
  await remove(page, 'Amber vault');
  const before = await disk(page);
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      HTMLCanvasElement.prototype.toBlob = original;
      document.addEventListener('release-undo-export', () => callback(null), { once: true });
      document.documentElement.dataset['undoExportHeld'] = 'true';
    };
  });
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-undo-export-held', 'true');
  await expect(undo(page)).toBeDisabled();
  await undo(page).focus();
  await page.keyboard.press('Enter');
  expect(await disk(page)).toEqual(before);
  await page.evaluate(() => document.dispatchEvent(new Event('release-undo-export')));
  await expect(page.locator('#settings-error')).toContainText('could not create a PNG');
  await expect(undo(page)).toBeEnabled();
  await undo(page).click();
  await expect(item(page, 'Amber vault')).toBeVisible();
});

test('unreadable storage pauses undo without losing its snapshot and permits recovery', async ({
  page,
}) => {
  await seed(page);
  await remove(page, 'Amber vault');
  const raw = JSON.stringify([...records.slice(1), null]);
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
    key: SAVE_STORAGE_KEY,
    raw,
  });
  await undo(page).click();
  await expect(banner(page).getByRole('alert')).toContainText('Changes are paused');
  await expect(undo(page)).toBeDisabled();
  await page.keyboard.press('Enter');
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)).toBe(raw);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download recovery data' }).click();
  const path = await (await download).path();
  if (!path) throw new Error('Missing recovery data');
  expect(await readFile(path, 'utf8')).toBe(raw);
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
    key: SAVE_STORAGE_KEY,
    raw: JSON.stringify(records.slice(1)),
  });
  await page.getByRole('button', { name: 'Retry library' }).click();
  await expect(undo(page)).toBeEnabled();
  await undo(page).click();
  await expect(item(page, 'Amber vault')).toBeVisible();
});

for (const [width, height] of [
  [1440, 1100],
  [768, 1024],
  [390, 844],
  [320, 568],
  [800, 420],
] as const) {
  test(`the undo row fits, wraps long names, and supports keyboard focus at ${width} × ${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const first = records[0];
    if (!first) throw new Error('Missing record');
    const name = 'Forgotten'.repeat(8).slice(0, 64);
    await seed(page, [{ ...first, name }]);
    await remove(page, name);
    await page.keyboard.press('Shift+Tab');
    await expect(undo(page)).toBeFocused();
    await expect(undo(page)).toHaveAccessibleDescription(
      'Available in this tab until your next deletion or page refresh.',
    );
    await expect(undo(page)).toBeInViewport({ ratio: 1 });
    const overflow = await page
      .locator('.library *')
      .evaluateAll((elements) =>
        elements
          .filter((element) => element.getBoundingClientRect().right > innerWidth + 1)
          .map((element) => `${element.tagName}.${element.className}`),
      );
    expect(overflow).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    const bounds = await undo(page).boundingBox();
    if (!bounds) throw new Error('Missing Undo button');
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    await banner(page).screenshot({ path: `artifacts/f16/undo-${width}-${height}.png` });
    await page.keyboard.press('Enter');
    await expect(banner(page)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  });
}
