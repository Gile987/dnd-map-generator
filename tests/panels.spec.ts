import { expect, test } from '@playwright/test';

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
  const settings = page.getByRole('complementary', { name: 'Map settings' });
  const seed = settings.getByRole('textbox', { name: 'World seed' });
  await seed.fill('unapplied-panel-draft');
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
  await expect(page.getByRole('checkbox', { name: 'Grid', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save map', exact: true })).toBeDisabled();
  const downloadPromise = page.waitForEvent('download');
  await page.evaluate(() => document.dispatchEvent(new Event('release-export')));
  expect((await downloadPromise).suggestedFilename()).toBe(
    'encounter-mosslit-sanctum-mosslit-balanced-r0-v4.0.0.png',
  );
  await expect(page.getByRole('button', { name: 'Export PNG', exact: true })).toBeEnabled();
  await expect(seed).toBeEnabled();
  await expect(seed).toHaveValue('unapplied-panel-draft');
  await expect(settings.getByRole('button', { name: 'Generate dungeon' })).toBeEnabled();
  await expect(page.getByRole('checkbox', { name: 'Grid', exact: true })).toBeEnabled();
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
    }
  }
});
