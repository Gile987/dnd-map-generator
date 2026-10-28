import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

async function open(page: Page) {
  await page.getByRole('button', { name: 'Export options', exact: true }).click();
  return page.getByRole('dialog', { name: 'Export options', exact: true });
}

async function ready(dialog: Locator, width: number, height: number) {
  const image = dialog.getByRole('img', { name: 'Full map PNG preview' });
  await expect(image).toHaveJSProperty('naturalWidth', width);
  await expect(image).toHaveJSProperty('naturalHeight', height);
  await expect(dialog.locator('figcaption')).toContainText(`${width} × ${height} px`);
  return image;
}

async function download(page: Page, button: Locator) {
  const pending = page.waitForEvent('download');
  await button.click();
  const file = await pending;
  const path = await file.path();
  if (!path) throw new Error('Missing export');
  return { name: file.suggestedFilename(), bytes: await readFile(path) };
}

for (const type of ['Dungeon', 'Forest', 'Courtyard'] as const) {
  test(`${type} VTT presets download exactly their preview at the intended grid resolution`, async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('radio', { name: type, exact: true }).check();
    await expect(page.locator('#map-title')).toHaveText(
      { Dungeon: 'Stone Dungeon', Forest: 'Forest Clearing', Courtyard: 'Ruined Courtyard' }[type],
    );
    await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
    await page.getByLabel('World seed').fill('unapplied-preset-draft');
    const quickButton = page.getByRole('button', { name: 'Quick export PNG', exact: true });
    const quick = await download(page, quickButton);
    const summary = await page.locator('#map-summary').textContent();
    const dialog = await open(page);
    for (const [id, pixels] of [
      ['owlbear', 64],
      ['roll20', 70],
      ['foundry', 100],
    ] as const) {
      await dialog.getByRole('combobox', { name: 'Export preset' }).selectOption(id);
      await expect(dialog.getByRole('checkbox', { name: 'Include grid' })).not.toBeChecked();
      const image = await ready(dialog, 40 * pixels, 30 * pixels);
      const hash = await image.evaluate(async (el) => {
        const bytes = await (await fetch((el as HTMLImageElement).src)).arrayBuffer();
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, '0'),
        ).join('');
      });
      const result = await download(page, dialog.getByRole('button', { name: 'Download PNG' }));
      expect(createHash('sha256').update(result.bytes).digest('hex')).toBe(hash);
      expect([result.bytes.readUInt32BE(16), result.bytes.readUInt32BE(20)]).toEqual([
        40 * pixels,
        30 * pixels,
      ]);
      expect(result.name).toContain(`-${id}-40x30-${pixels}px-grid-off.png`);
      expect(result.name).not.toContain('unapplied-preset-draft');
      await expect(dialog.locator('#export-scale')).toContainText(`${pixels} px/square`);
      await expect(dialog.getByRole('link', { name: /setup guide/ })).toHaveAttribute(
        'target',
        '_blank',
      );
    }
    await dialog.getByRole('checkbox', { name: 'Include grid' }).check();
    await ready(dialog, 4000, 3000);
    expect(
      (await download(page, dialog.getByRole('button', { name: 'Download PNG' }))).name,
    ).toContain('-foundry-40x30-100px-grid-15pct.png');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Export options', exact: true })).toBeFocused();
    await expect(page.getByLabel('World seed')).toHaveValue('unapplied-preset-draft');
    await expect(page.locator('#map-summary')).toHaveText(summary ?? '');
    expect(await download(page, quickButton)).toEqual(quick);
    await open(page);
    await expect(dialog.getByRole('combobox')).toHaveValue('foundry');
    await expect(dialog.getByRole('checkbox')).toBeChecked();
  });
}

