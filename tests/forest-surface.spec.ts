import { selectCharacter } from './characters';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { parseSavedMap, SAVE_STORAGE_KEY } from '../src/app/save/save-format';
import { setAddition, selectedAddition } from './additions';

async function snapshot(page: Page, name: string) {
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.library')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#save-name').fill(name);
  await page.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(page.locator('.library-message .notice')).toHaveText(`Saved “${name}”.`);
  const raw: unknown = JSON.parse(
    (await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)) ?? '[]',
  );
  if (!Array.isArray(raw)) throw new Error('Missing library');
  const record = raw.map(parseSavedMap).find((entry) => entry?.name === name);
  if (!record || record.map.type !== 'forest') throw new Error('Missing forest');
  return record.map;
}

async function download(page: Page, label: string) {
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: label, exact: true }).click();
  const file = await pending;
  return {
    name: file.suggestedFilename(),
    bytes: await readFile(await file.path()),
    path: await file.path(),
  };
}

for (const character of ['Verdant', 'Autumn', 'Pines', 'Fey']) {
  test(`${character} historical forest survives save, shuffle undo and pin comparison with exact PNGs`, async ({
    page,
  }) => {
    await page.goto('/');
    await page.setInputFiles(
      '.import-label input',
      'src/app/save/fixtures/forest-v4-surfaces.json',
    );
    await expect(page.locator('.library-message .notice')).toHaveText('Imported 4 maps.');
    const item = page.locator('.saved-item').filter({
      has: page.locator('.saved-name').getByText(`Historical ${character} camp`, { exact: true }),
    });
    await item.getByRole('button', { name: 'Open', exact: true }).click();
    const original = await snapshot(page, 'Original forest');
    expect(original.decoration).not.toHaveProperty('forestSurface');
    expect(original.decoration.character).toBe(character);
    const before = await download(page, 'Quick export PNG');
    await page.getByRole('button', { name: 'Pin this map', exact: true }).click();
    await page.getByLabel('World seed').fill('unapplied-surface-draft');
    await page.getByRole('button', { name: 'Shuffle details', exact: true }).click();
    await expect(page.locator('#map-summary')).toContainText('r1');
    const shuffled = await snapshot(page, 'New surface forest');
    expect(shuffled.decoration).toMatchObject({
      forestSurface: 1,
      scene: 'Abandoned camp',
      landmark: 'standing-stone-circle',
      revision: 1,
    });
    expect(shuffled.layout).toEqual(original.layout);
    expect(shuffled.surfaceSeed).toBe(original.surfaceSeed);
    const after = await download(page, 'Quick export PNG');
    expect(after.bytes).not.toEqual(before.bytes);
    await page.getByRole('button', { name: 'Undo shuffle', exact: true }).click();
    await expect(page.locator('#map-summary')).toContainText('r0');
    expect(await snapshot(page, 'Restored historical forest')).toEqual(original);
    expect((await download(page, 'Quick export PNG')).bytes).toEqual(before.bytes);
    await page.getByRole('button', { name: 'Redo shuffle', exact: true }).click();
    await expect(page.locator('#map-summary')).toContainText('r1');
    expect(await snapshot(page, 'Restored surface forest')).toEqual(shuffled);
    expect((await download(page, 'Quick export PNG')).bytes).toEqual(after.bytes);
    await page.getByRole('button', { name: 'Pinned', exact: true }).click();
    expect(await snapshot(page, 'Pinned historical forest')).toEqual(original);
    expect((await download(page, 'Quick export PNG')).bytes).toEqual(before.bytes);
    await expect(page.getByLabel('World seed')).toHaveValue('unapplied-surface-draft');
  });
}

