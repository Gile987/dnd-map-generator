import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { parseSavedMap, SAVE_FORMAT_VERSION, SAVE_STORAGE_KEY } from '../src/app/save/save-format';
import { openAdditions } from './additions';
import { courtyardInstances } from '../src/app/engine/object-editor/courtyard-document';

test('spawned braziers are ordinary objects: generated art, editable, and retained in saves', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Courtyard', exact: true }).check();
  await expect(page.getByRole('heading', { name: 'Ruined Courtyard', exact: true })).toBeVisible();
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');

  // Braziers are no longer a Choose additions entry.
  const picker = await openAdditions(page);
  await expect(
    picker.getByRole('checkbox', { name: 'Abandoned brazier', exact: true }),
  ).toHaveCount(0);
  await picker.getByRole('button', { name: 'Done', exact: true }).click();

  // The generated map carries spawned braziers beside its masonry.
  const summary = await page.locator('#map-summary').textContent();
  expect(summary).toContain('Overgrown ruin');

  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  const download = await pending;
  const bytes = await readFile(await download.path());
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([2560, 1920]);

  await page.getByRole('button', { name: 'Edit objects', exact: true }).click();

  // Save the pre-edit map and pick an accent tile (passable ground cover) for
  // the new brazier; blocking-over-cover is a legal placement.
  const spawnSave = await (async () => {
    await page.locator('#save-name').fill('Brazier spawn');
    await page.getByRole('button', { name: 'Save map', exact: true }).click();
    await expect(page.locator('.library-message .notice')).toHaveText('Saved “Brazier spawn”.');
    const raw: unknown = JSON.parse(
      (await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)) ?? '[]',
    );
    if (!Array.isArray(raw)) throw new Error('Missing library');
    const record = raw.map(parseSavedMap).find((entry) => entry?.name === 'Brazier spawn');
    if (!record || record.map.type !== 'courtyard') throw new Error('Missing courtyard');
    return record.map;
  })();
  const accent = spawnSave.decoration.props.find((prop) => !prop.blocking && prop.kind !== 'vine');
  if (!accent) throw new Error('Missing accent tile');

  await page.getByRole('button', { name: 'Add object', exact: true }).click();
  await expect(
    page
      .getByRole('region', { name: 'Courtyard object catalog', exact: true })
      .getByRole('button', { name: 'Add Abandoned brazier', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add Abandoned brazier', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Column', exact: true }).fill(String(accent.x + 1));
  await page.getByRole('spinbutton', { name: 'Row', exact: true }).fill(String(accent.y + 1));
  await page.getByRole('button', { name: 'Place object', exact: true }).click();
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
  const edited = await save('Brazier edited');
  expect(edited.saveFormatVersion).toBe(SAVE_FORMAT_VERSION);
  expect(edited.map.decoration.props).toEqual(spawnSave.decoration.props);
  expect(
    courtyardInstances(edited.map).filter((item) => item.prop.kind === 'abandoned_brazier'),
  ).toHaveLength(
    spawnSave.decoration.props.filter((p) => p.kind === 'abandoned_brazier').length + 1,
  );
  const added = edited.map.objectEdits?.added ?? [];
  expect(added.some((entry) => entry.prop.kind === 'abandoned_brazier')).toBe(true);

  // The added brazier participates in drawing-order controls like any object.
  await page
    .getByRole('combobox', { name: 'Objects on this map', exact: true })
    .selectOption('added-1');
  await expect(page.getByRole('button', { name: 'Remove object', exact: true })).toBeVisible();
});
