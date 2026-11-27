import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { SAVE_STORAGE_KEY, parseSavedMap } from '../src/app/save/save-format';
import { generateDungeon } from '../src/app/engine/generate';

async function ready(page: Page) {
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
}
async function save(page: Page, name: string) {
  await ready(page);
  await page.locator('#save-name').fill(name);
  await page.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(page.locator('.library-message .notice')).toHaveText(`Saved “${name}”.`);
  const data: unknown = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? '[]'),
    SAVE_STORAGE_KEY,
  );
  if (!Array.isArray(data)) throw Error('Missing saves');
  const record = data.map(parseSavedMap).find((entry) => entry?.name === name);
  if (!record || record.map.type !== 'dungeon') throw Error('Missing Dungeon');
  return record.map;
}
async function png(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  const download = await pending;
  return {
    name: download.suggestedFilename(),
    hash: createHash('sha256')
      .update(await readFile(await download.path()))
      .digest('hex'),
  };
}
for (const width of [1440, 320])
  test(`${width}px: room use stays pending, generates in place, shuffles, edits and reopens`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await ready(page);
    const original = await save(page, 'Before furnishing');
    const control = page.getByRole('combobox', { name: 'Room use', exact: true });
    await control.focus();
    await page.keyboard.press('ArrowDown'); // General rooms -> Mixed rooms.
    await page.keyboard.press('Enter');
    await expect(control).toHaveValue('Mixed rooms');
    await expect(page.getByRole('region', { name: 'Pending changes', exact: true })).toContainText(
      'Room use',
    );
    expect(await save(page, 'Still pending')).toEqual(original);
    await page.getByRole('button', { name: 'Generate dungeon', exact: true }).click();
    await ready(page);
    const mixed = await save(page, 'Mixed rooms');
    expect(mixed.layout).toEqual(original.layout);
    expect(mixed.surfaceSeed).toBe(original.surfaceSeed);
    expect(mixed.decoration.roomTheme).toBe('Mixed rooms');
    expect(mixed.decoration.roomPurposes?.length).toBeGreaterThan(0);
    await page.screenshot({ path: `artifacts/room-purpose/${width}-mixed.png`, fullPage: true });
    await control.selectOption('Storerooms');
    await page.getByRole('button', { name: 'Shuffle details', exact: true }).click();
    await ready(page);
    const shuffled = await save(page, 'Shuffled rooms');
    expect(shuffled.decoration).toMatchObject({
      roomTheme: 'Mixed rooms',
      revision: mixed.decoration.revision + 1,
    });
    await expect(control).toHaveValue('Storerooms');
    await page.getByRole('button', { name: /^Undo (shuffle|change)$/, exact: true }).click();
    await ready(page);
    expect(await save(page, 'Undo furnishing')).toEqual(mixed);
    await page.getByRole('button', { name: 'Generate dungeon', exact: true }).click();
    await ready(page);
    const stores = await save(page, 'Storerooms');
    expect(stores.decoration.roomPurposes?.every((entry) => entry.purpose === 'Storeroom')).toBe(
      true,
    );
    const reproduced = generateDungeon({
      seed: stores.seed,
      roomCount: stores.layout.rooms.length,
      density: stores.decoration.density,
      preset: stores.decoration.preset,
      roomTheme: 'Storerooms',
    });
    expect(reproduced.ok && reproduced.map).toEqual(stores);
    const image = await png(page);
    expect(image.name).toContain('-storerooms-');
    await page.reload();
    await page
      .locator('.saved-item')
      .filter({ has: page.getByText('Storerooms', { exact: true }) })
      .getByRole('button', { name: 'Open', exact: true })
      .click();
    await ready(page);
    await expect(control).toHaveValue('Storerooms');
    expect((await png(page)).hash).toBe(image.hash);
    // Generated furnishings remain independent, removable editor objects.
    await page.getByRole('button', { name: 'Edit objects', exact: true }).click();
    const first = stores.decoration.props.findIndex((prop) => prop.kind === 'crate');
    expect(first).toBeGreaterThanOrEqual(0);
    await page
      .getByRole('combobox', { name: 'Objects on this map', exact: true })
      .selectOption(`base-${first}`);
    await page.getByRole('button', { name: 'Remove object', exact: true }).click();
    const edited = await save(page, 'Edited storeroom');
    expect(edited.objectEdits?.removed).toContain(`base-${first}`);
    await page.screenshot({ path: `artifacts/room-purpose/${width}-editing.png`, fullPage: true });
  });
