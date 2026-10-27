import { openAdditions, selectedAddition, setAddition } from './additions';
import { expect, test } from '@playwright/test';

test('the additions picker keeps independent drafts, supports the keyboard, and restores focus', async ({
  page,
}) => {
  await page.goto('/');
  const settings = page.getByRole('complementary', { name: 'Map settings' });
  const opener = settings.getByRole('button', { name: 'Choose additions', exact: true });
  const summary = await page.locator('#map-summary').textContent();
  await opener.focus();
  await page.keyboard.press('Enter');
  const picker = page.getByRole('dialog', { name: 'Choose additions', exact: true });
  const search = picker.getByRole('searchbox', { name: 'Find an addition' });
  await expect(
    picker.getByRole('heading', { name: 'Choose additions', exact: true }),
  ).toBeFocused();
  await expect(picker).toHaveAccessibleDescription(/Choose any combination. Generate to apply/);
  await expect(picker.getByRole('checkbox')).toHaveCount(3);
  // Native modal behavior keeps background controls inert.
  await page.keyboard.press('Tab');
  await expect(picker.getByRole('button', { name: 'Close additions', exact: true })).toBeFocused();
  await opener.focus();
  await expect(picker.getByRole('button', { name: 'Close additions', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(search).toBeFocused();
  const names = ['Forgotten study', 'Weathered statue', 'Dining table'];
  const descriptions = [/desk, bookshelves/, /stone figure on a plinth/, /blocks two tiles/];
  for (const [index, name] of names.entries()) {
    const option = picker.getByRole('checkbox', { name, exact: true });
    await expect(option).not.toBeChecked();
    await expect(option).toHaveAccessibleDescription(descriptions[index] ?? /./);
    await page.keyboard.press('Tab');
    await expect(option).toBeFocused();
    expect(await option.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
    await page.keyboard.press('Space');
    await expect(option).toBeChecked();
  }
  await expect(picker.getByRole('status')).toHaveText('3 selected');
  await picker.screenshot({ path: 'artifacts/picker/keyboard.png' });
  await page.keyboard.press('Escape');
  await expect(picker).not.toBeVisible();
  await expect(opener).toBeFocused();
  await expect(page.locator('#map-summary')).toHaveText(summary ?? '');
  for (const name of names) await expect(selectedAddition(page, name)).toBeVisible();
  await selectedAddition(page, 'Forgotten study').click();
  await expect(selectedAddition(page, 'Forgotten study')).toHaveCount(0);
  await expect(opener).toBeFocused();
  await page.getByRole('radio', { name: 'Forest', exact: true }).check();
  await openAdditions(page);
  await expect(picker.getByRole('checkbox')).toHaveCount(2);
  const camp = picker.getByRole('checkbox', { name: 'Abandoned camp', exact: true });
  await expect(camp).not.toBeChecked();
  await picker.getByText(/Two tents, bedrolls/).click();
  await picker.getByRole('checkbox', { name: 'Standing-stone circle', exact: true }).check();
  await expect(camp).toBeChecked();
  await picker.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(opener).toBeFocused();
  await page.getByRole('radio', { name: 'Dungeon', exact: true }).check();
  await openAdditions(page);
  await expect(
    picker.getByRole('checkbox', { name: 'Forgotten study', exact: true }),
  ).not.toBeChecked();
  for (const name of ['Weathered statue', 'Dining table'])
    await expect(picker.getByRole('checkbox', { name, exact: true })).toBeChecked();
  await picker.getByRole('button', { name: 'Close additions', exact: true }).click();
  await page.getByRole('button', { name: 'Reset changes' }).click();
  await expect(settings.getByRole('list', { name: 'Selected additions' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Generate dungeon' })).toBeDisabled();
  await page.getByRole('radio', { name: 'Forest', exact: true }).check();
  for (const name of ['Abandoned camp', 'Standing-stone circle'])
    await expect(selectedAddition(page, name)).toBeVisible();
  await page.getByRole('button', { name: 'Reset changes' }).click();
  await expect(page.getByRole('button', { name: 'Generate forest' })).toBeDisabled();
});

test('searching the visual catalog keeps selections through filtering, empty results, and reopening', async ({
  page,
}) => {
  await page.goto('/');
  const picker = await openAdditions(page);
  const search = picker.getByRole('searchbox', { name: 'Find an addition' });
  await expect(picker.locator('img')).toHaveCount(3);
  await expect
    .poll(() =>
      picker
        .locator('img')
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth === 480,
          ),
        ),
    )
    .toBe(true);
  const sources = await picker
    .locator('img')
    .evaluateAll((images) => images.map((image) => (image as HTMLImageElement).src));
  expect(new Set(sources).size).toBe(3);
  await search.fill('  DESK  ');
  await expect(picker.getByRole('checkbox')).toHaveCount(1);
  await picker.getByRole('checkbox', { name: 'Forgotten study', exact: true }).check();
  await search.fill('DINING');
  await picker.getByRole('checkbox', { name: 'Dining table', exact: true }).check();
  await search.fill('nothing-like-this');
  await expect(picker.getByRole('checkbox')).toHaveCount(0);
  await expect(picker.getByText('No additions found', { exact: true })).toBeVisible();
  await expect(picker.getByRole('status').filter({ hasText: '2 selected' })).toBeVisible();
  await picker.screenshot({ path: 'artifacts/picker/empty.png' });
  await picker.getByRole('button', { name: 'Show all additions' }).click();
  await expect(search).toBeFocused();
  await expect(picker.getByRole('checkbox')).toHaveCount(3);
  for (const name of ['Forgotten study', 'Dining table'])
    await expect(picker.getByRole('checkbox', { name, exact: true })).toBeChecked();
  await expect(
    picker.getByRole('checkbox', { name: 'Weathered statue', exact: true }),
  ).not.toBeChecked();
  await search.fill('statue');
  await picker.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');
  await search.fill('statue');
  await picker.getByRole('button', { name: 'Done', exact: true }).click();
  await openAdditions(page);
  await expect(search).toHaveValue('');
  await expect(picker.getByRole('checkbox')).toHaveCount(3);
  await picker.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(selectedAddition(page, 'Forgotten study')).toBeVisible();
  await expect(selectedAddition(page, 'Dining table')).toBeVisible();
});

test('the visual picker fits desktop, mobile, and short viewports for both map types', async ({
  page,
}) => {
  await page.goto('/');
  for (const [width, height] of [
    [1440, 1000],
    [768, 1000],
    [390, 700],
    [320, 568],
    [800, 420],
  ] as const) {
    await page.setViewportSize({ width, height });
    for (const type of ['Dungeon', 'Forest'] as const) {
      await page.getByRole('radio', { name: type, exact: true }).check();
      await expect(
        page.getByRole('heading', {
          name: type === 'Dungeon' ? 'Shape your dungeon' : 'Shape your clearing',
          exact: true,
        }),
      ).toBeVisible();
      const picker = await openAdditions(page);
      const bounds = await picker.boundingBox();
      if (!bounds) throw new Error('Missing picker bounds');
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
      const done = picker.getByRole('button', { name: 'Done', exact: true });
      const footer = await done.boundingBox();
      if (!footer) throw new Error('Missing Done button');
      expect(footer.y + footer.height).toBeLessThanOrEqual(height);
      await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
      expect(await picker.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
        false,
      );
      await picker.getByRole('checkbox').last().check();
      await expect(done).toBeInViewport();
      await picker.screenshot({
        path: `artifacts/picker/${type.toLowerCase()}-${width}-${height}.png`,
      });
      await done.click();
      await expect(page.locator('body')).toHaveCSS('overflow', 'visible');
      await page.getByRole('button', { name: 'Reset changes' }).click();
    }
  }
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
  await setAddition(page, 'Forgotten study');
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
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-export-waiting', 'true');
  await expect(seed).toBeDisabled();
  await expect(settings.getByRole('spinbutton', { name: 'Rooms' })).toBeDisabled();
  await expect(settings.getByRole('button', { name: 'More rooms' })).toBeDisabled();
  await expect(settings.getByRole('button', { name: 'Reset changes' })).toBeDisabled();
  await expect(settings.getByRole('button', { name: 'Shuffle details' })).toBeDisabled();
  for (const radio of await settings.getByRole('radio').all()) await expect(radio).toBeDisabled();
  await expect(
    additions.getByRole('button', { name: 'Choose additions', exact: true }),
  ).toBeDisabled();
  await expect(selectedAddition(page, 'Forgotten study')).toBeDisabled();
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
  await expect(page.getByRole('button', { name: 'Quick export PNG', exact: true })).toBeEnabled();
  await expect(seed).toBeEnabled();
  await expect(seed).toHaveValue('unapplied-panel-draft');
  await expect(selectedAddition(page, 'Forgotten study')).toBeVisible();
  await expect(
    additions.getByRole('button', { name: 'Choose additions', exact: true }),
  ).toBeEnabled();
  await expect(selectedAddition(page, 'Forgotten study')).toBeEnabled();
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
