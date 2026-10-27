import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

async function openOptions(page: Page) {
  await page.getByRole('button', { name: 'Export options', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export options', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function preview(dialog: Locator): Promise<string> {
  const image = dialog.getByRole('img', { name: 'Full map PNG preview' });
  await expect(image).toBeVisible();
  await expect(image).toHaveJSProperty('naturalWidth', 2560);
  const src = await image.getAttribute('src');
  if (!src) throw new Error('Missing preview URL');
  return src;
}

async function download(page: Page, button: Locator) {
  const pending = page.waitForEvent('download');
  await button.click();
  const result = await pending;
  const path = await result.path();
  if (!path) throw new Error('Missing download');
  const bytes = await readFile(path);
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([2560, 1920]);
  return { bytes, name: result.suggestedFilename() };
}

async function setOpacity(dialog: Locator, value: number) {
  const image = dialog.getByRole('img', { name: 'Full map PNG preview' });
  const previous = await image.getAttribute('src');
  await dialog.getByRole('slider', { name: /Grid opacity/ }).fill(String(value));
  if (previous) await expect(image).not.toHaveAttribute('src', previous);
  await preview(dialog);
}

for (const type of ['Dungeon', 'Forest', 'Courtyard'] as const) {
  test(`${type} exports exactly the preview while retaining drafts and the workbench viewport`, async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('radio', { name: type, exact: true }).check();
    await expect(page.locator('#settings-title')).toHaveText(
      {
        Dungeon: 'Shape your dungeon',
        Forest: 'Shape your clearing',
        Courtyard: 'Shape your courtyard',
      }[type],
    );
    await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
    const summary = await page.locator('#map-summary').textContent();
    await page.getByLabel('World seed').fill('unapplied-export-draft');
    const grid = page.getByRole('checkbox', { name: 'Grid', exact: true });
    await grid.uncheck();
    const canvas = page.locator('canvas');
    await canvas.focus();
    await page.keyboard.press('+');
    await page.keyboard.press('ArrowRight');
    const viewport = await canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL());
    const quick = await download(
      page,
      page.getByRole('button', { name: 'Quick export PNG', exact: true }),
    );
    const dialog = await openOptions(page);
    const initialUrl = await preview(dialog);
    await expect(dialog.getByRole('checkbox', { name: 'Include grid' })).toBeChecked();
    await expect(dialog.getByRole('slider')).toHaveValue('15');
    const hash = await page.evaluate(async (url) => {
      const bytes = await (await fetch(url)).arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
        '',
      );
    }, initialUrl);
    const configured = await download(page, dialog.getByRole('button', { name: 'Download PNG' }));
    expect(createHash('sha256').update(configured.bytes).digest('hex')).toBe(hash);
    expect(configured.name).toBe(quick.name.replace('.png', '-grid-15pct.png'));
    expect(configured.name).not.toContain('unapplied-export-draft');
    await setOpacity(dialog, 100);
    const opaque = await download(page, dialog.getByRole('button', { name: 'Download PNG' }));
    expect(opaque.bytes).not.toEqual(configured.bytes);
    await setOpacity(dialog, 0);
    const transparent = await download(page, dialog.getByRole('button', { name: 'Download PNG' }));
    expect(transparent.bytes).toEqual(quick.bytes);
    await dialog.getByRole('checkbox', { name: 'Include grid' }).uncheck();
    await preview(dialog);
    await expect(dialog.getByRole('slider')).toBeDisabled();
    const withoutGrid = await download(page, dialog.getByRole('button', { name: 'Download PNG' }));
    expect(withoutGrid.bytes).toEqual(quick.bytes);
    expect(withoutGrid.name).toContain('-grid-off.png');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Export options', exact: true })).toBeFocused();
    await expect(grid).not.toBeChecked();
    await expect(page.getByLabel('World seed')).toHaveValue('unapplied-export-draft');
    await expect(page.locator('#map-summary')).toHaveText(summary ?? '');
    expect(await canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL())).toBe(viewport);
    await openOptions(page);
    await preview(dialog);
    await expect(dialog.getByRole('checkbox', { name: 'Include grid' })).not.toBeChecked();
    await expect(dialog.getByRole('slider')).toHaveValue('0');
    await dialog.getByRole('button', { name: 'Done', exact: true }).click();
    const unchanged = await download(
      page,
      page.getByRole('button', { name: 'Quick export PNG', exact: true }),
    );
    expect(unchanged).toEqual(quick);
  });
}