test('obsolete preset encodes cannot replace the selected image and failed previews retain choices', async ({
  page,
}) => {
  await page.goto('/');
  const dialog = await open(page);
  await ready(dialog, 2560, 1920);
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
      HTMLCanvasElement.prototype.toBlob = original;
      document.addEventListener(
        'release-preset',
        () =>
          original.call(
            this,
            (blob) => {
              callback(blob);
              document.documentElement.dataset['presetReleased'] = 'true';
            },
            ...args,
          ),
        {
          once: true,
        },
      );
      document.documentElement.dataset['presetHeld'] = 'true';
    };
  });
  const selector = dialog.getByRole('combobox');
  await selector.selectOption('foundry');
  await expect(page.locator('html')).toHaveAttribute('data-preset-held', 'true');
  await expect(dialog.getByRole('button', { name: 'Download PNG' })).toBeDisabled();
  await selector.selectOption('roll20');
  const image = await ready(dialog, 2800, 2100);
  const url = await image.getAttribute('src');
  await page.evaluate(() => document.dispatchEvent(new Event('release-preset')));
  await expect(page.locator('html')).toHaveAttribute('data-preset-released', 'true');
  await expect(image).toHaveAttribute('src', url ?? '');
  expect(
    (await download(page, dialog.getByRole('button', { name: 'Download PNG' }))).name,
  ).toContain('-roll20-40x30-70px-');
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      HTMLCanvasElement.prototype.toBlob = original;
      callback(null);
    };
  });
  await selector.selectOption('owlbear');
  await expect(dialog.getByRole('button', { name: 'Retry preview' })).toBeVisible();
  await expect(selector).toHaveValue('owlbear');
  await expect(dialog.getByRole('checkbox')).not.toBeChecked();
  await dialog.screenshot({ path: 'artifacts/vtt/preview-error.png' });
  await dialog.getByRole('button', { name: 'Retry preview' }).click();
  await ready(dialog, 2560, 1920);
  await page.keyboard.press('Escape');
  await page.getByRole('radio', { name: 'Forest', exact: true }).check();
  await expect(page.locator('#map-title')).toHaveText('Forest Clearing');
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
  await open(page);
  await expect(selector).toHaveValue('owlbear');
  await expect(dialog.getByRole('checkbox')).not.toBeChecked();
});

test('legacy forest artwork exports with the original bytes and its saved version', async ({
  page,
}) => {
  await page.goto('/');
  const fixture = await readFile('src/app/save/fixtures/forest-v3.json');
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
  await expect(page.locator('#map-title')).toHaveText('Forest Clearing');
  await page.getByRole('checkbox', { name: 'Grid', exact: true }).uncheck();
  const original = await download(
    page,
    page.getByRole('button', { name: 'Quick export PNG', exact: true }),
  );
  const dialog = await open(page);
  await dialog.getByRole('combobox').selectOption('owlbear');
  await ready(dialog, 2560, 1920);
  const exported = await download(page, dialog.getByRole('button', { name: 'Download PNG' }));
  expect(exported.bytes).toEqual(original.bytes);
  expect(exported.name).toContain('-v3.0.0-owlbear-40x30-64px-grid-off.png');
  await dialog.getByRole('combobox').selectOption('foundry');
  await ready(dialog, 4000, 3000);
});

for (const [width, height] of [
  [1440, 1000],
  [768, 1024],
  [320, 568],
  [800, 420],
] as const) {
  test(`preset guidance and modal keyboard controls fit at ${width} × ${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const dialog = await open(page);
    const selector = dialog.getByRole('combobox', { name: 'Export preset', exact: true });
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Close export options' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(selector).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(selector).toHaveValue('owlbear');
    await ready(dialog, 2560, 1920);
    await expect(selector).toHaveAccessibleDescription(/40 columns and 30 rows/);
    expect(await dialog.locator('.content').evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
      false,
    );
    await selector.focus();
    await dialog.screenshot({ path: `artifacts/vtt/preset-${width}-${height}.png` });
    await dialog.getByRole('checkbox').scrollIntoViewIfNeeded();
    await expect(dialog.getByRole('checkbox')).toBeInViewport();
    await dialog.getByRole('img').scrollIntoViewIfNeeded();
    await expect(dialog.getByRole('img')).toBeInViewport();
    await dialog.screenshot({ path: `artifacts/vtt/preview-${width}-${height}.png` });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Export options', exact: true })).toBeFocused();
    await page.reload();
    await open(page);
    await expect(selector).toHaveValue('standard');
  });
}
