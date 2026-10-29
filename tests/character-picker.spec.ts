import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { parseSavedMap, SAVE_STORAGE_KEY } from '../src/app/save/save-format';
import { openCharacters, selectCharacter } from './characters';

async function snapshot(page: Page, name: string) {
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.library')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#save-name').fill(name);
  await page.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(page.locator('.library-message .notice')).toHaveText(`Saved “${name}”.`);
  const raw: unknown = JSON.parse(
    (await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)) ?? '[]',
  );
  if (!Array.isArray(raw)) throw new Error('Missing library');
  const record = raw.map(parseSavedMap).find((entry) => entry?.name === name);
  if (!record) throw new Error('Missing save');
  return record.map;
}

async function png(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  const download = await pending;
  return { name: download.suggestedFilename(), bytes: await readFile(await download.path()) };
}

for (const type of ['Dungeon', 'Forest'] as const) {
  test(`${type} illustrated choices remain pending, preserve accepted saves/exports, and restore through Reset and Open`, async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('radio', { name: type, exact: true }).check();
    const original = await snapshot(page, 'Original');
    const before = await png(page);
    const chooser = page.getByRole('button', { name: 'Choose character', exact: true });
    const initial = type === 'Dungeon' ? 'Mosslit stone' : 'Verdant woodland';
    const target = type === 'Dungeon' ? 'Abandoned storehouse' : 'Ancient pines';
    const picker = await openCharacters(page);
    await expect(picker.getByRole('radio')).toHaveCount(4);
    await expect(picker.getByRole('radio', { name: initial, exact: true })).toBeChecked();
    const images = picker.locator('img');
    await expect
      .poll(() =>
        images.evaluateAll((items) =>
          items.every(
            (item) =>
              (item as HTMLImageElement).complete &&
              (item as HTMLImageElement).naturalWidth === 480,
          ),
        ),
      )
      .toBe(true);
    const sources = await images.evaluateAll((items) =>
      items.map((item) => (item as HTMLImageElement).src),
    );
    expect(new Set(sources).size).toBe(4);
    await picker.getByRole('radio', { name: target, exact: true }).check();
    await expect(picker.getByRole('status')).toHaveText(`Selected: ${target}`);
    await page.keyboard.press('Escape');
    await expect(chooser).toBeFocused();
    await expect(chooser).toHaveAccessibleDescription(new RegExp(target));
    await expect(chooser.locator('.character-pending')).toHaveText('Pending');
    await expect(chooser.locator('img')).toHaveAttribute('src', sources[2] ?? '');
    expect(await snapshot(page, 'Pending character')).toEqual(original);
    expect(await png(page)).toEqual(before);
    await page.getByRole('button', { name: `Generate ${type.toLowerCase()}`, exact: true }).click();
    const accepted = await snapshot(page, 'Accepted character');
    expect(accepted.layout).toEqual(original.layout);
    expect(accepted.surfaceSeed).toBe(original.surfaceSeed);
    expect(accepted.decoration.revision).toBe(original.decoration.revision);
    expect(accepted.decoration).toMatchObject(
      type === 'Dungeon' ? { preset: 'Storehouse' } : { character: 'Pines' },
    );
    await expect(chooser.locator('.character-pending')).toHaveCount(0);
    await selectCharacter(page, type === 'Dungeon' ? 'Sanctuary' : 'Fey glade');
    await page.getByRole('button', { name: 'Reset changes', exact: true }).click();
    await expect(page.locator('#character-selection strong')).toHaveText(target);
    const reopened = await openCharacters(page);
    await expect(reopened.getByRole('radio', { name: target, exact: true })).toBeChecked();
    expect(
      await reopened
        .locator('img')
        .evaluateAll((items) => items.map((item) => (item as HTMLImageElement).src)),
    ).toEqual(sources);
    await reopened.getByRole('button', { name: 'Close characters', exact: true }).click();
    await page
      .locator('.saved-item')
      .filter({ has: page.locator('.saved-name').getByText('Original', { exact: true }) })
      .getByRole('button', { name: 'Open', exact: true })
      .click();
    await expect(page.locator('#character-selection strong')).toHaveText(initial);
    await expect(
      page.getByRole('button', { name: `Generate ${type.toLowerCase()}`, exact: true }),
    ).toBeDisabled();
  });
}

