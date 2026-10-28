import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const focusButton = (page: Page) => page.getByRole('button', { name: 'Focus map', exact: true });
const backButton = (page: Page) =>
  page.getByRole('button', { name: 'Back to workbench', exact: true });

async function pixels(page: Page) {
  const data = await page.locator('canvas').evaluate((el) => (el as HTMLCanvasElement).toDataURL());
  return createHash('sha256').update(data).digest('hex');
}

async function enter(page: Page) {
  await focusButton(page).click();
  await expect(backButton(page)).toBeFocused();
  await expect(page.locator('app-root')).toHaveClass('map-focused');
}

async function png(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  const download = await pending;
  const path = await download.path();
  if (!path) throw new Error('Missing PNG download');
  return { name: download.suggestedFilename(), bytes: await readFile(path) };
}

for (const type of ['Dungeon', 'Forest', 'Courtyard'] as const) {
  test(`${type} focus preserves the canvas, accepted exports, drafts, and library inputs`, async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('radio', { name: type, exact: true }).check();
    await expect(page.locator('#map-title')).toHaveText(
      { Dungeon: 'Stone Dungeon', Forest: 'Forest Clearing', Courtyard: 'Ruined Courtyard' }[type],
    );
    await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
    await page.getByLabel('World seed').fill('pending-focus-draft');
    await page.locator('#save-name').fill('Unfinished save');
    await page.getByRole('searchbox', { name: 'Search saved maps' }).fill('Retained search');
    await page.getByRole('combobox', { name: 'Sort by' }).selectOption('name');
    const summary = await page.locator('#map-summary').textContent();
    const before = await png(page);
    const canvas = page.locator('canvas');
    const original = await canvas.elementHandle();
    await canvas.focus();
    await page.keyboard.press('+');
    await page.keyboard.press('ArrowLeft');
    const beforePixels = await pixels(page);
    await enter(page);
    await expect(page.getByLabel('Zoom level')).toHaveText('125%');
    expect(await canvas.evaluate((el, previous) => el === previous, original)).toBe(true);
    await expect(page.locator('aside[forge-settings-panel]')).toBeHidden();
    await expect(page.locator('forge-library')).toBeHidden();
    expect(await png(page)).toEqual(before);
    await backButton(page).click();
    await expect(focusButton(page)).toBeFocused();
    await expect.poll(() => pixels(page)).toBe(beforePixels);
    await expect(page.locator('#map-summary')).toHaveText(summary ?? '');
    await expect(page.getByLabel('World seed')).toHaveValue('pending-focus-draft');
    await expect(page.locator('#save-name')).toHaveValue('Unfinished save');
    await expect(page.getByRole('searchbox', { name: 'Search saved maps' })).toHaveValue(
      'Retained search',
    );
    await expect(page.getByRole('combobox', { name: 'Sort by' })).toHaveValue('name');
    await expect(page.getByRole('region', { name: 'Pending changes', exact: true })).toBeVisible();
  });
}

test('focus resizing preserves a pan at the viewport boundary', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const canvas = page.locator('canvas');
  await canvas.focus();
  for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowLeft');
  const size = await canvas.evaluate((el) => [
    (el as HTMLCanvasElement).width,
    (el as HTMLCanvasElement).height,
  ]);
  const beforePixels = await pixels(page);
  await enter(page);
  await page.keyboard.press('Escape');
  await expect(focusButton(page)).toBeFocused();
  await expect
    .poll(() =>
      canvas.evaluate((el) => [(el as HTMLCanvasElement).width, (el as HTMLCanvasElement).height]),
    )
    .toEqual(size);
  expect(await pixels(page)).toBe(beforePixels);
  await canvas.focus();
  await page.keyboard.press('ArrowRight');
  expect(await pixels(page)).not.toBe(beforePixels);
});

for (const [width, height] of [
  [1440, 900],
  [768, 1024],
  [390, 844],
  [320, 568],
  [800, 420],
] as const) {
  test(`focus layout and keyboard controls fit at ${width} × ${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await focusButton(page).focus();
    const scroll = await page.evaluate(() => scrollY);
    await page.keyboard.press('Enter');
    await expect(backButton(page)).toBeFocused();
    await expect(backButton(page)).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('navigation', { name: 'Workbench sections' })).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    for (const name of [
      'Back to workbench',
      'Fit',
      'Zoom in',
      'Zoom out',
      'Quick export PNG',
      'Export options',
    ]) {
      const bounds = await page.getByRole('button', { name, exact: true }).boundingBox();
      if (!bounds) throw new Error(`Missing ${name}`);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    }
    const bounds = await page.locator('canvas').boundingBox();
    if (!bounds) throw new Error('Missing canvas');
    expect(bounds.height).toBeGreaterThanOrEqual(180);
    if (height >= 568) expect(bounds.y + bounds.height).toBeLessThan(height);
    await page.screenshot({ path: `artifacts/f22/focus-${width}-${height}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect(page.getByLabel('Zoom level')).toHaveText('125%');
    await page.getByRole('button', { name: 'Fit', exact: true }).click();
    await expect(page.getByLabel('Zoom level')).toHaveText('100%');
    await page.getByRole('checkbox', { name: 'Grid', exact: true }).uncheck();
    await page.locator('canvas').focus();
    await page.keyboard.press('Escape');
    await expect(focusButton(page)).toBeFocused();
    await expect(focusButton(page)).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('checkbox', { name: 'Grid', exact: true })).not.toBeChecked();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(scroll);
  });
}

test('Escape closes export options before leaving focus and restores the dialog opener', async ({
  page,
}) => {
  await page.goto('/');
  await enter(page);
  const options = page.getByRole('button', { name: 'Export options', exact: true });
  await options.click();
  const dialog = page.getByRole('dialog', { name: 'Export options', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('img', { name: 'Full map PNG preview' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(options).toBeFocused();
  await expect(backButton(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(focusButton(page)).toBeFocused();
});

test('return remains available during export and failures stay visible and recoverable', async ({
  page,
}) => {
  await page.goto('/');
  await enter(page);
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      HTMLCanvasElement.prototype.toBlob = original;
      document.addEventListener('fail-focus-export', () => callback(null), { once: true });
      document.documentElement.dataset['focusExportHeld'] = 'true';
    };
  });
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-focus-export-held', 'true');
  await expect(page.getByRole('checkbox', { name: 'Grid', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Export options', exact: true })).toBeDisabled();
  await page.screenshot({ path: 'artifacts/f22/export-disabled.png' });
  await backButton(page).click();
  await expect(focusButton(page)).toBeFocused();
  await enter(page);
  await page.evaluate(() => document.dispatchEvent(new Event('fail-focus-export')));
  await expect(page.locator('#settings-error')).toContainText('could not create a PNG');
  await expect(page.getByRole('button', { name: 'Quick export PNG', exact: true })).toBeEnabled();
  await page.screenshot({ path: 'artifacts/f22/export-error.png' });
  await png(page);
  await expect(page.locator('#settings-error')).toBeEmpty();
});
