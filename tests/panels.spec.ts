import { expect, test } from '@playwright/test';

test('map additions share one keyboard-accessible list with independent drafts for each map type', async ({
  page,
}) => {
  await page.goto('/');
  const settings = page.getByRole('complementary', { name: 'Map settings' });
  const additions = settings.getByRole('group', { name: 'Add to this map', exact: true });
  await expect(additions).toHaveCount(1);
  await expect(additions).toHaveAccessibleDescription('Choose any combination. Generate to apply.');
  const study = additions.getByRole('checkbox', { name: 'Forgotten study', exact: true });
  const statue = additions.getByRole('checkbox', { name: 'Weathered statue', exact: true });
  const table = additions.getByRole('checkbox', { name: 'Dining table', exact: true });
  await expect(additions.getByRole('checkbox')).toHaveCount(3);
  await expect(study).toHaveAccessibleDescription(/desk, bookshelves, scroll cases, and a rug/);
  await expect(statue).toHaveAccessibleDescription(/stone figure on a plinth/);
  await expect(table).toHaveAccessibleDescription(/blocks two tiles/);
  const summary = await page.locator('#map-summary').textContent();
  await settings.getByRole('radio', { name: 'Mosslit', exact: true }).focus();
  for (const option of [study, statue, table]) {
    await expect(option).not.toBeChecked();
    await page.keyboard.press('Tab');
    await expect(option).toBeFocused();
    expect(await option.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
    await page.keyboard.press('Space');
    await expect(option).toBeChecked();
  }
  await additions.screenshot({ path: 'artifacts/additions/keyboard.png' });
  await expect(page.locator('#map-summary')).toHaveText(summary ?? '');
  await settings.getByRole('radio', { name: 'Forest', exact: true }).check();
  const camp = additions.getByRole('checkbox', { name: 'Abandoned camp', exact: true });
  const circle = additions.getByRole('checkbox', { name: 'Standing-stone circle', exact: true });
  await expect(additions.getByRole('checkbox')).toHaveCount(2);
  await expect(camp).toHaveAccessibleDescription(/tents, bedrolls, a cold fire ring/);
  await expect(circle).toHaveAccessibleDescription(/Six standing stones/);
  await expect(page.getByRole('button', { name: 'Generate forest' })).toBeDisabled();
  // Clicking the description activates its checkbox, just like clicking the title.
  await additions.getByText(/Two tents, bedrolls/).click();
  await circle.check();
  await expect(camp).toBeChecked();
  await settings.getByRole('radio', { name: 'Dungeon', exact: true }).check();
  for (const option of [study, statue, table]) await expect(option).toBeChecked();
  // Unchecking every addition returns to the accepted base map without generating.
  for (const option of [study, statue, table]) await option.uncheck();
  await expect(page.getByRole('button', { name: 'Generate dungeon' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Reset changes' })).toHaveCount(0);
  await settings.getByRole('radio', { name: 'Forest', exact: true }).check();
  for (const option of [camp, circle]) await expect(option).toBeChecked();
  await page.getByRole('button', { name: 'Reset changes' }).click();
  for (const option of [camp, circle]) await expect(option).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Generate forest' })).toBeDisabled();
});

test('panel landmarks retain descriptions and native keyboard submission applies drafts', async ({
  page,
}) => {
  await page.goto('/');
  const settings = page.getByRole('complementary', { name: 'Map settings' });
  const map = page.getByRole('region', { name: 'Stone Dungeon', exact: true });
  const seed = settings.getByRole('textbox', { name: 'World seed' });
  const rooms = settings.getByRole('spinbutton', { name: 'Rooms' });
  await expect(settings).toBeVisible();
  await expect(map).toBeVisible();
  await expect(seed).toHaveAttribute('aria-describedby', 'seed-hint settings-error');
  await expect(rooms).toHaveAttribute('aria-describedby', 'room-hint settings-error');
  await expect(map.locator('canvas')).toHaveAttribute('aria-describedby', 'map-summary');
  for (const id of ['seed-hint', 'room-hint', 'settings-error', 'map-summary', 'map-title'])
    await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);

  await seed.fill('keyboard-crypt');
  await rooms.fill('4');
  await settings.getByRole('radio', { name: 'Mosslit', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(settings.getByRole('radio', { name: 'Crypt', exact: true })).toBeChecked();
  await expect(map.locator('#map-summary')).toContainText('Mosslit · Balanced r0');
  await seed.press('Enter');
  await expect(map.locator('#map-summary')).toContainText('keyboard-crypt');
  await expect(map.locator('#map-summary')).toContainText('4 connected');
  await expect(map.locator('#map-summary')).toContainText('Crypt · Balanced r0');
  await expect(settings.getByRole('button', { name: 'Generate dungeon' })).toBeDisabled();

  const canvas = map.locator('canvas');
  const previewPixels = () =>
    canvas.evaluate((element) => {
      if (!(element instanceof HTMLCanvasElement)) throw new Error('Expected preview canvas');
      return element.toDataURL();
    });
  const withGrid = await previewPixels();
  const grid = map.getByRole('checkbox', { name: 'Grid', exact: true });
  await grid.focus();
  await page.keyboard.press('Space');
  await expect(grid).not.toBeChecked();
  await expect.poll(previewPixels).not.toBe(withGrid);
  await expect(map.locator('#map-summary')).toContainText('keyboard-crypt');
});

test('an export in progress disables both panels and preserves the pending draft on recovery', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#save-name').fill('Rename during export');
  await page.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(page.locator('.saved-name')).toHaveText('Rename during export');
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.locator('.rename-form input').fill('Keep this rename draft');
  const settings = page.getByRole('complementary', { name: 'Map settings' });
  const seed = settings.getByRole('textbox', { name: 'World seed' });
  await seed.fill('unapplied-panel-draft');
  const additions = settings.getByRole('group', { name: 'Add to this map', exact: true });
  await additions.getByRole('checkbox', { name: 'Forgotten study', exact: true }).check();
  await expect(settings.getByRole('button', { name: 'Generate dungeon' })).toBeEnabled();
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      const canvas = this;
      document.addEventListener(
        'release-export',
        () => original.call(canvas, callback, type, quality),
        { once: true },
      );
      document.documentElement.dataset['exportWaiting'] = 'true';
    };
  });
  await page.getByRole('button', { name: 'Export PNG', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-export-waiting', 'true');
  await expect(seed).toBeDisabled();
  await expect(settings.getByRole('spinbutton', { name: 'Rooms' })).toBeDisabled();
  await expect(settings.getByRole('button', { name: 'More rooms' })).toBeDisabled();
  await expect(settings.getByRole('button', { name: 'Reset changes' })).toBeDisabled();
  await expect(settings.getByRole('button', { name: 'Shuffle details' })).toBeDisabled();
  for (const radio of await settings.getByRole('radio').all()) await expect(radio).toBeDisabled();
  for (const option of await additions.getByRole('checkbox').all())
    await expect(option).toBeDisabled();
  await additions.screenshot({ path: 'artifacts/additions/disabled.png' });
  await expect(page.getByRole('checkbox', { name: 'Grid', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save map', exact: true })).toBeDisabled();
  await expect(page.locator('.rename-form input')).toBeDisabled();
  await expect(page.locator('.rename-form button[type=submit]')).toBeDisabled();
  await expect(page.locator('.rename-form').getByRole('button', { name: 'Cancel' })).toBeDisabled();
  const importInput = page.getByLabel('Import backup', { exact: true });
  const importLabel = page.locator('.import-label');
  await expect(importInput).toBeDisabled();
  await expect(importLabel).toHaveCSS('opacity', '0.4');
  await importLabel.hover();
  await expect(importLabel).toHaveCSS('cursor', 'default');
  await expect(importLabel).toHaveCSS('text-decoration-line', 'none');
  await page.locator('.library').screenshot({ path: 'artifacts/qr04/disabled-desktop.png' });
  const downloadPromise = page.waitForEvent('download');
  await page.evaluate(() => document.dispatchEvent(new Event('release-export')));
  expect((await downloadPromise).suggestedFilename()).toBe(
    'encounter-mosslit-sanctum-mosslit-balanced-r0-v4.0.0.png',
  );
  await expect(page.getByRole('button', { name: 'Export PNG', exact: true })).toBeEnabled();
  await expect(seed).toBeEnabled();
  await expect(seed).toHaveValue('unapplied-panel-draft');
  await expect(
    additions.getByRole('checkbox', { name: 'Forgotten study', exact: true }),
  ).toBeChecked();
  for (const option of await additions.getByRole('checkbox').all())
    await expect(option).toBeEnabled();
  await expect(settings.getByRole('button', { name: 'Generate dungeon' })).toBeEnabled();
  await expect(page.getByRole('checkbox', { name: 'Grid', exact: true })).toBeEnabled();
  await expect(page.locator('.rename-form input')).toBeEnabled();
  await expect(page.locator('.rename-form input')).toHaveValue('Keep this rename draft');
  await expect(page.locator('.rename-form button[type=submit]')).toBeEnabled();
  await expect(importInput).toBeEnabled();
  await expect(importLabel).toHaveCSS('opacity', '1');
  await expect(page.locator('#map-summary')).toContainText('mosslit-sanctum');
});

test('native panel hosts retain desktop columns and tablet and mobile flow for both map types', async ({
  page,
}) => {
  await page.goto('/');
  for (const width of [1440, 800, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    for (const type of ['Dungeon', 'Forest']) {
      const settings = page.getByRole('complementary', { name: 'Map settings' });
      await settings.getByRole('radio', { name: type, exact: true }).check();
      const map = page.getByRole('region', {
        name: type === 'Dungeon' ? 'Stone Dungeon' : 'Forest Clearing',
        exact: true,
      });
      await expect(map).toBeVisible();
      const settingsBounds = await settings.boundingBox();
      const mapBounds = await map.boundingBox();
      if (!settingsBounds || !mapBounds) throw new Error('Panel bounds are unavailable');
      if (width > 800) {
        expect(settingsBounds.y).toBe(mapBounds.y);
        expect(settingsBounds.x + settingsBounds.width).toBeLessThan(mapBounds.x);
      } else {
        expect(mapBounds.y).toBeGreaterThan(settingsBounds.y + settingsBounds.height);
        expect(mapBounds.x).toBe(settingsBounds.x);
      }
      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(horizontalOverflow).toBe(false);
      await settings.screenshot({
        path: `artifacts/additions/${type.toLowerCase()}-${width}.png`,
      });
    }
  }
});