test('native radio keyboard selection closes predictably and never submits the generation form', async ({
  page,
}) => {
  await page.goto('/');
  const chooser = page.getByRole('button', { name: 'Choose character', exact: true });
  await chooser.focus();
  await page.keyboard.press('Enter');
  const picker = page.getByRole('dialog', { name: 'Choose character', exact: true });
  await expect(
    picker.getByRole('heading', { name: 'Choose character', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(picker.getByRole('button', { name: 'Close characters', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(picker.getByRole('radio', { name: 'Mosslit stone', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  const crypt = picker.getByRole('radio', { name: 'Ancient crypt', exact: true });
  await expect(crypt).toBeChecked();
  expect(await crypt.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
  await expect(crypt).toHaveAccessibleDescription(/sarcophagi/);
  await page.keyboard.press('Enter');
  await expect(picker).toBeVisible();
  await expect(page.locator('#map-summary')).toContainText('Mosslit');
  await page.keyboard.press('Tab');
  await expect(picker.getByRole('button', { name: 'Done', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(picker).not.toBeVisible();
  await expect(chooser).toBeFocused();
  await expect(page.locator('#map-summary')).toContainText('Mosslit');
  await expect(page.locator('#character-selection strong')).toHaveText('Ancient crypt');
  await page.getByLabel('World seed').fill('');
  await page.getByRole('button', { name: 'Generate dungeon', exact: true }).click();
  await expect(page.locator('#settings-error')).not.toBeEmpty();
  // A queued close event must not empty a gallery reopened in the same task.
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('.choose-character')?.click();
    document.querySelector<HTMLButtonElement>('.character-picker .done-button')?.click();
    document.querySelector<HTMLButtonElement>('.choose-character')?.click();
  });
  await expect(picker.getByRole('radio')).toHaveCount(4);
  await page.keyboard.press('Escape');
  await openCharacters(page);
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('World seed')).toHaveValue('');
  await expect(page.locator('#settings-error')).not.toBeEmpty();
});

test('each map type keeps its character draft and Courtyard offers its single existing look', async ({
  page,
}) => {
  await page.goto('/');
  await selectCharacter(page, 'Crypt');
  await page.getByRole('radio', { name: 'Forest', exact: true }).check();
  await selectCharacter(page, 'Fey glade');
  await page.getByRole('radio', { name: 'Courtyard', exact: true }).check();
  await expect(page.getByRole('button', { name: 'Choose character', exact: true })).toHaveCount(0);
  await expect(page.locator('.style-note')).toContainText('Overgrown ruin');
  for (const [type, label] of [
    ['Dungeon', 'Ancient crypt'],
    ['Forest', 'Fey glade'],
  ]) {
    await page.getByRole('radio', { name: type, exact: true }).check();
    await expect(page.locator('#character-selection strong')).toHaveText(label ?? '');
    await expect(page.locator('.character-pending')).toHaveText('Pending');
    await expect(page.getByRole('region', { name: 'Pending changes', exact: true })).toContainText(
      label ?? '',
    );
  }
});

test('illustrated cards and fixed footer fit desktop, mobile and short viewports with visible keyboard focus', async ({
  page,
}) => {
  await page.goto('/');
  for (const [width, height] of [
    [1440, 1000],
    [768, 1024],
    [390, 844],
    [320, 568],
    [800, 420],
  ] as const) {
    await page.setViewportSize({ width, height });
    for (const type of ['Dungeon', 'Forest']) {
      await page.getByRole('radio', { name: type, exact: true }).check();
      const picker = await openCharacters(page);
      const bounds = await picker.boundingBox();
      if (!bounds) throw new Error('Missing picker');
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
      await expect(picker.getByRole('button', { name: 'Done', exact: true })).toBeInViewport();
      const last = picker.getByRole('radio').last();
      await last.focus();
      await page.keyboard.press('Space');
      await expect(last).toBeChecked();
      // Subpixel scrolling may clip a fraction of a border pixel.
      const card = picker.locator('.character-option').last();
      await expect(card).toBeInViewport({ ratio: 0.99 });
      const cardBounds = await card.boundingBox();
      const catalogBounds = await picker.locator('.character-catalog').boundingBox();
      if (!cardBounds || !catalogBounds) throw new Error('Missing card bounds');
      expect(cardBounds.y).toBeGreaterThanOrEqual(catalogBounds.y - 1);
      expect(cardBounds.y + cardBounds.height).toBeLessThanOrEqual(
        catalogBounds.y + catalogBounds.height + 1,
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await picker.screenshot({ path: `artifacts/characters/${type}-${width}-${height}.png` });
      await page.keyboard.press('Tab');
      await expect(picker.getByRole('button', { name: 'Done', exact: true })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(
        page.getByRole('button', { name: 'Choose character', exact: true }),
      ).toBeFocused();
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'artifacts/characters/workbench-1440.png', fullPage: true });
});

test('busy export disables the character opener, preserves its pending choice, and recovers after failure', async ({
  page,
}) => {
  await page.goto('/');
  await selectCharacter(page, 'Sanctuary');
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      HTMLCanvasElement.prototype.toBlob = original;
      document.addEventListener('release-character-export', () => callback(null), { once: true });
    };
  });
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  const chooser = page.getByRole('button', { name: 'Choose character', exact: true });
  await expect(chooser).toBeDisabled();
  await chooser.evaluate((el) => (el as HTMLButtonElement).click());
  await expect(
    page.getByRole('dialog', { name: 'Choose character', exact: true }),
  ).not.toBeVisible();
  await expect(page.locator('#character-selection strong')).toHaveText('Overgrown sanctuary');
  await page.screenshot({ path: 'artifacts/characters/disabled.png', fullPage: true });
  await page.evaluate(() => document.dispatchEvent(new Event('release-character-export')));
  await expect(page.locator('#settings-error')).not.toBeEmpty();
  await expect(chooser).toBeEnabled();
  const picker = await openCharacters(page);
  await expect(
    picker.getByRole('radio', { name: 'Overgrown sanctuary', exact: true }),
  ).toBeChecked();
  await picker.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Generate dungeon', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('Sanctuary');
});
