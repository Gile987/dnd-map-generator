import { selectCharacter, characterLabel } from './characters';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { GeneratedMap } from '../src/app/engine/model';
import { parseSavedMap, SAVE_STORAGE_KEY } from '../src/app/save/save-format';

async function saveSnapshot(page: Page, name: string): Promise<GeneratedMap> {
  await page.locator('#save-name').fill(name);
  await page.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(page.locator('.saved-name').filter({ hasText: name })).toBeVisible();
  const data: unknown = JSON.parse(
    (await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)) ?? '[]',
  );
  if (!Array.isArray(data)) throw new Error('Saved snapshots are missing.');
  const record = data.map(parseSavedMap).find((entry) => entry?.name === name);
  if (!record) throw new Error(`Snapshot ${name} is missing.`);
  return record.map;
}

test('all settings remain drafts until Generate applies them together', async ({ page }) => {
  await page.goto('/');
  const generate = page.getByRole('button', { name: 'Generate dungeon', exact: true });
  await expect(generate).toBeDisabled();
  const original = await saveSnapshot(page, 'Original');
  await page.getByLabel('World seed').fill('configured-crypt');
  await page.getByRole('spinbutton', { name: 'Rooms' }).fill('4');
  await selectCharacter(page, 'Crypt');
  await page.getByRole('radio', { name: 'Cluttered', exact: true }).check();
  await expect(page.locator('#map-summary')).toContainText('mosslit-sanctum');
  await expect(page.locator('#map-summary')).toContainText('6 connected');
  await expect(page.locator('#map-summary')).toContainText('Mosslit · Balanced r0');
  expect(await saveSnapshot(page, 'Pending')).toEqual(original);
  await expect(generate).toBeEnabled();
  await generate.click();
  await expect(page.locator('#map-summary')).toContainText('configured-crypt');
  await expect(page.locator('#map-summary')).toContainText('4 connected');
  await expect(page.locator('#map-summary')).toContainText('Crypt · Cluttered r0');
  await expect(generate).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Reset changes' })).toHaveCount(0);
});

