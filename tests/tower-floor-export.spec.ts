import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

async function tower(page: Page) {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Tower', exact: true }).check();
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
}
async function open(page: Page) {
  await page.getByRole('button', { name: 'Export options', exact: true }).click();
  return page.getByRole('dialog', { name: 'Export options', exact: true });
}
async function ready(dialog: Locator, name = 'Full map PNG preview', width = 2048) {
  const image = dialog.getByRole('img', { name, exact: true });
  await expect(image).toBeVisible();
  await expect(image).toHaveJSProperty('naturalWidth', width);
  await expect(dialog.getByRole('button', { name: 'Download PNG', exact: true })).toBeEnabled();
  const url = await image.getAttribute('src');
  if (!url) throw new Error('Missing preview');
  return url;
}
async function download(page: Page, button: Locator) {
  const pending = page.waitForEvent('download');
  await button.click();
  const file = await pending;
  const bytes = await readFile(await file.path());
  return {
    name: file.suggestedFilename(),
    bytes,
    size: [bytes.readUInt32BE(16), bytes.readUInt32BE(20)],
  };
}
async function pixelHash(
  page: Page,
  url: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  return page.evaluate(
    async ({ url, x, y, width, height }) => {
      const image = await createImageBitmap(await (await fetch(url)).blob());
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Missing context');
      ctx.drawImage(image, -x, -y);
      image.close();
      const pixels = ctx.getImageData(0, 0, width, height).data;
      const hash = await crypto.subtle.digest('SHA-256', pixels);
      return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join(
        '',
      );
    },
    { url, x, y, width, height },
  );
}

for (const style of ['spiral', 'separate'])
  test(`${style} floor exports match the sheet, preview and VTT size while retaining drafts and Quick export`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await tower(page);
    await page.getByLabel('Staircase style', { exact: true }).selectOption(style);
    if (style === 'separate') {
      await page.getByRole('button', { name: 'Generate tower', exact: true }).click();
      await expect(page.locator('#map-summary')).toContainText('Separate stairs');
      await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
    }
    const summary = await page.locator('#map-summary').textContent();
    await page.getByLabel('World seed').fill('pending-floor-export');
    const canvas = page.locator('forge-preview canvas');
    await canvas.focus();
    await page.keyboard.press('+');
    const viewport = await canvas.evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
    const quick = await download(
      page,
      page.getByRole('button', { name: 'Quick export PNG', exact: true }),
    );
    const dialog = await open(page);
    const scope = dialog.getByLabel('Tower floors', { exact: true });
    await expect(scope).toHaveValue('whole');
    const presets =
      style === 'spiral'
        ? ([
            ['standard', 64],
            ['owlbear', 64],
            ['roll20', 70],
            ['foundry', 100],
          ] as const)
        : ([['standard', 64]] as const);
    for (const [preset, scale] of presets) {
      await scope.selectOption('whole');
      await dialog.getByLabel('Export preset', { exact: true }).selectOption(preset);
      const fullUrl = await ready(dialog, 'Full map PNG preview', 32 * scale);
      const expectedPixels = await pixelHash(
        page,
        fullUrl,
        16 * scale,
        18 * scale,
        16 * scale,
        18 * scale,
      );
      await scope.selectOption('4');
      const url = await ready(dialog, 'Floor 4 PNG preview', 16 * scale);
      expect(await pixelHash(page, url, 0, 0, 16 * scale, 18 * scale)).toBe(expectedPixels);
      await expect(dialog.locator('#export-scale')).toContainText(
        `16 × 18 squares · ${scale} px/square`,
      );
      const previewHash = await page.evaluate(async (url) => {
        const bytes = await (await fetch(url)).arrayBuffer();
        const hash = await crypto.subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join(
          '',
        );
      }, url);
      const png = await download(
        page,
        dialog.getByRole('button', { name: 'Download PNG', exact: true }),
      );
      expect(png.size).toEqual([16 * scale, 18 * scale]);
      expect(png.name).toContain('-tower-floor-4-');
      expect(png.name).toContain(`16x18-${scale}px`);
      expect(png.name).not.toContain('pending-floor-export');
      expect(createHash('sha256').update(png.bytes).digest('hex')).toBe(previewHash);
      if (preset === 'standard')
        await dialog.screenshot({ path: `artifacts/tower-floor-export/${style}-desktop.png` });
    }
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Export options', exact: true })).toBeFocused();
    await expect(page.getByLabel('World seed')).toHaveValue('pending-floor-export');
    await expect(page.locator('#map-summary')).toHaveText(summary ?? '');
    expect(await canvas.evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL())).toBe(
      viewport,
    );
    const after = await download(
      page,
      page.getByRole('button', { name: 'Quick export PNG', exact: true }),
    );
    expect(after).toEqual(quick);
    await open(page);
    await expect(scope).toHaveValue('whole');
  });

