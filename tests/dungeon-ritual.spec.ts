import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { selectedAddition, setAddition, openAdditions } from './additions';
import {
  makeSavedMap,
  parseSavedMap,
  serializeBundle,
  SAVE_STORAGE_KEY,
} from '../src/app/save/save-format';
import { generateDungeon } from '../src/app/engine/generate';
import { createLayout } from '../src/app/engine/topology';

async function snapshot(page: Page, name: string) {
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.library')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#save-name').fill(name);
  await page.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(page.locator('.library-message .notice')).toHaveText(`Saved “${name}”.`);
  const data: unknown = JSON.parse(
    (await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)) ?? '[]',
  );
  if (!Array.isArray(data)) throw new Error('Missing library');
  const record = data.map(parseSavedMap).find((record) => record?.name === name);
  if (!record || record.map.type !== 'dungeon') throw new Error('Missing dungeon');
  return record.map;
}

async function png(page: Page, configured = false) {
  const pending = page.waitForEvent('download');
  await page
    .getByRole('button', { name: configured ? 'Download PNG' : 'Quick export PNG', exact: true })
    .click();
  const file = await pending;
  return { name: file.suggestedFilename(), bytes: await readFile(await file.path()) };
}

test('ritual picker is illustrated and searchable, drafts stay pending, and history/removal preserve layout', async ({
  page,
}) => {
  await page.goto('/');
  const original = await snapshot(page, 'Original');
  const picker = await openAdditions(page);
  await picker.getByRole('searchbox', { name: 'Find an addition' }).fill('altar');
  const option = picker.getByRole('checkbox', { name: 'Ritual site', exact: true });
  await expect(option).toBeVisible();
  const image = picker.locator('.addition-option img');
  await expect(image).toHaveCount(1);
  expect(await image.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(480);
  await option.focus();
  await page.keyboard.press('Space');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await option.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `artifacts/ritual/picker-${width}.png`, fullPage: true });
  }
  await picker.getByRole('button', { name: 'Done', exact: true }).click();
  expect(await snapshot(page, 'Pending ritual')).toEqual(original);
  await expect(page.getByRole('region', { name: 'Pending changes', exact: true })).toContainText(
    'Ritual site',
  );
  await page.getByRole('radio', { name: 'Forest', exact: true }).check();
  const forestPicker = await openAdditions(page);
  await expect(
    forestPicker.getByRole('checkbox', { name: 'Ritual site', exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('radio', { name: 'Dungeon', exact: true }).check();
  await expect(selectedAddition(page, 'Ritual site')).toBeVisible();
  await page.getByRole('button', { name: 'Generate dungeon', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('Ritual site');
  await expect(page.locator('canvas')).toHaveAttribute('aria-label', /one-tile blocking altar/);
  const ritual = await snapshot(page, 'Ritual');
  expect(ritual.layout).toEqual(original.layout);
  expect(ritual.surfaceSeed).toBe(original.surfaceSeed);
  expect(ritual.decoration).toMatchObject({ ritual: true, revision: 0 });
  await setAddition(page, 'Ritual site', false);
  await page.getByRole('button', { name: 'Shuffle details', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  const shuffled = await snapshot(page, 'Shuffled ritual');
  expect(shuffled.decoration.ritual).toBe(true);
  await expect(selectedAddition(page, 'Ritual site')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo shuffle', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('r0');
  expect(await snapshot(page, 'Undone ritual')).toEqual(ritual);
  await page.getByRole('button', { name: 'Redo shuffle', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  expect(await snapshot(page, 'Redone ritual')).toEqual(shuffled);
  await page.getByRole('button', { name: 'Reset changes', exact: true }).click();
  await page.getByRole('radio', { name: 'Crypt', exact: true }).check();
  await page.getByRole('radio', { name: 'Cluttered', exact: true }).check();
  await page.getByRole('button', { name: 'Generate dungeon', exact: true }).click();
  const crypt = await snapshot(page, 'Crypt ritual');
  expect(crypt.decoration).toMatchObject({
    ritual: true,
    preset: 'Crypt',
    density: 'Cluttered',
    revision: 1,
  });
  expect(crypt.layout).toEqual(original.layout);
  await setAddition(page, 'Ritual site', false);
  await page.getByRole('button', { name: 'Generate dungeon', exact: true }).click();
  const removed = await snapshot(page, 'No ritual');
  expect(removed.decoration).not.toHaveProperty('ritual');
  expect(removed.decoration.props.some((p) => p.kind.startsWith('ritual_'))).toBe(false);
  expect(removed.layout).toEqual(original.layout);
  await page.screenshot({ path: 'artifacts/ritual/workbench-320.png', fullPage: true });
});

test('ritual snapshots survive refresh and single-map sharing with exact PNGs and full-resolution export', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  await setAddition(page, 'Ritual site');
  await page.getByRole('button', { name: 'Generate dungeon', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('Ritual site');
  const original = await snapshot(page, 'Portable ritual');
  const before = await png(page);
  expect(before.name).toContain('-ritual-site-');
  await page.reload();
  await page.locator('.saved-item').getByRole('button', { name: 'Open', exact: true }).click();
  await expect(selectedAddition(page, 'Ritual site')).toBeVisible();
  expect(await png(page)).toEqual(before);
  const pending = page.waitForEvent('download');
  await page
    .locator('.saved-item')
    .getByRole('button', { name: 'Export this map', exact: true })
    .click();
  const path = await (await pending).path();
  expect(JSON.parse(await readFile(path, 'utf8'))).toMatchObject({ saveFormatVersion: '11.0.0' });
  const fresh = await browser.newPage();
  try {
    await fresh.goto('http://127.0.0.1:4200/');
    await fresh.setInputFiles('.import-label input', path);
    await expect(fresh.locator('.library-message .notice')).toHaveText('Imported 1 map.');
    await fresh.locator('.saved-item').getByRole('button', { name: 'Open', exact: true }).click();
    expect(await snapshot(fresh, 'Imported ritual')).toEqual(original);
    expect(await png(fresh)).toEqual(before);
    await fresh.getByRole('button', { name: 'Export options', exact: true }).click();
    await fresh.getByRole('combobox', { name: 'Export preset' }).selectOption('foundry');
    const image = fresh.getByRole('img', { name: 'Full map PNG preview' });
    await expect(image).toHaveAttribute('width', '4000');
    const exported = await png(fresh, true);
    expect(exported.bytes.readUInt32BE(16)).toBe(4000);
    expect(exported.bytes.readUInt32BE(20)).toBe(3000);
    expect(exported.name).toContain('-ritual-site-');
  } finally {
    await fresh.close();
  }
});

test('ritual sites compose independently with the study, statue and table, and can be pinned', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#rooms').fill('8');
  for (const label of ['Forgotten study', 'Weathered statue', 'Dining table', 'Ritual site'])
    await setAddition(page, label);
  await page.getByRole('button', { name: 'Generate dungeon', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('Ritual site');
  const combined = await snapshot(page, 'All additions');
  expect(combined.decoration).toMatchObject({
    scene: 'Forgotten study',
    landmark: 'weathered-statue',
    furniture: 'dining-table',
    ritual: true,
  });
  await page.getByRole('button', { name: 'Pin this map', exact: true }).click();
  await page.getByRole('button', { name: 'Shuffle details', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  await page.getByRole('button', { name: 'Pinned', exact: true }).click();
  expect(await snapshot(page, 'Pinned ritual')).toEqual(combined);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page
      .locator('section[forge-map-panel]')
      .screenshot({ path: `artifacts/ritual/combined-${width}.png` });
  }
});

test('a ritual that cannot fit preserves the imported map and pending choice, then permits correction', async ({
  page,
}) => {
  const result = generateDungeon({
    seed: 'tiny-ritual',
    roomCount: 4,
    density: 'Sparse',
    preset: 'Mosslit',
  });
  if (!result.ok) throw new Error(result.error);
  const rooms = [
    { x: 4, y: 4 },
    { x: 20, y: 4 },
    { x: 20, y: 18 },
    { x: 4, y: 18 },
  ].map((point, id) => ({ ...point, id, width: 5, height: 4 }));
  const tiny = {
    ...result.map,
    layout: createLayout(rooms, [
      { from: 0, to: 1, bend: 'horizontal' },
      { from: 1, to: 2, bend: 'vertical' },
      { from: 2, to: 3, bend: 'horizontal' },
    ]),
    decoration: { ...result.map.decoration, props: [] },
  };
  const record = makeSavedMap(
    tiny,
    'Tiny dungeon',
    'data:image/png;base64,AAAA',
    'tiny',
    '2026-10-28T15:00:00Z',
  );
  await page.goto('/');
  await page.setInputFiles('.import-label input', {
    name: 'tiny.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serializeBundle([record])),
  });
  await expect(page.locator('.library-message .notice')).toHaveText('Imported 1 map.');
  await page.locator('.saved-item').getByRole('button', { name: 'Open', exact: true }).click();
  await setAddition(page, 'Ritual site');
  await page.getByRole('button', { name: 'Generate dungeon', exact: true }).click();
  await expect(page.locator('#settings-error')).toContainText('ritual site could not fit');
  await expect(selectedAddition(page, 'Ritual site')).toBeVisible();
  expect(await snapshot(page, 'After refusal')).toEqual(tiny);
  await page.getByLabel('World seed').fill('ritual-recovery');
  await page.getByRole('radio', { name: 'Balanced', exact: true }).check();
  await page.getByRole('button', { name: 'Generate dungeon', exact: true }).click();
  await expect(page.locator('#settings-error')).toBeEmpty();
  expect((await snapshot(page, 'Recovered ritual')).decoration.ritual).toBe(true);
});
