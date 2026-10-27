import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { SAVE_STORAGE_KEY } from '../src/app/save/save-format';

const navigation = (page: Page) => page.getByRole('navigation', { name: 'Workbench sections' });
const link = (page: Page, name: string) => navigation(page).getByRole('link', { name });

async function jump(page: Page, name: 'Settings' | 'Map' | 'Library', keyboard = false) {
  const shortcut = link(page, name);
  if (keyboard) {
    await shortcut.focus();
    await page.keyboard.press('Enter');
  } else {
    await shortcut.click();
  }
  const target = page.locator(`#${name.toLowerCase()}-title`);
  await expect(target).toBeFocused();
  await expect(target).toBeInViewport();
  const bar = await navigation(page).boundingBox();
  const heading = await target.boundingBox();
  if (!bar || !heading) throw new Error('Missing navigation or section heading');
  expect(heading.y).toBeGreaterThanOrEqual(bar.y + bar.height + 4);
  await expect(page).toHaveURL(new RegExp(`#${name.toLowerCase()}-title$`));
}

for (const [width, height] of [
  [320, 568],
  [390, 844],
  [768, 1024],
  [800, 420],
] as const) {
  test(`section shortcuts fit and reveal their headings at ${width} × ${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(navigation(page)).toBeVisible();
    for (const shortcut of await navigation(page).getByRole('link').all()) {
      const bounds = await shortcut.boundingBox();
      if (!bounds) throw new Error('Missing shortcut');
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.width).toBeGreaterThanOrEqual(44);
    }
    for (const name of ['Map', 'Library', 'Settings', 'Map'] as const) {
      await jump(page, name);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
    }
    await page.screenshot({ path: `artifacts/f19/map-${width}-${height}.png` });
    await jump(page, 'Library');
    await page.screenshot({ path: `artifacts/f19/library-${width}-${height}.png` });
  });
}

test('keyboard jumps focus headings, continue into controls, and respect the additions modal', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await jump(page, 'Map', true);
  expect(await page.locator('#map-title').evaluate((el) => el.matches(':focus-visible'))).toBe(
    true,
  );
  await page.screenshot({ path: 'artifacts/f19/map-keyboard.png' });
  await page.keyboard.press('Tab');
  await expect(page.getByRole('checkbox', { name: 'Grid', exact: true })).toBeFocused();
  await jump(page, 'Library', true);
  await page.keyboard.press('Tab');
  await expect(page.locator('#save-name')).toBeFocused();
  await jump(page, 'Settings', true);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('radio', { name: 'Dungeon', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Choose additions', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Choose additions', exact: true });
  await expect(
    picker.getByRole('heading', { name: 'Choose additions', exact: true }),
  ).toBeFocused();
  await link(page, 'Map').focus();
  await expect(
    picker.getByRole('heading', { name: 'Choose additions', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Choose additions', exact: true })).toBeFocused();
  await jump(page, 'Map', true);
  await jump(page, 'Library', true);
  await page.goBack();
  await expect(page).toHaveURL(/#map-title$/);
  await expect(page.locator('#map-title')).toBeInViewport();
  await page.goForward();
  await expect(page).toHaveURL(/#library-title$/);
  await expect(page.locator('#library-title')).toBeInViewport();
  await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'auto');
});

test('section jumps preserve the canvas, viewport, library view, and unfinished inputs', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/');
  await jump(page, 'Library');
  await page.locator('#save-name').fill('Mobile vault');
  await page.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(page.locator('.library-message .notice')).toHaveText('Saved “Mobile vault”.');
  await page.getByRole('button', { name: 'Mark as favorite', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove from favorites' })).toBeVisible();
  const stored = await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY);
  await page.getByRole('searchbox', { name: 'Search saved maps' }).fill('Mobile');
  await page.getByRole('combobox', { name: 'Map type', exact: true }).selectOption('dungeon');
  await page.getByRole('combobox', { name: 'Sort by' }).selectOption('name');
  await page.getByRole('checkbox', { name: 'Favorites only' }).check();
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.getByRole('textbox', { name: 'Rename map', exact: true }).fill('Unfinished rename');
  await page.locator('#save-name').fill('Unfinished save');
  await jump(page, 'Settings');
  await page.getByLabel('World seed').fill('unapplied-mobile-draft');
  await expect(link(page, 'Settings')).toHaveAccessibleName('Settings — changes pending');
  await jump(page, 'Map');
  const canvas = page.locator('canvas');
  const originalCanvas = await canvas.elementHandle();
  if (!originalCanvas) throw new Error('Missing canvas');
  const fitted = await canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL());
  await canvas.focus();
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByLabel('Zoom level')).toHaveText('156%');
  const pixels = await canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL());
  expect(pixels).not.toBe(fitted);
  const summary = await page.locator('#map-summary').textContent();
  for (const name of ['Library', 'Settings', 'Map', 'Map'] as const) await jump(page, name);
  expect(await canvas.evaluate((el, original) => el === original, originalCanvas)).toBe(true);
  expect(await canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL())).toBe(pixels);
  await expect(page.getByLabel('Zoom level')).toHaveText('156%');
  await expect(page.locator('#map-summary')).toHaveText(summary ?? '');
  await expect(page.getByLabel('World seed')).toHaveValue('unapplied-mobile-draft');
  await jump(page, 'Library');
  await expect(page.getByRole('searchbox', { name: 'Search saved maps' })).toHaveValue('Mobile');
  await expect(page.getByRole('combobox', { name: 'Map type', exact: true })).toHaveValue(
    'dungeon',
  );
  await expect(page.getByRole('combobox', { name: 'Sort by' })).toHaveValue('name');
  await expect(page.getByRole('checkbox', { name: 'Favorites only' })).toBeChecked();
  await expect(page.getByRole('textbox', { name: 'Rename map', exact: true })).toHaveValue(
    'Unfinished rename',
  );
  await expect(page.locator('#save-name')).toHaveValue('Unfinished save');
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)).toBe(stored);
  await page.screenshot({ path: 'artifacts/f19/library-pending.png' });
});

test('the settings indicator follows independent drafts, resets, and accepted generation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  for (const type of ['Dungeon', 'Forest', 'Courtyard'] as const) {
    await jump(page, 'Settings');
    await page.getByRole('radio', { name: type, exact: true }).check();
    await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
    await expect(link(page, 'Settings')).toHaveAccessibleName('Settings');
    const accepted = await page.locator('#map-summary').textContent();
    await page.getByLabel('World seed').fill(`${type.toLowerCase()}-mobile-draft`);
    await jump(page, 'Map');
    await expect(link(page, 'Settings')).toHaveAccessibleName('Settings — changes pending');
    await expect(page.locator('#map-summary')).toHaveText(accepted ?? '');
  }
  for (const type of ['Dungeon', 'Forest', 'Courtyard'] as const) {
    await jump(page, 'Settings');
    await page.getByRole('radio', { name: type, exact: true }).check();
    await expect(page.getByLabel('World seed')).toHaveValue(`${type.toLowerCase()}-mobile-draft`);
    await expect(link(page, 'Settings')).toHaveAccessibleName('Settings — changes pending');
    if (type === 'Forest') {
      await page.getByRole('button', { name: 'Generate forest', exact: true }).click();
      await expect(page.locator('.seed-summary')).toHaveText('forest-mobile-draft');
    } else {
      await page.getByRole('button', { name: 'Reset changes', exact: true }).click();
    }
    await expect(link(page, 'Settings')).toHaveAccessibleName('Settings');
  }
});

test('navigation remains usable during export and keeps errors and recovery reachable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.getByLabel('World seed').fill('pending-during-export');
  await page.getByRole('searchbox', { name: 'Search saved maps' }).fill('retained-search');
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      document.addEventListener(
        'fail-mobile-export',
        () => {
          HTMLCanvasElement.prototype.toBlob = original;
          callback(null);
        },
        { once: true },
      );
      document.documentElement.dataset['mobileExportHeld'] = 'true';
    };
  });
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-mobile-export-held', 'true');
  await expect(page.getByLabel('World seed')).toBeDisabled();
  await expect(page.getByRole('searchbox', { name: 'Search saved maps' })).toBeDisabled();
  for (const name of ['Map', 'Settings', 'Library'] as const) await jump(page, name, true);
  await page.screenshot({ path: 'artifacts/f19/library-disabled.png' });
  await page.evaluate(() => document.dispatchEvent(new Event('fail-mobile-export')));
  const error = page.locator('#settings-error');
  await expect(error).toContainText('could not create a PNG');
  await error.scrollIntoViewIfNeeded();
  await expect(error).toBeInViewport({ ratio: 1 });
  const bar = await navigation(page).boundingBox();
  const bounds = await error.boundingBox();
  if (!bar || !bounds) throw new Error('Missing error or navigation');
  expect(bounds.y).toBeGreaterThanOrEqual(bar.y + bar.height);
  await page.screenshot({ path: 'artifacts/f19/export-error.png' });
  await jump(page, 'Settings');
  await expect(page.getByLabel('World seed')).toHaveValue('pending-during-export');
  await expect(page.getByLabel('World seed')).toBeEnabled();
  await jump(page, 'Library');
  await expect(page.getByRole('searchbox', { name: 'Search saved maps' })).toHaveValue(
    'retained-search',
  );
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  expect((await download).suggestedFilename()).not.toContain('pending-during-export');
  await expect(error).toBeEmpty();
  await jump(page, 'Map');
});

test('desktop hides shortcuts and resizing retains the map and pending draft', async ({ page }) => {
  await page.goto('/');
  for (const width of [1440, 1024, 801]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(navigation(page)).toBeHidden();
  }
  const summary = await page.locator('#map-summary').textContent();
  await page.getByLabel('World seed').fill('resize-draft');
  await page.setViewportSize({ width: 800, height: 420 });
  await jump(page, 'Map');
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(navigation(page)).toBeHidden();
  await expect(page.getByLabel('World seed')).toHaveValue('resize-draft');
  await expect(page.locator('#map-summary')).toHaveText(summary ?? '');
  await page.setViewportSize({ width: 390, height: 844 });
  await jump(page, 'Settings');
  await expect(link(page, 'Settings')).toHaveAccessibleName('Settings — changes pending');
});