test('secret floors require GM export visibility and disabling it discards the selected secret preview', async ({
  page,
}) => {
  await tower(page);
  await page.getByLabel('Secret portal', { exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Generate tower', exact: true }).click();
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
  const dialog = await open(page);
  const scope = dialog.getByLabel('Tower floors', { exact: true });
  await ready(dialog);
  await expect(scope.locator('option')).toHaveCount(4); // Whole tower and three regular floors.
  await expect(scope.locator('option').filter({ hasText: 'Secret floor' })).toHaveCount(0);
  await dialog.getByLabel('Show secrets', { exact: true }).check();
  const option = scope.locator('option').filter({ hasText: 'Secret floor' });
  const secret = await option.getAttribute('value');
  if (!secret) throw new Error('Missing secret floor');
  await scope.selectOption(secret);
  const secretUrl = await ready(dialog, `Floor ${secret} PNG preview`, 1024);
  const png = await download(
    page,
    dialog.getByRole('button', { name: 'Download PNG', exact: true }),
  );
  expect(png.name).toContain(`-tower-floor-${secret}-`);
  expect(png.name).toContain('-gm-secrets');
  await dialog.getByLabel('Show secrets', { exact: true }).uncheck();
  await expect(scope).toHaveValue('whole');
  await ready(dialog);
  const player = await download(
    page,
    dialog.getByRole('button', { name: 'Download PNG', exact: true }),
  );
  expect(player.name).toContain('-player');
  expect(player.name).not.toContain(`-tower-floor-${secret}-`);
  expect(player.size).toEqual([2048, 2304]);
  expect(
    await page.evaluate(async (url) => {
      try {
        return (await fetch(url)).ok;
      } catch {
        return false;
      }
    }, secretUrl),
  ).toBe(false);
  await expect(scope.locator('option').filter({ hasText: 'Secret floor' })).toHaveCount(0);
});

test('floor previews handle mobile keyboard selection, failures and obsolete jobs', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await tower(page);
  const dialog = await open(page);
  await ready(dialog);
  const scope = dialog.getByLabel('Tower floors', { exact: true });
  await scope.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(scope).toHaveValue('1');
  await ready(dialog, 'Floor 1 PNG preview', 1024);
  await expect(scope).toBeFocused();
  await dialog.screenshot({ path: 'artifacts/tower-floor-export/mobile.png' });
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      HTMLCanvasElement.prototype.toBlob = original;
      document.documentElement.dataset['floorHeld'] = 'true';
      document.addEventListener(
        'release-floor-preview',
        () => {
          original.call(
            this,
            (blob) => {
              callback(blob);
              document.documentElement.dataset['floorReleased'] = 'true';
            },
            type,
            quality,
          );
        },
        { once: true },
      );
    };
  });
  await scope.selectOption('4');
  await expect(page.locator('html')).toHaveAttribute('data-floor-held', 'true');
  await expect(dialog.getByRole('button', { name: 'Download PNG', exact: true })).toBeDisabled();
  await dialog.screenshot({ path: 'artifacts/tower-floor-export/loading.png' });
  await scope.selectOption('3');
  const latest = await ready(dialog, 'Floor 3 PNG preview', 1024);
  await page.evaluate(() => document.dispatchEvent(new Event('release-floor-preview')));
  await expect(page.locator('html')).toHaveAttribute('data-floor-released', 'true');
  expect(await ready(dialog, 'Floor 3 PNG preview', 1024)).toBe(latest);
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      HTMLCanvasElement.prototype.toBlob = original;
      callback(null);
    };
  });
  await scope.selectOption('2');
  await expect(
    dialog.getByRole('alert').filter({ hasText: 'could not create a PNG' }),
  ).toBeVisible();
  await expect(scope).toHaveValue('2');
  await expect(dialog.getByRole('button', { name: 'Download PNG', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Retry preview', exact: true }).click();
  await ready(dialog, 'Floor 2 PNG preview', 1024);
  await expect(dialog.getByRole('heading', { name: 'Export options', exact: true })).toBeFocused();
  await dialog.screenshot({ path: 'artifacts/tower-floor-export/recovered.png' });
  await dialog.locator('figure').scrollIntoViewIfNeeded();
  await dialog.screenshot({ path: 'artifacts/tower-floor-export/mobile-preview.png' });
});

for (const viewport of [
  { width: 768, height: 1024 },
  { width: 800, height: 420 },
])
  test(`floor selection and preview remain reachable at ${viewport.width} × ${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await tower(page);
    const dialog = await open(page);
    await dialog.getByLabel('Tower floors', { exact: true }).selectOption('4');
    await ready(dialog, 'Floor 4 PNG preview', 1024);
    await expect(
      dialog.getByRole('button', { name: 'Download PNG', exact: true }),
    ).toBeInViewport();
    await dialog.locator('figure').scrollIntoViewIfNeeded();
    const frame = dialog.locator('.image-frame');
    const image = dialog.getByRole('img', { name: 'Floor 4 PNG preview', exact: true });
    const frameSize = await frame.boundingBox(),
      imageSize = await image.boundingBox();
    expect(frameSize).not.toBeNull();
    expect(imageSize).not.toBeNull();
    if (!frameSize || !imageSize) throw new Error('Missing preview size');
    expect(Math.abs(frameSize.height - imageSize.height)).toBeLessThan(1);
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await dialog.screenshot({
      path: `artifacts/tower-floor-export/${viewport.width}x${viewport.height}.png`,
    });
  });
