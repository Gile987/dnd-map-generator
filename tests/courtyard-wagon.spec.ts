import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { generateCourtyard } from '../src/app/engine/courtyard-generate';
import { makeSavedMap, parseSavedMap, SAVE_STORAGE_KEY } from '../src/app/save/save-format';
import { openAdditions, setAddition } from './additions';

const WAGON = 'Collapsed wagon';
async function settled(page: Page) {
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
}
async function courtyard(page: Page) {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Courtyard', exact: true }).check();
  await expect(page.getByRole('heading', { name: 'Ruined Courtyard', exact: true })).toBeVisible();
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
  const record = raw.map(parseSavedMap).find((r) => r?.name === name);
  if (!record || record.map.type !== 'courtyard') throw new Error('Missing courtyard');
  return { ...record, map: record.map };
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
async function apply(page: Page) {
  await page.getByRole('button', { name: 'Generate courtyard', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText(WAGON);
  await settled(page);
}

test('wagon drafts coexist with the fountain, preserve exact layouts and undo, and survive backups and PNG export', async ({
  page,
}) => {
  test.setTimeout(60000);
  await courtyard(page);
  await setAddition(page, 'Dry fountain');
  await page.getByRole('button', { name: 'Generate courtyard', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('Dry fountain');
  await settled(page);
  const before = await snapshot(page, 'Before wagon'),
    beforePng = await png(page);
  await setAddition(page, WAGON);
  await expect(page.getByRole('region', { name: 'Pending changes', exact: true })).toContainText(
    WAGON,
  );
  expect((await snapshot(page, 'Pending wagon')).map).toEqual(before.map);
  expect((await png(page)).bytes).toEqual(beforePng.bytes);
  await apply(page);
  const accepted = await snapshot(page, 'Wagon courtyard'),
    acceptedPng = await png(page);
  expect(accepted.saveFormatVersion).toBe('18.0.0');
  expect(accepted.map.layout).toEqual(before.map.layout);
  expect(accepted.map.surfaceSeed).toBe(before.map.surfaceSeed);
  expect(accepted.map.decoration).toMatchObject({ wagon: true, fountain: true, revision: 0 });
  const body = accepted.map.decoration.props.find((p) => p.kind === 'collapsed_wagon');
  expect(body).toMatchObject({ footprint: { width: 3, height: 2 }, blocking: true });
  expect([0, 1]).toContain(body?.rotation);
  expect(acceptedPng.name).toContain('-dry-fountain-collapsed-wagon');
  expect(acceptedPng.bytes).not.toEqual(beforePng.bytes);
  await expect(page.locator('forge-preview canvas')).toHaveAttribute(
    'aria-label',
    /collapsed wagon.*crate.*passable/i,
  );
  await page.screenshot({ path: 'artifacts/wagon/workbench-desktop.png', fullPage: true });
  await page.getByLabel('World seed').fill('pending-wagon-seed');
  await page.getByRole('button', { name: 'Shuffle details', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  await settled(page);
  const shuffled = await snapshot(page, 'Shuffled wagon');
  expect(shuffled.map.decoration.props.find((p) => p.kind === 'collapsed_wagon')).toEqual(body);
  await page.getByRole('button', { name: 'Undo shuffle', exact: true }).click();
  await settled(page);
  expect((await png(page)).bytes).toEqual(acceptedPng.bytes);
  await expect(page.getByLabel('World seed')).toHaveValue('pending-wagon-seed');
  await page.getByRole('button', { name: 'Reset changes', exact: true }).click();
  await page.getByRole('button', { name: 'Export options', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export options', exact: true });
  await dialog.getByLabel('Export preset', { exact: true }).selectOption('roll20');
  await expect(
    dialog.getByRole('img', { name: 'Full map PNG preview', exact: true }),
  ).toHaveJSProperty('naturalWidth', 2800);
  const vtt = await png(page, dialog.getByRole('button', { name: 'Download PNG', exact: true }));
  expect(vtt.size).toEqual([2800, 2100]);
  expect(vtt.name).toContain('-collapsed-wagon');
  expect(vtt.name).toContain('-roll20-40x30-70px-grid-off');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: `Remove ${WAGON}`, exact: true }).click();
  await page.getByRole('button', { name: 'Generate courtyard', exact: true }).click();
  await expect(page.locator('#map-summary')).not.toContainText(WAGON);
  await settled(page);
  expect((await snapshot(page, 'Removed wagon')).map).toEqual(before.map);
  expect((await png(page)).bytes).toEqual(beforePng.bytes);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup', exact: true }).click();
  const file = await pending,
    backup = await readFile(await file.path());
  expect(JSON.parse(backup.toString())).toMatchObject({
    saveFormatVersion: '18.0.0',
    maps: expect.arrayContaining([
      expect.objectContaining({ name: 'Wagon courtyard', map: accepted.map }),
    ]),
  });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page
    .locator('.import-label input')
    .setInputFiles({ name: 'wagon.json', mimeType: 'application/json', buffer: backup });
  const card = page
    .locator('.saved-item')
    .filter({ has: page.locator('.saved-name').getByText('Wagon courtyard', { exact: true }) });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText(WAGON);
  await settled(page);
  expect((await png(page)).bytes).toEqual(acceptedPng.bytes);
});

test('a format-16 courtyard keeps its original PNG until the wagon is explicitly applied', async ({
  page,
}) => {
  const r = generateCourtyard({ seed: 'fallen-crown', density: 'Balanced', fountain: true });
  if (!r.ok) throw new Error(r.error);
  const old = {
    ...makeSavedMap(
      r.map,
      'Old courtyard',
      'data:image/png;base64,AAAA',
      'old-court',
      '2026-10-30T12:00:00Z',
    ),
    saveFormatVersion: '16.0.0',
  };
  await page.goto('/');
  await page.locator('.import-label input').setInputFiles({
    name: 'old-court.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'encounter-map-forge-saves',
        saveFormatVersion: '16.0.0',
        maps: [old],
      }),
    ),
  });
  const card = page
    .locator('.saved-item')
    .filter({ has: page.locator('.saved-name').getByText('Old courtyard', { exact: true }) });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('fallen-crown');
  await settled(page);
  const before = await snapshot(page, 'Restored old courtyard'),
    image = await png(page);
  expect(before.map).toEqual(r.map);
  expect(before.map.decoration).not.toHaveProperty('wagon');
  await setAddition(page, WAGON);
  expect((await png(page)).bytes).toEqual(image.bytes);
  await page.getByRole('button', { name: 'Reset changes', exact: true }).click();
  await expect(page.getByRole('button', { name: `Remove ${WAGON}`, exact: true })).toHaveCount(0);
  await setAddition(page, WAGON);
  await apply(page);
  expect((await png(page)).bytes).not.toEqual(image.bytes);
  await page.getByRole('button', { name: `Remove ${WAGON}`, exact: true }).click();
  await page.getByRole('button', { name: 'Generate courtyard', exact: true }).click();
  await expect(page.locator('#map-summary')).not.toContainText(WAGON);
  await settled(page);
  expect((await png(page)).bytes).toEqual(image.bytes);
});

for (const viewport of [
  { width: 320, height: 700 },
  { width: 800, height: 420 },
])
  test(`wagon selection supports keyboard use, retained drafts and export recovery at ${viewport.width} × ${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await courtyard(page);
    const picker = await openAdditions(page),
      checkbox = picker.getByRole('checkbox', { name: WAGON, exact: true });
    await checkbox.focus();
    await page.keyboard.press('Space');
    await expect(checkbox).toBeChecked();
    await expect(
      picker
        .locator('.addition-option')
        .filter({ has: page.getByRole('checkbox', { name: WAGON, exact: true }) })
        .locator('img'),
    ).toHaveJSProperty('naturalWidth', 480);
    await picker.screenshot({ path: `artifacts/wagon/picker-${viewport.width}.png` });
    await picker.getByRole('button', { name: 'Done', exact: true }).click();
    await apply(page);
    await page.getByRole('radio', { name: 'Forest', exact: true }).check();
    await expect(page.getByRole('heading', { name: 'Forest Clearing', exact: true })).toBeVisible();
    await settled(page);
    await page.getByRole('radio', { name: 'Courtyard', exact: true }).check();
    await expect(page.locator('#map-summary')).toContainText(WAGON);
    await settled(page);
    await setAddition(page, WAGON, false);
    await page.getByRole('button', { name: 'Reset changes', exact: true }).click();
    await expect(page.getByRole('button', { name: `Remove ${WAGON}`, exact: true })).toBeVisible();
    await page.screenshot({
      path: `artifacts/wagon/workbench-${viewport.width}.png`,
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
    await expect(page.getByRole('button', { name: `Remove ${WAGON}`, exact: true })).toBeDisabled();
    await page.screenshot({
      path: `artifacts/wagon/disabled-${viewport.width}.png`,
      fullPage: true,
    });
    await expect(page.locator('#settings-error')).toContainText('could not create a PNG');
    await expect(page.getByRole('button', { name: 'Choose additions', exact: true })).toBeEnabled();
    expect((await png(page)).name).toContain('-collapsed-wagon');
  });
