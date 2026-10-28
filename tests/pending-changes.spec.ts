import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { setAddition } from './additions';
import { parseSavedMap, SAVE_STORAGE_KEY } from '../src/app/save/save-format';

const summary = (page: Page) => page.getByRole('region', { name: 'Pending changes', exact: true });

async function selectType(page: Page, type: 'Dungeon' | 'Forest' | 'Courtyard') {
  await page.getByRole('radio', { name: type, exact: true }).check();
  await expect(page.locator('#settings-title')).toHaveText(
    {
      Dungeon: 'Shape your dungeon',
      Forest: 'Shape your clearing',
      Courtyard: 'Shape your courtyard',
    }[type],
  );
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
}

async function png(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  const download = await pending;
  const path = await download.path();
  if (!path) throw new Error('Missing PNG');
  return { name: download.suggestedFilename(), bytes: await readFile(path) };
}

for (const type of ['Dungeon', 'Forest', 'Courtyard'] as const) {
  test(`${type} explains appearance and layout changes and clears them after applying or resetting`, async ({
    page,
  }) => {
    await page.goto('/');
    await selectType(page, type);
    const accepted = await page.locator('#map-summary').textContent();
    await expect(summary(page)).toBeHidden();
    await page.getByRole('radio', { name: 'Sparse', exact: true }).check();
    if (type === 'Dungeon') await page.getByRole('radio', { name: 'Crypt', exact: true }).check();
    else if (type === 'Forest')
      await page.getByRole('radio', { name: 'Fey glade', exact: true }).check();
    else await setAddition(page, 'Dry fountain');
    await expect(summary(page)).toContainText('Balanced');
    await expect(summary(page)).toContainText('Sparse');
    await expect(summary(page)).toContainText('Save and Export still use the displayed map.');
    const generate = page.getByRole('button', {
      name: `Generate ${type.toLowerCase()}`,
      exact: true,
    });
    await expect(generate).toHaveAccessibleDescription(
      'Generate updates appearance and keeps the layout.',
    );
    if (type === 'Dungeon') {
      await expect(summary(page)).toContainText('Mosslit stone');
      await expect(summary(page)).toContainText('Ancient crypt');
    } else if (type === 'Forest') {
      await expect(summary(page)).toContainText('Verdant woodland');
      await expect(summary(page)).toContainText('Fey glade');
    } else await expect(summary(page)).toContainText('Dry fountain');
    await expect(page.locator('#map-summary')).toHaveText(accepted ?? '');
    await generate.click();
    await expect(summary(page)).toBeHidden();
    await expect(page.locator('#map-summary')).toContainText('Sparse');
    await expect(generate).toBeDisabled();
    await page.getByLabel('World seed').fill(`${type.toLowerCase()}-new-layout`);
    await expect(generate).toHaveAccessibleDescription('Generate creates a new layout.');
    await expect(summary(page)).toContainText('World seed');
    await generate.click();
    await expect(page.locator('.seed-summary')).toHaveText(`${type.toLowerCase()}-new-layout`);
    await expect(summary(page)).toBeHidden();
    await page.getByRole('radio', { name: 'Balanced', exact: true }).check();
    await summary(page).getByRole('button', { name: 'Reset changes', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(summary(page)).toBeHidden();
    await expect(generate).toBeDisabled();
    await expect(page.getByRole('radio', { name: 'Sparse', exact: true })).toBeChecked();
  });
}

test('invalid and corrected drafts update the impact without losing field errors or the accepted map', async ({
  page,
}) => {
  await page.goto('/');
  const seed = page.getByLabel('World seed');
  const rooms = page.getByRole('spinbutton', { name: /^Rooms/ });
  const generate = page.getByRole('button', { name: 'Generate dungeon', exact: true });
  const accepted = await page.locator('#map-summary').textContent();
  await seed.fill('');
  await expect(summary(page)).toContainText('Not set');
  await expect(generate).toHaveAccessibleDescription('Correct the settings before generating.');
  await generate.click();
  await expect(seed).toHaveAttribute('aria-invalid', 'true');
  await expect(seed).toHaveAccessibleDescription(/Enter a seed between 1 and 64 characters/);
  await expect(page.locator('#map-summary')).toHaveText(accepted ?? '');
  await seed.fill('  mosslit-sanctum  ');
  await expect(summary(page)).toBeHidden();
  for (const raw of ['', '4.5', '9']) {
    await rooms.fill(raw);
    await expect(generate).toHaveAccessibleDescription('Correct the settings before generating.');
    await generate.click();
    await expect(rooms).toHaveAttribute('aria-invalid', 'true');
    await expect(rooms).toHaveAccessibleDescription(/Choose a whole number of rooms/);
    await expect(page.locator('#map-summary')).toHaveText(accepted ?? '');
  }
  await rooms.fill('8');
  await expect(generate).toHaveAccessibleDescription('Generate creates a new layout.');
  await expect(rooms).toHaveAttribute('aria-invalid', 'false');
  await rooms.fill('06');
  await expect(summary(page)).toBeHidden();
});

test('per-type summaries survive focus, save and export without applying their drafts', async ({
  page,
}) => {
  await page.goto('/');
  const before = await png(page);
  await page.getByRole('radio', { name: 'Crypt', exact: true }).check();
  await selectType(page, 'Forest');
  await page.getByLabel('World seed').fill('unapplied-forest-summary');
  await expect(summary(page)).toContainText('Generate creates a new layout.');
  await selectType(page, 'Dungeon');
  await expect(summary(page)).toContainText('Ancient crypt');
  await expect(summary(page)).not.toContainText('unapplied-forest-summary');
  await expect(summary(page)).toContainText('Generate updates appearance and keeps the layout.');
  await page.getByRole('button', { name: 'Focus map', exact: true }).click();
  await expect(summary(page)).toBeHidden();
  expect(await png(page)).toEqual(before);
  await page.getByRole('button', { name: 'Back to workbench', exact: true }).click();
  await expect(summary(page)).toContainText('Ancient crypt');
  await page.locator('#save-name').fill('Accepted summary snapshot');
  await page.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(page.locator('.library-message .notice')).toHaveText(
    'Saved “Accepted summary snapshot”.',
  );
  const raw: unknown = JSON.parse(
    await page.evaluate((key) => localStorage.getItem(key) ?? '[]', SAVE_STORAGE_KEY),
  );
  if (!Array.isArray(raw)) throw new Error('Missing saved library');
  const saved = raw.map(parseSavedMap).find((map) => map?.name === 'Accepted summary snapshot');
  expect(saved?.map.decoration).toMatchObject({ preset: 'Mosslit' });
  await expect(summary(page)).toContainText('Ancient crypt');
  await page.locator('.saved-item').getByRole('button', { name: 'Open', exact: true }).click();
  await expect(summary(page)).toBeHidden();
  await selectType(page, 'Forest');
  await expect(summary(page)).toContainText('unapplied-forest-summary');
});

for (const width of [320, 390, 768, 1440]) {
  test(`long values and all additions fit with keyboard reset at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await page.getByLabel('World seed').fill('x'.repeat(64));
    await page.getByRole('spinbutton', { name: /^Rooms/ }).fill('8');
    await page.getByRole('radio', { name: 'Crypt', exact: true }).check();
    for (const addition of ['Forgotten study', 'Weathered statue', 'Dining table'])
      await setAddition(page, addition);
    await page.getByRole('radio', { name: 'Cluttered', exact: true }).check();
    await expect(summary(page).locator('dt')).toHaveText([
      'World seed',
      'Rooms',
      'Character',
      'Additions',
      'Decoration',
    ]);
    const reset = summary(page).getByRole('button', { name: 'Reset changes', exact: true });
    await page.keyboard.press('Tab');
    await expect(reset).toBeFocused();
    expect(await reset.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    const bounds = await summary(page).boundingBox();
    if (!bounds) throw new Error('Missing pending summary');
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await summary(page).screenshot({ path: `artifacts/f21/pending-${width}.png` });
    if (width === 320 || width === 1440)
      await page
        .locator('aside[forge-settings-panel]')
        .screenshot({ path: `artifacts/f21/settings-${width}.png` });
    await page.keyboard.press('Enter');
    await expect(summary(page)).toBeHidden();
  });
}

test('pending changes stay readable and reset is disabled while exporting, then recover after failure', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  await page.getByRole('radio', { name: 'Crypt', exact: true }).check();
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      HTMLCanvasElement.prototype.toBlob = original;
      document.addEventListener('fail-pending-export', () => callback(null), { once: true });
      document.documentElement.dataset['pendingExportHeld'] = 'true';
    };
  });
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-pending-export-held', 'true');
  const reset = summary(page).getByRole('button', { name: 'Reset changes', exact: true });
  await expect(reset).toBeDisabled();
  await expect(summary(page)).toContainText('Ancient crypt');
  await summary(page).screenshot({ path: 'artifacts/f21/pending-disabled.png' });
  await page.evaluate(() => document.dispatchEvent(new Event('fail-pending-export')));
  await expect(page.locator('#settings-error')).toContainText('could not create a PNG');
  await expect(reset).toBeEnabled();
  await expect(summary(page)).toContainText('Ancient crypt');
  await reset.click();
  await expect(summary(page)).toBeHidden();
});