test('new forest surface art survives refresh, backup/share import and VTT exports at native resolution', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Forest', exact: true }).check();
  await selectCharacter(page, 'Autumn grove');
  await setAddition(page, 'Abandoned camp');
  await page.getByRole('button', { name: 'Generate forest', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('Abandoned camp');
  const original = await snapshot(page, 'Autumn surface camp');
  expect(original.decoration.forestSurface).toBe(1);
  const before = await download(page, 'Quick export PNG');
  const backup = await download(page, 'Download backup');
  expect(JSON.parse(backup.bytes.toString())).toMatchObject({
    saveFormatVersion: '16.0.0',
    maps: [{ map: { decoration: { forestSurface: 1 } } }],
  });
  await page.reload();
  await page.locator('.saved-item').getByRole('button', { name: 'Open', exact: true }).click();
  await expect(selectedAddition(page, 'Abandoned camp')).toBeVisible();
  expect((await download(page, 'Quick export PNG')).bytes).toEqual(before.bytes);
  const shared = await download(page, 'Export this map');
  const fresh = await browser.newPage();
  try {
    await fresh.goto('http://127.0.0.1:4200/');
    await fresh.setInputFiles('.import-label input', shared.path);
    await expect(fresh.locator('.library-message .notice')).toHaveText('Imported 1 map.');
    await fresh.locator('.saved-item').getByRole('button', { name: 'Open', exact: true }).click();
    expect(await snapshot(fresh, 'Imported surface camp')).toEqual(original);
    expect((await download(fresh, 'Quick export PNG')).bytes).toEqual(before.bytes);
    await fresh.getByRole('button', { name: 'Export options', exact: true }).click();
    const dialog = fresh.getByRole('dialog', { name: 'Export options', exact: true });
    for (const [preset, width, height] of [
      ['roll20', 2800, 2100],
      ['foundry', 4000, 3000],
    ] as const) {
      await dialog.getByRole('combobox', { name: 'Export preset' }).selectOption(preset);
      const image = dialog.getByRole('img', { name: 'Full map PNG preview' });
      await expect(image).toHaveAttribute('width', String(width));
      await expect(image).toHaveJSProperty('naturalWidth', width);
      const prepared = await image.evaluate(async (el) =>
        Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              'SHA-256',
              await (await fetch((el as HTMLImageElement).src)).arrayBuffer(),
            ),
          ),
        )
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(''),
      );
      const exported = await download(fresh, 'Download PNG');
      expect([exported.bytes.readUInt32BE(16), exported.bytes.readUInt32BE(20)]).toEqual([
        width,
        height,
      ]);
      expect(createHash('sha256').update(exported.bytes).digest('hex')).toBe(prepared);
      expect(exported.name).toContain(preset);
    }
  } finally {
    await fresh.close();
  }
});

test('surface details follow accepted character and additions while drafts, focus view and layout stay intact', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Forest', exact: true }).check();
  const original = await snapshot(page, 'Original clearing');
  const before = await download(page, 'Quick export PNG');
  await selectCharacter(page, 'Fey glade');
  await setAddition(page, 'Abandoned camp');
  expect(await snapshot(page, 'Unapplied forest choices')).toEqual(original);
  expect((await download(page, 'Quick export PNG')).bytes).toEqual(before.bytes);
  await page.getByRole('button', { name: 'Generate forest', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('Fey');
  const fey = await snapshot(page, 'Fey camp');
  expect(fey.decoration).toMatchObject({
    forestSurface: 1,
    character: 'Fey',
    scene: 'Abandoned camp',
  });
  expect(fey.layout).toEqual(original.layout);
  await setAddition(page, 'Abandoned camp', false);
  await page.getByRole('button', { name: 'Generate forest', exact: true }).click();
  const open = await snapshot(page, 'Fey clearing');
  expect(open.decoration).not.toHaveProperty('scene');
  expect(open.decoration.props.some((p) => p.kind === 'fire_ring')).toBe(false);
  expect(open.layout).toEqual(fey.layout);
  await page.getByRole('button', { name: 'Focus map', exact: true }).click();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `artifacts/forest-surface/focus-${width}.png`, fullPage: true });
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Focus map', exact: true })).toBeFocused();
  await page.screenshot({ path: 'artifacts/forest-surface/workbench-320.png', fullPage: true });
});