test('native modal focus, keyboard opacity, and Escape leave the workbench intact', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/');
  const opener = page.getByRole('button', { name: 'Export options', exact: true });
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Export options', exact: true });
  await preview(dialog);
  await expect(dialog.getByRole('heading', { name: 'Export options' })).toBeFocused();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close export options' })).toBeFocused();
  await page.getByRole('navigation').getByRole('link', { name: 'Map', exact: true }).focus();
  await expect(dialog.getByRole('button', { name: 'Close export options' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('checkbox')).toBeFocused();
  await page.keyboard.press('Tab');
  const slider = dialog.getByRole('slider');
  await expect(slider).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue('16');
  await preview(dialog);
  await dialog.screenshot({ path: 'artifacts/f18/keyboard.png' });
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
  await expect(page.locator('body')).toHaveCSS('overflow', 'visible');
});

test('a failed preview keeps its choices and retries with a useful focus destination', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      HTMLCanvasElement.prototype.toBlob = original;
      callback(null);
    };
  });
  const dialog = await openOptions(page);
  await expect(
    dialog.getByRole('alert').filter({ hasText: 'could not create a PNG' }),
  ).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Download PNG' })).toBeDisabled();
  await dialog.screenshot({ path: 'artifacts/f18/preview-error.png' });
  await dialog.getByRole('button', { name: 'Retry preview' }).click();
  await expect(dialog.getByRole('heading', { name: 'Export options' })).toBeFocused();
  await preview(dialog);
  await expect(dialog.getByRole('slider')).toHaveValue('15');
  await expect(dialog.getByRole('button', { name: 'Download PNG' })).toBeEnabled();
});

test('a download failure keeps the prepared PNG available for retry', async ({ page }) => {
  await page.goto('/');
  const dialog = await openOptions(page);
  const url = await preview(dialog);
  await page.evaluate(() => {
    const original = URL.createObjectURL;
    URL.createObjectURL = () => {
      URL.createObjectURL = original;
      throw new Error('Download blocked for this check. Please try again.');
    };
  });
  const button = dialog.getByRole('button', { name: 'Download PNG' });
  await button.click();
  await expect(dialog.getByRole('alert').filter({ hasText: 'Download blocked' })).toBeVisible();
  expect(await preview(dialog)).toBe(url);
  await expect(button).toBeEnabled();
  await dialog.screenshot({ path: 'artifacts/f18/download-error.png' });
  await download(page, button);
  await expect(dialog.locator('.feedback [role="status"]')).toHaveText(
    'PNG ready. Check your downloads.',
  );
  await expect(dialog.locator('.error')).toBeEmpty();
});

test('obsolete preview jobs cannot replace newer choices and their URLs are released on close', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    let first = true;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      if (!first) {
        original.call(this, callback, type, quality);
        return;
      }
      first = false;
      document.addEventListener(
        'release-old-preview',
        () => {
          HTMLCanvasElement.prototype.toBlob = original;
          original.call(
            this,
            (blob) => {
              callback(blob);
              document.documentElement.dataset['oldPreviewDone'] = 'true';
            },
            type,
            quality,
          );
        },
        { once: true },
      );
      document.documentElement.dataset['previewHeld'] = 'true';
    };
  });
  const dialog = await openOptions(page);
  await expect(page.locator('html')).toHaveAttribute('data-preview-held', 'true');
  await expect(dialog.getByRole('button', { name: 'Download PNG' })).toBeDisabled();
  await dialog.getByRole('slider').fill('60');
  const url = await preview(dialog);
  await page.evaluate(() => document.dispatchEvent(new Event('release-old-preview')));
  await expect(page.locator('html')).toHaveAttribute('data-old-preview-done', 'true');
  expect(await preview(dialog)).toBe(url);
  await expect(dialog.getByRole('slider')).toHaveValue('60');
  await page.keyboard.press('Escape');
  await expect
    .poll(() =>
      page.evaluate(async (src) => {
        try {
          return (await fetch(src)).ok;
        } catch {
          return false;
        }
      }, url),
    )
    .toBe(false);
  await openOptions(page);
  const next = await preview(dialog);
  expect(next).not.toBe(url);
  await expect(dialog.getByRole('slider')).toHaveValue('60');
});

