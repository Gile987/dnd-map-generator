import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { parseSavedMap, SAVE_STORAGE_KEY } from '../src/app/save/save-format';
import fixture from '../src/app/save/fixtures/forest-v3.json';
import { openAdditions, setAddition } from './additions';

const TREE = 'Fallen ancient tree';
async function settled(page: Page) {
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
}
async function forest(page: Page) {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Forest', exact: true }).check();
  await expect(page.getByRole('heading', { name: 'Forest Clearing', exact: true })).toBeVisible();
  await settled(page);
}
async function apply(page: Page) {
  await page.getByRole('button', { name: 'Generate forest', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Pending changes', exact: true })).toHaveCount(0);
  await expect(page.locator('#settings-error')).toBeEmpty();
  await settled(page);
}
async function snapshot(page: Page, name: string) {
  await settled(page);
  await expect(page.locator('.library')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#save-name').fill(name);
  await page.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(page.locator('.library-message .notice')).toHaveText(`Saved “${name}”.`);
  const raw: unknown = JSON.parse(
    (await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)) ?? '[]',
  );
  if (!Array.isArray(raw)) throw new Error('Missing saves');
  const saved = raw.map(parseSavedMap).find((r) => r?.name === name);
  if (!saved || saved.map.type !== 'forest') throw new Error('Missing forest');
  return { ...saved, map: saved.map };
}
async function png(page: Page, button?: Locator) {
  const pending = page.waitForEvent('download');
  await (button ?? page.getByRole('button', { name: 'Quick export PNG', exact: true })).click();
  const file = await pending,
    bytes = await readFile(await file.path());
  await settled(page);
  return {
    name: file.suggestedFilename(),
    bytes,
    size: [bytes.readUInt32BE(16), bytes.readUInt32BE(20)],
  };
}

test('fallen trees coexist with camps and standing stones, preserve accepted maps and undo, and survive backups and VTT exports', async ({
  page,
}) => {
  test.setTimeout(60000);
  await forest(page);
  await setAddition(page, 'Abandoned camp');
  await setAddition(page, 'Standing-stone circle');
  await apply(page);
  const before = await snapshot(page, 'Before tree'),
    beforePng = await png(page);
  await setAddition(page, TREE);
  await expect(page.getByRole('region', { name: 'Pending changes', exact: true })).toContainText(
    TREE,
  );
  expect((await snapshot(page, 'Pending tree')).map).toEqual(before.map);
  expect((await png(page)).bytes).toEqual(beforePng.bytes);
  await apply(page);
  const accepted = await snapshot(page, 'Ancient tree'),
    image = await png(page);
  expect(accepted.saveFormatVersion).toBe('28.0.0');
  expect(accepted.map.layout).toEqual(before.map.layout);
  expect(accepted.map.surfaceSeed).toBe(before.map.surfaceSeed);
  expect(accepted.map.decoration).toMatchObject({
    fallenTree: true,
    scene: 'Abandoned camp',
    landmark: 'standing-stone-circle',
    revision: 0,
  });
  expect(accepted.map.decoration.props.find((p) => p.kind === 'fallen_trunk')).toMatchObject({
    footprint: { width: 4, height: 1 },
    blocking: true,
  });
  for (const p of before.map.decoration.props.filter((p) =>
    ['tent', 'bedroll', 'fire_ring', 'supply_bundle', 'standing_stone'].includes(p.kind),
  ))
    expect(accepted.map.decoration.props).toContainEqual(p);
  expect(image.name).toContain('-fallen-ancient-tree');
  expect(image.bytes).not.toEqual(beforePng.bytes);
  await expect(page.locator('forge-preview canvas')).toHaveAttribute(
    'aria-label',
    /fallen ancient tree.*four-square.*passable/i,
  );
  await page.screenshot({ path: 'artifacts/fallen-tree/workbench-desktop.png', fullPage: true });
  await page.getByLabel('World seed').fill('pending-tree-seed');
  await page.getByRole('button', { name: 'Shuffle details', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  await settled(page);
  const shuffled = await snapshot(page, 'Shuffled tree');
  expect(shuffled.map.decoration.fallenTree).toBe(true);
  expect(shuffled.map.layout).toEqual(accepted.map.layout);
  await page.getByRole('button', { name: /^Undo (shuffle|change)$/, exact: true }).click();
  await settled(page);
  expect((await png(page)).bytes).toEqual(image.bytes);
  await expect(page.getByLabel('World seed')).toHaveValue('pending-tree-seed');
  await page.getByRole('button', { name: 'Reset changes', exact: true }).click();
  await page.getByRole('button', { name: 'Export options', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export options', exact: true });
  await dialog.getByLabel('Export preset', { exact: true }).selectOption('owlbear');
  await expect(
    dialog.getByRole('img', { name: 'Full map PNG preview', exact: true }),
  ).toHaveJSProperty('naturalWidth', 2560);
  const vtt = await png(page, dialog.getByRole('button', { name: 'Download PNG', exact: true }));
  expect(vtt.size).toEqual([2560, 1920]);
  expect(vtt.name).toContain('-fallen-ancient-tree');
  expect(vtt.name).toContain('-owlbear-40x30-64px-grid-off');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: `Remove ${TREE}`, exact: true }).click();
  await apply(page);
  expect((await snapshot(page, 'Removed tree')).map).toEqual(before.map);
  expect((await png(page)).bytes).toEqual(beforePng.bytes);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup', exact: true }).click();
  const file = await pending,
    backup = await readFile(await file.path());
  expect(JSON.parse(backup.toString())).toMatchObject({
    saveFormatVersion: '28.0.0',
    maps: expect.arrayContaining([
      expect.objectContaining({ name: 'Ancient tree', map: accepted.map }),
    ]),
  });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page
    .locator('.import-label input')
    .setInputFiles({ name: 'ancient-tree.json', mimeType: 'application/json', buffer: backup });
  const card = page
    .locator('.saved-item')
    .filter({ has: page.locator('.saved-name').getByText('Ancient tree', { exact: true }) });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText(TREE);
  await settled(page);
  expect((await png(page)).bytes).toEqual(image.bytes);
});

test('historical Forest artwork stays exact through import and pending tree selection, then opts in explicitly', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('.import-label input').setInputFiles({
    name: 'forest-v3.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  const source = fixture.maps[0];
  if (!source) throw new Error('Missing old forest');
  const card = page
    .locator('.saved-item')
    .filter({ has: page.locator('.saved-name').getByText(source.name, { exact: true }) });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Forest Clearing', exact: true })).toBeVisible();
  await settled(page);
  const before = await snapshot(page, 'Old forest'),
    image = await png(page);
  expect(before.map.decoration).not.toHaveProperty('fallenTree');
  await setAddition(page, TREE);
  expect((await png(page)).bytes).toEqual(image.bytes);
  await page.getByRole('button', { name: 'Reset changes', exact: true }).click();
  await expect(page.getByRole('button', { name: `Remove ${TREE}`, exact: true })).toHaveCount(0);
  await setAddition(page, TREE);
  await apply(page);
  const accepted = await snapshot(page, 'Old forest with tree');
  expect(accepted.map.version).toBe(before.map.version);
  expect(accepted.map.layout).toEqual(before.map.layout);
  expect(accepted.map.decoration.fallenTree).toBe(true);
  expect((await png(page)).name).toContain('-fallen-ancient-tree');
});

for (const viewport of [
  { width: 320, height: 700 },
  { width: 800, height: 420 },
])
  test(`tree picker supports keyboard selection, retained drafts and export recovery at ${viewport.width} × ${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await forest(page);
    const picker = await openAdditions(page),
      checkbox = picker.getByRole('checkbox', { name: TREE, exact: true });
    await checkbox.focus();
    await page.keyboard.press('Space');
    await expect(checkbox).toBeChecked();
    await expect(
      picker
        .locator('.addition-option')
        .filter({ has: page.getByRole('checkbox', { name: TREE, exact: true }) })
        .locator('img'),
    ).toHaveJSProperty('naturalWidth', 480);
    await picker.screenshot({ path: `artifacts/fallen-tree/picker-${viewport.width}.png` });
    await picker.getByRole('button', { name: 'Done', exact: true }).click();
    await apply(page);
    await page.getByRole('radio', { name: 'Tower', exact: true }).check();
    await expect(page.getByRole('heading', { name: 'Wizard’s Tower', exact: true })).toBeVisible();
    await settled(page);
    await page.getByRole('radio', { name: 'Forest', exact: true }).check();
    await expect(page.locator('#map-summary')).toContainText(TREE);
    await settled(page);
    await setAddition(page, TREE, false);
    await page.getByRole('button', { name: 'Reset changes', exact: true }).click();
    await expect(page.getByRole('button', { name: `Remove ${TREE}`, exact: true })).toBeVisible();
    await page.screenshot({
      path: `artifacts/fallen-tree/workbench-${viewport.width}.png`,
      fullPage: true,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.evaluate(() => {
      const original = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (callback) {
        HTMLCanvasElement.prototype.toBlob = original;
        setTimeout(() => callback(null), 1500);
      };
    });
    await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Choose additions', exact: true }),
    ).toBeDisabled();
    await expect(page.getByRole('button', { name: `Remove ${TREE}`, exact: true })).toBeDisabled();
    await page.screenshot({
      path: `artifacts/fallen-tree/disabled-${viewport.width}.png`,
      fullPage: true,
    });
    await expect(page.locator('#settings-error')).toContainText('could not create a PNG');
    await expect(page.getByRole('button', { name: 'Choose additions', exact: true })).toBeEnabled();
    expect((await png(page)).name).toContain('-fallen-ancient-tree');
  });
