import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { setAddition } from './additions';
import { parseSavedMap, SAVE_FORMAT_VERSION, SAVE_STORAGE_KEY } from '../src/app/save/save-format';

test('Courtyard brazier moves from pending addition to accepted art, export, and editable save', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Courtyard', exact: true }).check();
  await expect(page.getByRole('heading', { name: 'Ruined Courtyard', exact: true })).toBeVisible();
  await setAddition(page, 'Abandoned brazier');
  await expect(page.getByRole('region', { name: 'Pending changes', exact: true })).toContainText(
    'Abandoned brazier',
  );
  await expect(page.locator('#map-summary')).not.toContainText('Abandoned brazier');
  await page.getByRole('button', { name: 'Generate courtyard', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('Abandoned brazier');
  await expect(page.locator('forge-preview canvas')).toHaveAttribute(
    'aria-label',
    /abandoned brazier blocks one square/i,
  );
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toContain('-abandoned-brazier-');
  const bytes = await readFile(await download.path());
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([2560, 1920]);

  await page.getByRole('button', { name: 'Edit objects', exact: true }).click();
  await page.getByRole('button', { name: 'Add object', exact: true }).click();
  await expect(
    page
      .getByRole('region', { name: 'Courtyard object catalog', exact: true })
      .getByRole('button', { name: 'Add Abandoned brazier', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add object', exact: true }).click();

  const save = async (name: string) => {
    await page.locator('#save-name').fill(name);
    await page.getByRole('button', { name: 'Save map', exact: true }).click();
    await expect(page.locator('.library-message .notice')).toHaveText(`Saved “${name}”.`);
    const raw: unknown = JSON.parse(
      (await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)) ?? '[]',
    );
    if (!Array.isArray(raw)) throw new Error('Missing library');
    const record = raw.map(parseSavedMap).find((entry) => entry?.name === name);
    if (!record || record.map.type !== 'courtyard') throw new Error('Missing courtyard');
    return { ...record, map: record.map };
  };
  const accepted = await save('Brazier accepted');
  expect(accepted.saveFormatVersion).toBe(SAVE_FORMAT_VERSION);
  expect(accepted.map.decoration.brazier).toBe(true);
  const index = accepted.map.decoration.props.findIndex(
    (prop) => prop.kind === 'abandoned_brazier',
  );
  expect(index).toBeGreaterThanOrEqual(0);
  await page
    .getByRole('combobox', { name: 'Objects on this map', exact: true })
    .selectOption(`base-${index}`);
  await page.getByRole('spinbutton', { name: 'Column', exact: true }).fill('2');
  await page.getByRole('spinbutton', { name: 'Row', exact: true }).fill('2');
  await page.getByRole('button', { name: 'Place object', exact: true }).click();
  const edited = await save('Brazier moved');
  expect(edited.map.objectEdits).toBeDefined();
  expect(edited.map.decoration.brazier).toBe(true);
});