test('applying appearance preserves layout, surface, and the shuffled revision', async ({
  page,
}) => {
  await page.goto('/');
  const original = await saveSnapshot(page, 'Layout');
  await selectCharacter(page, 'Crypt');
  await page.getByRole('radio', { name: 'Cluttered', exact: true }).check();
  await page.getByRole('button', { name: 'Shuffle details' }).click();
  await expect(page.locator('#map-summary')).toContainText('Mosslit · Balanced r1');
  await page.getByRole('button', { name: 'Generate dungeon', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('Crypt · Cluttered r1');
  const applied = await saveSnapshot(page, 'Appearance');
  expect(applied.layout).toEqual(original.layout);
  expect(applied.surfaceSeed).toBe(original.surfaceSeed);
  expect(applied.seed).toBe(original.seed);
  await page.getByLabel('World seed').press('Enter');
  await expect(page.locator('#map-summary')).toContainText('r1');
  await expect(page.getByRole('button', { name: 'Generate dungeon' })).toBeDisabled();
});

test('Reset changes restores every setting and clears validation without changing the map', async ({
  page,
}) => {
  await page.goto('/');
  const original = await saveSnapshot(page, 'Before reset');
  await page.getByLabel('World seed').fill('');
  await page.getByRole('spinbutton', { name: 'Rooms' }).fill('4.5');
  await selectCharacter(page, 'Sanctuary');
  await page.getByRole('radio', { name: 'Sparse', exact: true }).check();
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  await expect(page.locator('#settings-error')).not.toBeEmpty();
  await page.getByRole('button', { name: 'Reset changes' }).click();
  await expect(page.getByLabel('World seed')).toHaveValue('mosslit-sanctum');
  await expect(page.getByRole('spinbutton', { name: 'Rooms' })).toHaveValue('6');
  await expect(page.locator('#character-selection strong')).toHaveText(characterLabel('Mosslit'));
  await expect(page.getByRole('radio', { name: 'Balanced', exact: true })).toBeChecked();
  await expect(page.locator('#settings-error')).toBeEmpty();
  await expect(page.getByRole('button', { name: 'Generate dungeon' })).toBeDisabled();
  expect(await saveSnapshot(page, 'After reset')).toEqual(original);
});

test('map types retain independent drafts and opening a saved map restores accepted controls', async ({
  page,
}) => {
  await page.goto('/');
  await saveSnapshot(page, 'Accepted dungeon');
  await page.getByLabel('World seed').fill('dungeon-draft');
  await page.getByRole('spinbutton', { name: 'Rooms' }).fill('4.5');
  await selectCharacter(page, 'Crypt');
  await page.getByRole('radio', { name: 'Sparse', exact: true }).check();
  await page.getByRole('radio', { name: 'Forest', exact: true }).check();
  await expect(page.getByLabel('World seed')).toHaveValue('mosslit-sanctum');
  await expect(page.getByRole('radio', { name: 'Balanced', exact: true })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Generate forest' })).toBeDisabled();
  const forest = await saveSnapshot(page, 'Forest original');
  await page.getByLabel('World seed').fill('forest-draft');
  await page.getByRole('radio', { name: 'Cluttered', exact: true }).check();
  await page.getByRole('radio', { name: 'Dungeon', exact: true }).check();
  await expect(page.getByLabel('World seed')).toHaveValue('dungeon-draft');
  await expect(page.getByRole('spinbutton', { name: 'Rooms' })).toHaveValue('4.5');
  await expect(page.locator('#character-selection strong')).toHaveText(characterLabel('Crypt'));
  await expect(page.getByRole('radio', { name: 'Sparse', exact: true })).toBeChecked();
  await page
    .locator('.saved-item')
    .filter({ hasText: 'Accepted dungeon' })
    .getByRole('button', { name: 'Open', exact: true })
    .click();
  await expect(page.getByLabel('World seed')).toHaveValue('mosslit-sanctum');
  await expect(page.locator('#character-selection strong')).toHaveText(characterLabel('Mosslit'));
  await expect(page.getByRole('button', { name: 'Generate dungeon' })).toBeDisabled();
  await page.getByRole('radio', { name: 'Forest', exact: true }).check();
  await expect(page.getByLabel('World seed')).toHaveValue('forest-draft');
  await expect(page.getByRole('radio', { name: 'Cluttered', exact: true })).toBeChecked();
  expect(await saveSnapshot(page, 'Forest pending')).toEqual(forest);
  await page.getByRole('button', { name: 'Reset changes' }).click();
  await expect(page.getByRole('radio', { name: 'Balanced', exact: true })).toBeChecked();
  await page.getByRole('radio', { name: 'Cluttered', exact: true }).check();
  await page.getByRole('button', { name: 'Generate forest' }).click();
  await expect(page.locator('#map-summary')).toContainText('Cluttered r0');
  const decorated = await saveSnapshot(page, 'Forest decorated');
  expect(decorated.layout).toEqual(forest.layout);
  expect(decorated.surfaceSeed).toBe(forest.surfaceSeed);
  expect(decorated.decoration.density).toBe('Cluttered');
  await expect(page.getByRole('button', { name: 'Generate forest' })).toBeDisabled();
  await page.getByRole('button', { name: 'Shuffle details' }).click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  await page.getByRole('button', { name: 'Randomize seed', exact: true }).click();
  await expect(page.getByLabel('World seed')).toHaveValue(/^forest-/);
  await expect(page.locator('#map-summary')).toContainText('mosslit-sanctum');
  await expect(page.locator('#map-summary')).toContainText('r1');
  await page.getByRole('button', { name: 'Generate forest' }).click();
  await expect(page.locator('#map-summary')).toContainText('forest-');
  await expect(page.locator('#map-summary')).toContainText('Cluttered r0');
  await expect(page.getByRole('button', { name: 'Generate forest' })).toBeDisabled();
});