test('closing a pending preview and opening another map ignores the old result', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => {
    const create = URL.createObjectURL;
    let count = 0;
    URL.createObjectURL = (blob) => {
      document.documentElement.dataset['previewUrls'] = String(++count);
      return create(blob);
    };
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      HTMLCanvasElement.prototype.toBlob = original;
      document.addEventListener(
        'release-closed-preview',
        () => {
          original.call(
            this,
            (blob) => {
              callback(blob);
              document.documentElement.dataset['closedPreviewDone'] = 'true';
            },
            type,
            quality,
          );
        },
        { once: true },
      );
      document.documentElement.dataset['closedPreviewHeld'] = 'true';
    };
  });
  const dialog = await openOptions(page);
  await expect(page.locator('html')).toHaveAttribute('data-closed-preview-held', 'true');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.getByRole('radio', { name: 'Forest', exact: true }).check();
  await expect(page.locator('#settings-title')).toHaveText('Shape your clearing');
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
  await openOptions(page);
  const current = await preview(dialog);
  await expect(dialog.locator('.map-source strong')).toHaveText('Forest');
  await page.evaluate(() => document.dispatchEvent(new Event('release-closed-preview')));
  await expect(page.locator('html')).toHaveAttribute('data-closed-preview-done', 'true');
  expect(await preview(dialog)).toBe(current);
  await expect(page.locator('html')).toHaveAttribute('data-preview-urls', '1');
});

test('quick export disables options and its failure can recover through the dialog', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      HTMLCanvasElement.prototype.toBlob = original;
      document.addEventListener(
        'fail-quick-export',
        () => {
          callback(null);
        },
        { once: true },
      );
      document.documentElement.dataset['quickExportHeld'] = 'true';
    };
  });
  const quickExport = page.getByRole('button', { name: 'Quick export PNG', exact: true });
  await page.keyboard.press('Tab');
  await quickExport.focus();
  await page.locator('.export-action').screenshot({ path: 'artifacts/f18/quick-export-focus.png' });
  await quickExport.click();
  await expect(page.locator('html')).toHaveAttribute('data-quick-export-held', 'true');
  await page
    .locator('.export-action')
    .screenshot({ path: 'artifacts/f18/quick-export-disabled.png' });
  await expect(page.getByRole('button', { name: 'Export options', exact: true })).toBeDisabled();
  await page.evaluate(() => document.dispatchEvent(new Event('fail-quick-export')));
  await expect(page.locator('#settings-error')).toContainText('could not create a PNG');
  const dialog = await openOptions(page);
  await preview(dialog);
  await download(page, dialog.getByRole('button', { name: 'Download PNG' }));
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('#settings-error')).toBeEmpty();
  await expect(page.locator('.status')).toContainText('PNG is ready');
});

for (const [width, height] of [
  [1440, 1100],
  [768, 1024],
  [390, 844],
  [320, 568],
  [800, 420],
] as const) {
  test(`export controls and modal fit at ${width} × ${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.locator('.export-row').screenshot({ path: `artifacts/f18/actions-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    const dialog = await openOptions(page);
    await preview(dialog);
    const bounds = await dialog.boundingBox();
    if (!bounds) throw new Error('Missing dialog');
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
    for (const button of await dialog.getByRole('button').all()) {
      await expect(button).toBeInViewport({ ratio: 1 });
      const rect = await button.boundingBox();
      if (!rect) throw new Error('Missing button');
      expect(rect.height).toBeGreaterThanOrEqual(44);
    }
    expect(await dialog.locator('.content').evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
      false,
    );
    await dialog.screenshot({ path: `artifacts/f18/options-${width}-${height}.png` });
  });
}
