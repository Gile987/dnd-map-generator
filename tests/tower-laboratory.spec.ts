import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { parseSavedMap, SAVE_STORAGE_KEY } from '../src/app/save/save-format';
import { openAdditions, setAddition } from './additions';
const LAB = 'Alchemist’s laboratory';
async function settled(page: Page) {
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
}
async function tower(page: Page) {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Tower', exact: true }).check();
  await expect(page.getByRole('heading', { name: 'Wizard’s Tower', exact: true })).toBeVisible();
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
  if (!saved || saved.map.type !== 'tower') throw new Error('Missing tower');
  return { ...saved, map: saved.map };
}
async function png(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  const downloaded = await pending,
    path = await downloaded.path();
  if (!path) throw new Error('Missing PNG');
  await settled(page);
  return { name: downloaded.suggestedFilename(), bytes: await readFile(path) };
}
async function generate(page: Page) {
  await page.getByRole('button', { name: 'Generate tower', exact: true }).click();
  await settled(page);
  await expect(page.locator('#settings-error')).toHaveText('');
}

test('laboratory drafts apply without rebuilding floors and survive shuffling, backup and reopening', async ({
  page,
}) => {
  test.setTimeout(60000);
  await tower(page);
  const before = await snapshot(page, 'Before laboratory'),
    beforePng = await png(page);
  await setAddition(page, LAB);
  await expect(page.getByLabel('Laboratory floor', { exact: true })).toHaveValue('2');
  expect((await snapshot(page, 'Still before')).map).toEqual(before.map);
  expect((await png(page)).bytes.equals(beforePng.bytes)).toBe(true);
  await generate(page);
  await expect(page.locator('#map-summary')).toContainText('Laboratory on floor 2');
  const saved = await snapshot(page, 'Laboratory');
  expect(saved.map.layout).toEqual(before.map.layout);
  expect(saved.map.surfaceSeed).toBe(before.map.surfaceSeed);
  expect(saved.saveFormatVersion).toBe('15.0.0');
  const cauldron = saved.map.decoration.props.find((p) => p.kind === 'cauldron');
  expect(cauldron).toBeDefined();
  const accepted = await png(page);
  expect(accepted.name).toContain('-laboratory-floor-2');
  expect(accepted.bytes.equals(beforePng.bytes)).toBe(false);
  await page.screenshot({ path: 'artifacts/laboratory/workbench-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Shuffle details', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  await settled(page);
  const shuffled = await snapshot(page, 'Shuffled laboratory');
  expect(shuffled.map.layout).toEqual(saved.map.layout);
  expect(shuffled.map.decoration.props.find((p) => p.kind === 'cauldron')).toEqual(cauldron);
  await page.getByLabel('Laboratory floor', { exact: true }).selectOption('3');
  await page.getByRole('button', { name: 'Undo shuffle', exact: true }).click();
  await settled(page);
  expect((await png(page)).bytes.equals(accepted.bytes)).toBe(true);
  await expect(page.getByLabel('Laboratory floor', { exact: true })).toHaveValue('3');
  await page.getByRole('button', { name: 'Reset changes', exact: true }).click();
  await expect(page.getByLabel('Laboratory floor', { exact: true })).toHaveValue('2');
  await page.getByRole('button', { name: `Remove ${LAB}`, exact: true }).click();
  await expect(page.getByLabel('Laboratory floor', { exact: true })).toHaveCount(0);
  await generate(page);
  expect((await snapshot(page, 'Removed laboratory')).map).toEqual(before.map);
  const backupPending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup', exact: true }).click();
  const backup = await backupPending,
    backupBytes = await readFile(await backup.path());
  expect(JSON.parse(backupBytes.toString())).toMatchObject({
    saveFormatVersion: '15.0.0',
    maps: expect.arrayContaining([expect.objectContaining({ name: 'Laboratory', map: saved.map })]),
  });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page
    .locator('.import-label input')
    .setInputFiles({ name: 'laboratory.json', mimeType: 'application/json', buffer: backupBytes });
  const card = page
    .locator('.saved-item')
    .filter({ has: page.locator('.saved-name').getByText('Laboratory', { exact: true }) });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Open', exact: true }).click();
  await settled(page);
  await expect(page.getByLabel('Laboratory floor', { exact: true })).toHaveValue('2');
  expect((await png(page)).bytes.equals(accepted.bytes)).toBe(true);
});

test('a laboratory in the secret floor is omitted from player artwork and filenames', async ({
  page,
}) => {
  await tower(page);
  await page.getByLabel(/^Floors/).selectOption('8');
  await page.getByLabel('Secret portal', { exact: true }).selectOption('2');
  await generate(page);
  const before = await snapshot(page, 'Secret tower'),
    secret = before.map.layout.floors.find((f) => f.secret);
  if (!secret) throw new Error('Missing secret floor');
  const player = await png(page);
  await setAddition(page, LAB);
  await page.getByLabel('Laboratory floor', { exact: true }).selectOption(String(secret.number));
  await generate(page);
  const hidden = await png(page);
  expect(hidden.bytes.equals(player.bytes)).toBe(true);
  expect(hidden.name).not.toContain('laboratory');
  await expect(page.locator('forge-preview canvas')).not.toHaveAttribute(
    'aria-label',
    /laboratory/,
  );
  await page.getByLabel('Show secrets', { exact: true }).check();
  const gm = await png(page);
  expect(gm.name).toContain(`laboratory-floor-${secret.number}`);
  expect(gm.bytes.equals(player.bytes)).toBe(false);
  await expect(page.locator('forge-preview canvas')).toHaveAttribute('aria-label', /laboratory/);
  await page.getByRole('button', { name: 'Export options', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export options', exact: true });
  await dialog.getByLabel('Show secrets', { exact: true }).uncheck();
  await expect(dialog.getByRole('button', { name: 'Download PNG', exact: true })).toBeEnabled();
  const pending = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download PNG', exact: true }).click();
  const downloaded = await pending;
  expect(downloaded.suggestedFilename()).not.toContain('laboratory');
});

test('laboratory controls retain floor choices, support mobile keyboard use and recover after export failure', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await tower(page);
  await page.getByLabel(/^Floors/).selectOption('8');
  await generate(page);
  const picker = await openAdditions(page);
  const checkbox = picker.getByRole('checkbox', { name: LAB, exact: true });
  await checkbox.focus();
  await page.keyboard.press('Space');
  await expect(checkbox).toBeChecked();
  await expect(picker.locator('img')).toHaveJSProperty('naturalWidth', 480);
  await page.screenshot({ path: 'artifacts/laboratory/picker-mobile.png' });
  await picker.getByRole('button', { name: 'Done', exact: true }).click();
  const floor = page.getByLabel('Laboratory floor', { exact: true });
  await floor.selectOption('8');
  await generate(page);
  await page.getByRole('radio', { name: 'Forest', exact: true }).check();
  await expect(page.getByRole('heading', { name: 'Forest Clearing', exact: true })).toBeVisible();
  await settled(page);
  await page.getByRole('radio', { name: 'Tower', exact: true }).check();
  await expect(floor).toHaveValue('8');
  await settled(page);
  await page.getByLabel(/^Floors/).selectOption('3');
  await expect(floor).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset changes', exact: true }).click();
  await expect(floor).toHaveValue('8');
  await floor.focus();
  await page.screenshot({ path: 'artifacts/laboratory/workbench-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      HTMLCanvasElement.prototype.toBlob = original;
      setTimeout(() => callback(null), 1500);
    };
  });
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  await expect(floor).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Choose additions', exact: true })).toBeDisabled();
  await page.screenshot({ path: 'artifacts/laboratory/disabled.png', fullPage: true });
  await expect(page.locator('#settings-error')).toContainText('could not create a PNG');
  await expect(floor).toBeEnabled();
  expect((await png(page)).name).toContain('-laboratory-floor-8');
});
