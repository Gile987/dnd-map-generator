import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { generateCourtyard } from '../src/app/engine/courtyard-generate';
import { makeSavedMap, parseSavedMap, SAVE_STORAGE_KEY } from '../src/app/save/save-format';
import { openAdditions, setAddition } from './additions';

const WELL = 'Stone well';
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
  await expect(page.locator('#map-summary')).toContainText(WELL);
  await settled(page);
}

test('well drafts coexist with the fountain and wagon, preserve exact layouts and undo, and survive backups and PNG export', async ({
  page,
}) => {
  test.setTimeout(60000);
  await courtyard(page);
  await setAddition(page, 'Dry fountain');
  await page.getByRole('button', { name: 'Generate courtyard', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('Dry fountain');
  await settled(page);
  const before = await snapshot(page, 'Before well'),
    beforePng = await png(page);
  await setAddition(page, WELL);
  await expect(page.getByRole('region', { name: 'Pending changes', exact: true })).toContainText(
    WELL,
  );
  expect((await snapshot(page, 'Pending well')).map).toEqual(before.map);
  expect((await png(page)).bytes).toEqual(beforePng.bytes);
  await apply(page);
  const accepted = await snapshot(page, 'Well courtyard'),
    acceptedPng = await png(page);
  expect(accepted.saveFormatVersion).toBe('30.0.0');
  expect(accepted.map.layout).toEqual(before.map.layout);
  expect(accepted.map.surfaceSeed).toBe(before.map.surfaceSeed);
  expect(accepted.map.decoration).toMatchObject({
    well: true,
    fountain: true,
    revision: 0,
  });
  const body = accepted.map.decoration.props.find((p) => p.kind === 'stone_well');
  expect(body).toMatchObject({ footprint: { width: 2, height: 2 }, blocking: true, rotation: 0 });
  expect(acceptedPng.name).toContain('-dry-fountain-stone-well');
  expect(acceptedPng.bytes).not.toEqual(beforePng.bytes);
  await expect(page.locator('forge-preview canvas')).toHaveAttribute(
    'aria-label',
    /stone well blocks two by two/i,
  );
  await page.screenshot({ path: 'artifacts/well/workbench-desktop.png', fullPage: true });
  await page.getByLabel('World seed').fill('pending-well-seed');
  await page.getByRole('button', { name: 'Shuffle details', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  await settled(page);
  const shuffled = await snapshot(page, 'Shuffled well');
  expect(shuffled.map.decoration.props.find((p) => p.kind === 'stone_well')).toEqual(body);
  await page.getByRole('button', { name: /^Undo (shuffle|change)$/, exact: true }).click();
  await settled(page);
  expect((await png(page)).bytes).toEqual(acceptedPng.bytes);
  await expect(page.getByLabel('World seed')).toHaveValue('pending-well-seed');
  await setAddition(page, 'Collapsed wagon');
  await page.getByRole('button', { name: 'Generate courtyard', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('Collapsed wagon');
  expect(page.locator('#map-summary')).toContainText(WELL);
  await settled(page);
  const both = await snapshot(page, 'Well and wagon');
  expect(both.map.decoration).toMatchObject({ well: true, wagon: true });
  await page.getByRole('button', { name: `Remove ${WELL}`, exact: true }).click();
  await page.getByRole('button', { name: 'Generate courtyard', exact: true }).click();
  await expect(page.locator('#map-summary')).not.toContainText(WELL);
  await settled(page);
  const removed = await snapshot(page, 'Removed well');
  expect(removed.map.decoration).not.toHaveProperty('well');
  const strip = await png(page);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup', exact: true }).click();
  const file = await pending,
    backup = await readFile(await file.path());
  expect(JSON.parse(backup.toString())).toMatchObject({
    saveFormatVersion: '30.0.0',
    maps: expect.arrayContaining([
      expect.objectContaining({ name: 'Well courtyard', map: accepted.map }),
    ]),
  });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page
    .locator('.import-label input')
    .setInputFiles({ name: 'well.json', mimeType: 'application/json', buffer: backup });
  const card = page
    .locator('.saved-item')
    .filter({ has: page.locator('.saved-name').getByText('Well courtyard', { exact: true }) });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText(WELL);
  await settled(page);
  expect((await png(page)).bytes).not.toEqual(strip.bytes);
});

test('the illustrated picker lists the stone well with its own artwork', async ({ page }) => {
  await courtyard(page);
  const picker = await openAdditions(page);
  const checkbox = picker.getByRole('checkbox', { name: WELL, exact: true });
  await expect(checkbox).toBeVisible();
  const card = picker.locator('.addition-option', { hasText: WELL });
  await expect(card.locator('img')).toHaveJSProperty('naturalWidth', 480);
  await picker.screenshot({ path: 'artifacts/well/picker.png' });
  await checkbox.focus();
  await page.keyboard.press('Space');
  await expect(checkbox).toBeChecked();
  await picker.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('button', { name: `Remove ${WELL}`, exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Reset changes', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Generate courtyard', exact: true }),
  ).toBeDisabled();
});

test('a format-29 courtyard keeps its original PNG until the well is explicitly applied', async ({
  page,
}) => {
  const r = generateCourtyard({
    character: 'Overgrown',
    seed: 'fallen-crown',
    density: 'Balanced',
    fountain: true,
  });
  if (!r.ok) throw new Error(r.error);
  const old = {
    ...makeSavedMap(
      r.map,
      'Old courtyard',
      'data:image/png;base64,AAAA',
      'old-court',
      '2026-11-08T12:00:00Z',
    ),
    saveFormatVersion: '29.0.0',
  };
  await page.goto('/');
  await page.locator('.import-label input').setInputFiles({
    name: 'old-court.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'encounter-map-forge-saves',
        saveFormatVersion: '29.0.0',
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
  expect(before.map.decoration).not.toHaveProperty('well');
  await setAddition(page, WELL);
  expect((await png(page)).bytes).toEqual(image.bytes);
  await page.getByRole('button', { name: 'Generate courtyard', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText(WELL);
  await settled(page);
  expect((await png(page)).bytes).not.toEqual(image.bytes);
  await page.getByRole('button', { name: `Remove ${WELL}`, exact: true }).click();
  await page.getByRole('button', { name: 'Generate courtyard', exact: true }).click();
  await expect(page.locator('#map-summary')).not.toContainText(WELL);
  await settled(page);
  expect((await png(page)).bytes).toEqual(image.bytes);
});

test('well selection supports keyboard use and retained drafts on small screens', async ({
  page,
}) => {
  const viewport = { width: 320, height: 700 };
  await page.setViewportSize(viewport);
  await courtyard(page);
  const picker = await openAdditions(page),
    checkbox = picker.getByRole('checkbox', { name: WELL, exact: true });
  await checkbox.focus();
  await page.keyboard.press('Space');
  await expect(checkbox).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await picker.screenshot({ path: 'artifacts/well/picker-320.png' });
  await picker.getByRole('button', { name: 'Done', exact: true }).click();
  await apply(page);
  await page.getByRole('radio', { name: 'Forest', exact: true }).check();
  await expect(page.getByRole('heading', { name: 'Forest Clearing', exact: true })).toBeVisible();
  await settled(page);
  await page.getByRole('radio', { name: 'Courtyard', exact: true }).check();
  await expect(page.locator('#map-summary')).toContainText(WELL);
  await settled(page);
  expect((await png(page)).name).toContain('-stone-well');
});
