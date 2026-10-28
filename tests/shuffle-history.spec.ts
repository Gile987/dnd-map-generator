import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { parseSavedMap, SAVE_STORAGE_KEY } from '../src/app/save/save-format';
import { setAddition } from './additions';

async function settled(page: Page): Promise<void> {
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
}

async function selectType(page: Page, type: 'Dungeon' | 'Forest'): Promise<void> {
  await page.getByRole('radio', { name: type, exact: true }).check();
  await expect(
    page.getByRole('heading', {
      name: type === 'Dungeon' ? 'Shape your dungeon' : 'Shape your clearing',
      exact: true,
    }),
  ).toBeVisible();
  await settled(page);
}

async function shuffle(page: Page, revision: number): Promise<void> {
  await page.getByRole('button', { name: 'Shuffle details', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText(`r${revision}`);
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
  const saved = data.map(parseSavedMap).find((record) => record?.name === name);
  if (!saved) throw new Error('Missing snapshot');
  return saved.map;
}

async function png(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  const download = await pending;
  await settled(page);
  return { name: download.suggestedFilename(), bytes: await readFile(await download.path()) };
}

for (const type of ['Dungeon', 'Forest'] as const) {
  test(`${type} undo and redo preserve exact artwork, drafts, saved maps, and PNG exports`, async ({
    page,
  }) => {
    await page.goto('/');
    await selectType(page, type);
    const undo = page.getByRole('button', { name: 'Undo shuffle', exact: true });
    const redo = page.getByRole('button', { name: 'Redo shuffle', exact: true });
    await expect(undo).toBeDisabled();
    await expect(redo).toBeDisabled();
    await undo.focus();
    await page.keyboard.press('Enter');
    await settled(page);
    await expect(page.locator('#map-summary')).toContainText('r0');
    await setAddition(page, type === 'Dungeon' ? 'Dining table' : 'Abandoned camp');
    await page.getByRole('button', { name: `Generate ${type.toLowerCase()}`, exact: true }).click();
    const original = await snapshot(page, 'Before shuffling');
    const originalPng = await png(page);
    const pixels = () =>
      page.locator('canvas').evaluate((canvas) => {
        if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing preview');
        return canvas.toDataURL();
      });
    const originalPixels = await pixels();
    await shuffle(page, 1);
    await shuffle(page, 2);
    const shuffled = await snapshot(page, 'Two shuffles');
    await page.getByLabel('World seed').fill('unapplied-history-seed');
    await page.getByRole('radio', { name: 'Cluttered', exact: true }).check();
    await undo.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#map-summary')).toContainText('r1');
    await settled(page);
    await expect(undo).toBeEnabled();
    await expect(redo).toBeEnabled();
    expect(await undo.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
    await page
      .locator('.details-section')
      .screenshot({ path: `artifacts/f13/${type.toLowerCase()}-focus.png` });
    await page.keyboard.press('Enter');
    await expect(page.locator('#map-summary')).toContainText('r0');
    await settled(page);
    await expect(undo).toBeDisabled();
    await expect(redo).toBeEnabled();
    await expect(undo).toBeFocused();
    await page
      .locator('.details-section')
      .screenshot({ path: `artifacts/f13/${type.toLowerCase()}-boundary.png` });
    await page.keyboard.press('Enter');
    await settled(page);
    await expect(page.locator('#map-summary')).toContainText('r0');
    await expect(page.getByLabel('World seed')).toHaveValue('unapplied-history-seed');
    await expect(page.getByRole('radio', { name: 'Cluttered', exact: true })).toBeChecked();
    await expect(page.getByRole('region', { name: 'Pending changes', exact: true })).toBeVisible();
    expect(await snapshot(page, 'Restored original')).toEqual(original);
    await expect.poll(pixels).toBe(originalPixels);
    expect(await png(page)).toEqual(originalPng);
    for (const revision of [1, 2]) {
      await redo.click();
      await expect(page.locator('#map-summary')).toContainText(`r${revision}`);
      await settled(page);
    }
    expect(await snapshot(page, 'Restored shuffle')).toEqual(shuffled);
    await expect(redo).toBeDisabled();
    await expect(page.getByLabel('World seed')).toHaveValue('unapplied-history-seed');
    for (const width of [1440, 768, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
      await page
        .locator('.details-section')
        .screenshot({ path: `artifacts/f13/${type.toLowerCase()}-${width}.png` });
    }
  });
}

test('histories stay independent and reset only when settings are applied, a save opens, or the page reloads', async ({
  page,
}) => {
  await page.goto('/');
  const undo = page.getByRole('button', { name: 'Undo shuffle', exact: true });
  const redo = page.getByRole('button', { name: 'Redo shuffle', exact: true });
  await shuffle(page, 1);
  const saved = await snapshot(page, 'Dungeon checkpoint');
  await shuffle(page, 2);
  await undo.click();
  await settled(page);
  await expect(redo).toBeEnabled();
  await selectType(page, 'Forest');
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  await shuffle(page, 1);
  await selectType(page, 'Dungeon');
  await expect(page.locator('#map-summary')).toContainText('r1');
  await expect(undo).toBeEnabled();
  await expect(redo).toBeEnabled();
  await page.getByLabel('World seed').fill('new-history');
  await page.getByRole('button', { name: 'Generate dungeon', exact: true }).click();
  await settled(page);
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  await selectType(page, 'Forest');
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(page.locator('#map-summary')).toContainText('r0');
  await settled(page);
  await shuffle(page, 1);
  await expect(redo).toBeDisabled();
  await page.locator('.saved-item').getByRole('button', { name: 'Open', exact: true }).click();
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  expect(await snapshot(page, 'Opened checkpoint')).toEqual(saved);
  await selectType(page, 'Forest');
  await expect(undo).toBeEnabled();
  await page.reload();
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  await selectType(page, 'Forest');
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
});

test('undo restores a historical forest snapshot and its original pixels without regeneration', async ({
  page,
}) => {
  await page.goto('/');
  const fixture = readFileSync('src/app/save/fixtures/forest-v3.json');
  const bundle: { maps: { name: string }[] } = JSON.parse(fixture.toString());
  const first = bundle.maps[0];
  if (!first) throw new Error('Missing legacy map');
  await page.setInputFiles('.import-label input', {
    name: 'legacy.json',
    mimeType: 'application/json',
    buffer: fixture,
  });
  await expect(page.locator('.library-message .notice')).toContainText('Imported 3 maps');
  await page
    .locator('.saved-item')
    .filter({ has: page.getByText(first.name, { exact: true }) })
    .getByRole('button', { name: 'Open', exact: true })
    .click();
  const original = await snapshot(page, 'Historical original');
  expect(original.version).toBe('3.0.0');
  const exported = await png(page);
  const revision = original.decoration.revision;
  await shuffle(page, revision + 1);
  await page.getByRole('button', { name: 'Undo shuffle', exact: true }).click();
  await settled(page);
  expect(await snapshot(page, 'Historical undo')).toEqual(original);
  expect(await png(page)).toEqual(exported);
});

test('export disables both history directions and recovers without losing history or drafts', async ({
  page,
}) => {
  await page.goto('/');
  await shuffle(page, 1);
  await shuffle(page, 2);
  const undo = page.getByRole('button', { name: 'Undo shuffle', exact: true });
  const redo = page.getByRole('button', { name: 'Redo shuffle', exact: true });
  await undo.click();
  await settled(page);
  await page.getByLabel('World seed').fill('keep-history-draft');
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      document.addEventListener(
        'fail-history-export',
        () => {
          HTMLCanvasElement.prototype.toBlob = original;
          callback(null);
        },
        { once: true },
      );
      document.documentElement.dataset['historyExportHeld'] = 'true';
    };
  });
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-history-export-held', 'true');
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  // Keyboard activation of aria-disabled controls must also be ignored while busy.
  await undo.focus();
  await page.keyboard.press('Enter');
  await redo.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#map-summary')).toContainText('r1');
  await page.locator('.details-section').screenshot({ path: 'artifacts/f13/disabled.png' });
  await page.evaluate(() => document.dispatchEvent(new Event('fail-history-export')));
  await expect(page.locator('#settings-error')).toContainText('could not create a PNG');
  await expect(undo).toBeEnabled();
  await expect(redo).toBeEnabled();
  await expect(page.getByLabel('World seed')).toHaveValue('keep-history-draft');
  await redo.click();
  await expect(page.locator('#map-summary')).toContainText('r2');
  await settled(page);
  await expect(page.locator('#settings-error')).toBeEmpty();
  await undo.click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  await settled(page);
  expect((await png(page)).name).toContain('-r1-');
  await expect(undo).toBeEnabled();
  await expect(redo).toBeEnabled();
});
