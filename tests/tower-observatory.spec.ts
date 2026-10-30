import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';
import { parseSavedMap, SAVE_STORAGE_KEY } from '../src/app/save/save-format';
import { openAdditions, setAddition } from './additions';

const OBS = 'Tower observatory',
  LAB = 'Alchemist’s laboratory';
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
  if (!Array.isArray(raw)) throw new Error('Missing library');
  const saved = raw.map(parseSavedMap).find((r) => r?.name === name);
  if (!saved || saved.map.type !== 'tower') throw new Error('Missing tower');
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
async function apply(page: Page, floor: number) {
  await page.getByRole('button', { name: 'Generate tower', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText(`Observatory on floor ${floor}`);
  await settled(page);
}

test('observatory and laboratory coexist as appearance drafts, survive history and backups, and export the selected accepted floor', async ({
  page,
}) => {
  test.setTimeout(60000);
  await tower(page);
  await setAddition(page, LAB);
  await page.getByRole('button', { name: 'Generate tower', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('Laboratory on floor 2');
  await settled(page);
  const before = await snapshot(page, 'Before observatory'),
    beforePng = await png(page);
  await setAddition(page, OBS);
  const floor = page.getByLabel('Observatory floor', { exact: true });
  await expect(floor).toHaveValue('4');
  await expect(floor.locator('option[value="2"]')).toBeDisabled();
  await expect(
    page.getByLabel('Laboratory floor', { exact: true }).locator('option[value="4"]'),
  ).toBeDisabled();
  expect((await snapshot(page, 'Pending observatory')).map).toEqual(before.map);
  expect((await png(page)).bytes).toEqual(beforePng.bytes);
  await apply(page, 4);
  const accepted = await snapshot(page, 'Observatory');
  expect(accepted.saveFormatVersion).toBe('16.0.0');
  expect(accepted.map.layout).toEqual(before.map.layout);
  expect(accepted.map.surfaceSeed).toBe(before.map.surfaceSeed);
  expect(accepted.map.decoration).toMatchObject({
    laboratoryFloor: 2,
    observatoryFloor: 4,
    revision: 0,
  });
  const fixed = accepted.map.decoration.props.filter((p) =>
    ['telescope', 'star_chart_table', 'instrument_cabinet', 'star_charts'].includes(p.kind),
  );
  expect(fixed).toHaveLength(4);
  const image = await png(page);
  expect(image.name).toContain('-observatory-floor-4');
  await page.screenshot({ path: 'artifacts/observatory/workbench-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Shuffle details', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  await settled(page);
  const shuffled = await snapshot(page, 'Shuffled observatory');
  for (const prop of fixed) expect(shuffled.map.decoration.props).toContainEqual(prop);
  await floor.selectOption('3');
  await page.getByRole('button', { name: 'Undo shuffle', exact: true }).click();
  await settled(page);
  expect((await png(page)).bytes).toEqual(image.bytes);
  await expect(floor).toHaveValue('3');
  await page.getByRole('button', { name: 'Export options', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export options', exact: true });
  await dialog.getByLabel('Tower floors', { exact: true }).selectOption('4');
  await expect(dialog.getByRole('img', { name: 'Floor 4 PNG preview', exact: true })).toBeVisible();
  const cropped = await png(
    page,
    dialog.getByRole('button', { name: 'Download PNG', exact: true }),
  );
  expect(cropped.size).toEqual([1024, 1152]);
  expect(cropped.name).toContain('-observatory-floor-4');
  await dialog.getByLabel('Tower floors', { exact: true }).selectOption('2');
  await expect(dialog.getByRole('img', { name: 'Floor 2 PNG preview', exact: true })).toBeVisible();
  expect(
    (await png(page, dialog.getByRole('button', { name: 'Download PNG', exact: true }))).name,
  ).not.toContain('observatory');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Reset changes', exact: true }).click();
  await expect(floor).toHaveValue('4');
  await page.getByRole('button', { name: `Remove ${OBS}`, exact: true }).click();
  await page.getByRole('button', { name: 'Generate tower', exact: true }).click();
  await expect(page.locator('#map-summary')).not.toContainText('Observatory');
  await settled(page);
  expect((await snapshot(page, 'Removed observatory')).map).toEqual(before.map);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup', exact: true }).click();
  const backup = await pending,
    bytes = await readFile(await backup.path());
  expect(JSON.parse(bytes.toString())).toMatchObject({
    saveFormatVersion: '16.0.0',
    maps: expect.arrayContaining([
      expect.objectContaining({ name: 'Observatory', map: accepted.map }),
    ]),
  });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page
    .locator('.import-label input')
    .setInputFiles({ name: 'observatory.json', mimeType: 'application/json', buffer: bytes });
  const card = page
    .locator('.saved-item')
    .filter({ has: page.locator('.saved-name').getByText('Observatory', { exact: true }) });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(floor).toHaveValue('4');
  await settled(page);
  expect((await png(page)).bytes).toEqual(image.bytes);
});

test('secret observatories stay out of player images, descriptions and filenames and appear in GM floor exports', async ({
  page,
}) => {
  await tower(page);
  await page.getByLabel('Secret portal', { exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Generate tower', exact: true }).click();
  await expect(page.getByLabel('Show secrets', { exact: true })).toBeVisible();
  await settled(page);
  const before = await snapshot(page, 'Secret tower'),
    secret = before.map.layout.floors.find((f) => f.secret);
  if (!secret) throw new Error('Missing secret floor');
  const player = await png(page);
  await setAddition(page, OBS);
  await page.getByLabel('Observatory floor', { exact: true }).selectOption(String(secret.number));
  await apply(page, secret.number);
  const hidden = await png(page);
  expect(hidden.bytes).toEqual(player.bytes);
  expect(hidden.name).not.toContain('observatory');
  await expect(page.locator('forge-preview canvas')).not.toHaveAttribute(
    'aria-label',
    /observatory/,
  );
  await page.getByLabel('Show secrets', { exact: true }).check();
  const gm = await png(page);
  expect(gm.name).toContain(`-observatory-floor-${secret.number}`);
  expect(gm.bytes).not.toEqual(player.bytes);
  await expect(page.locator('forge-preview canvas')).toHaveAttribute('aria-label', /observatory/);
  await page.getByRole('button', { name: 'Export options', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export options', exact: true });
  await dialog.getByLabel('Tower floors', { exact: true }).selectOption(String(secret.number));
  await expect(
    dialog.getByRole('img', { name: `Floor ${secret.number} PNG preview`, exact: true }),
  ).toBeVisible();
  const cropped = await png(
    page,
    dialog.getByRole('button', { name: 'Download PNG', exact: true }),
  );
  expect(cropped.name).toContain(`-observatory-floor-${secret.number}`);
  expect(cropped.name).toContain('-gm-secrets');
  await dialog.getByLabel('Show secrets', { exact: true }).uncheck();
  await expect(dialog.getByLabel('Tower floors', { exact: true })).toHaveValue('whole');
  await expect(
    dialog.getByRole('img', { name: 'Full map PNG preview', exact: true }),
  ).toBeVisible();
  expect(
    (await png(page, dialog.getByRole('button', { name: 'Download PNG', exact: true }))).name,
  ).not.toContain('observatory');
});

test('mobile observatory controls support keyboard selection, distinct defaults, retained drafts, reset and export recovery', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await tower(page);
  await setAddition(page, LAB);
  await page.getByLabel('Laboratory floor', { exact: true }).selectOption('4');
  const picker = await openAdditions(page),
    checkbox = picker.getByRole('checkbox', { name: OBS, exact: true });
  await checkbox.focus();
  await page.keyboard.press('Space');
  await expect(checkbox).toBeChecked();
  await expect(
    picker
      .locator('.addition-option')
      .filter({ has: page.getByRole('checkbox', { name: OBS, exact: true }) })
      .locator('img'),
  ).toHaveJSProperty('naturalWidth', 480);
  await picker.screenshot({ path: 'artifacts/observatory/picker-mobile.png' });
  await picker.getByRole('button', { name: 'Done', exact: true }).click();
  const floor = page.getByLabel('Observatory floor', { exact: true });
  await expect(floor).toHaveValue('3');
  await expect(floor.locator('option[value="4"]')).toBeDisabled();
  await apply(page, 3);
  await page.getByRole('radio', { name: 'Forest', exact: true }).check();
  await expect(page.getByRole('heading', { name: 'Forest Clearing', exact: true })).toBeVisible();
  await settled(page);
  await page.getByRole('radio', { name: 'Tower', exact: true }).check();
  await expect(floor).toHaveValue('3');
  await settled(page);
  await page.getByLabel(/^Floors/).selectOption('3');
  await expect(page.getByLabel('Laboratory floor', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset changes', exact: true }).click();
  await expect(page.getByLabel('Laboratory floor', { exact: true })).toHaveValue('4');
  await expect(floor).toHaveValue('3');
  await floor.focus();
  await page.screenshot({ path: 'artifacts/observatory/workbench-mobile.png', fullPage: true });
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
  await page.screenshot({ path: 'artifacts/observatory/disabled.png', fullPage: true });
  await expect(page.locator('#settings-error')).toContainText('could not create a PNG');
  await expect(floor).toBeEnabled();
  expect((await png(page)).name).toContain('-observatory-floor-3');
});
