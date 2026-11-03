import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { layeredRugFixture } from '../scripts/layer-test-support';
import {
  makeSavedMap,
  serializeBundle,
  parseSavedMap,
  SAVE_STORAGE_KEY,
} from '../src/app/save/save-format';
import type { DungeonDocument } from '../src/app/engine/model';

async function ready(page: Page) {
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('forge-preview canvas')).toBeVisible();
}
async function open(page: Page, map: DungeonDocument) {
  await page.goto('/');
  const saved = makeSavedMap(
    map,
    'Layer example',
    'data:image/png;base64,AAAA',
    'layers',
    '2026-11-03T12:00:00Z',
  );
  await page.locator('input[type=file]').setInputFiles({
    name: 'layers.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serializeBundle([saved])),
  });
  await expect(page.locator('.library-message .notice')).toContainText('Imported 1 map');
  await page.locator('.saved-item').getByRole('button', { name: 'Open', exact: true }).click();
  await ready(page);
}
async function snapshot(page: Page, name: string) {
  await ready(page);
  await expect(page.locator('.library')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#save-name').fill(name);
  await page.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(page.locator('.library-message .notice')).toHaveText(`Saved “${name}”.`);
  const raw: unknown = JSON.parse(
    (await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)) ?? '[]',
  );
  if (!Array.isArray(raw)) throw Error('Missing saves');
  const saved = raw.map(parseSavedMap).find((entry) => entry?.name === name);
  if (!saved) throw Error('Missing saved example');
  return saved.map;
}
async function exportPreview(page: Page) {
  await expect(page.getByRole('button', { name: 'Download PNG', exact: true })).toBeEnabled({
    timeout: 10_000,
  });
  const hash = await page
    .getByRole('img', { name: 'Full map PNG preview', exact: true })
    .evaluate(async (img: HTMLImageElement) => {
      const bytes = await (await fetch(img.src)).arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest))
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('');
    });
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PNG', exact: true }).click();
  const file = await pending;
  const bytes = await readFile(await file.path());
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(hash);
  return { hash, name: file.suggestedFilename() };
}

test('drawing order, topmost picking, covered-object discovery, undo and saved reopening agree', async ({
  page,
}) => {
  const { prepared, covered, rug } = layeredRugFixture();
  await open(page, prepared);
  await page.getByRole('button', { name: 'Edit objects', exact: true }).click();
  const objects = page.getByRole('combobox', { name: 'Objects on this map', exact: true });
  await objects.selectOption(rug.id);
  await page.getByRole('button', { name: 'Bring forward', exact: true }).click();
  await expect(objects).toHaveValue(rug.id);
  await page.getByRole('button', { name: 'Bring forward', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bring forward', exact: true })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: /^Rug: Crate, Barrel underneath · column/ }),
  ).toBeVisible();
  await expect(page.locator('.layer-badge').filter({ hasText: 'underneath' })).toHaveText(
    'Crate + Barrel underneath',
  );
  expect(await snapshot(page, 'Covered objects')).toEqual(covered);
  await page.getByRole('button', { name: /^Rug: Crate, Barrel underneath · column/ }).click();
  const panel = page.getByRole('region', { name: 'Overlapping objects' });
  await expect(panel).toBeVisible();
  const barrel = panel.getByRole('button', { name: /^Barrel · column/ });
  await barrel.focus();
  await page.keyboard.press('Enter');
  await expect(objects).toHaveValue('added-1');
  await expect(barrel).toHaveAttribute('aria-pressed', 'true');
  await page
    .locator('forge-object-editor')
    .screenshot({ path: 'artifacts/dungeon-layers/desktop-controls.png' });
  const canvas = page.locator('forge-preview canvas');
  await canvas.scrollIntoViewIfNeeded();
  const r = await canvas.boundingBox();
  if (!r) throw Error('Missing canvas');
  const scale = Math.min(r.width / 40, r.height / 30) * 0.94;
  await page.mouse.click(
    r.x + (r.width - 40 * scale) / 2 + (rug.prop.x + 0.5) * scale,
    r.y + (r.height - 30 * scale) / 2 + (rug.prop.y + 0.5) * scale,
  );
  await expect(objects).toHaveValue(rug.id);
  await page.getByRole('button', { name: 'Undo map change', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /^Rug: Crate, Barrel underneath · column/ }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo map change', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /^Rug: Crate, Barrel underneath · column/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await canvas.scrollIntoViewIfNeeded();
  const badge = page.getByRole('button', { name: /^Rug: Crate, Barrel underneath · column/ });
  const beforePan = await badge.boundingBox();
  if (!beforePan) throw Error('Missing badge');
  await canvas.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await badge.boundingBox())?.x).toBeCloseTo(beforePan.x - 40, 1);
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await badge.click();
  await expect(panel).toBeFocused();
  await expect(panel.getByRole('button', { name: /^Barrel · column/ })).toBeVisible();
  await page
    .locator('forge-preview')
    .screenshot({ path: 'artifacts/dungeon-layers/zoomed-badge.png' });
  await page.reload();
  await page
    .locator('.saved-item')
    .filter({ has: page.getByText('Covered objects', { exact: true }) })
    .getByRole('button', { name: 'Open', exact: true })
    .click();
  await ready(page);
  await expect(
    page.getByRole('button', { name: /^Rug: Crate, Barrel underneath · column/ }),
  ).toBeVisible();
});

test('export indicators default off, update the actual downloadable preview, and leave JSON/order unchanged', async ({
  page,
}) => {
  const { covered } = layeredRugFixture();
  await open(page, covered);
  await page.getByRole('button', { name: 'Export options', exact: true }).click();
  const toggle = page.getByRole('checkbox', { name: 'Show layer indicators', exact: true });
  await expect(toggle).not.toBeChecked();
  const plain = await exportPreview(page);
  await toggle.check();
  const annotated = await exportPreview(page);
  expect(annotated.hash).not.toBe(plain.hash);
  expect(annotated.name).toMatch(/-layers.png$/);
  await page
    .getByRole('dialog', { name: 'Export options', exact: true })
    .screenshot({ path: 'artifacts/dungeon-layers/export-annotated.png' });
  await toggle.uncheck();
  expect((await exportPreview(page)).hash).toBe(plain.hash);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  expect(await snapshot(page, 'Export unchanged')).toEqual(covered);
  await page.getByRole('button', { name: 'Export options', exact: true }).click();
  await expect(toggle).not.toBeChecked();
});

test.describe('small touch screens', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, deviceScaleFactor: 2 });
  test('layer badges, selection and order controls remain keyboard accessible and pinned maps are read-only', async ({
    page,
  }) => {
    const { covered, rug } = layeredRugFixture();
    await open(page, covered);
    await page.getByRole('button', { name: /^Rug: Crate, Barrel underneath · column/ }).tap();
    const panel = page.getByRole('region', { name: 'Overlapping objects' });
    await panel.getByRole('button', { name: /^Crate · column/ }).tap();
    await page.getByRole('button', { name: 'Edit objects', exact: true }).click();
    const objects = page.getByRole('combobox', { name: 'Objects on this map', exact: true });
    await expect(objects).toHaveValue('added-2');
    await objects.selectOption(rug.id);
    const back = page.getByRole('button', { name: 'Send backward', exact: true });
    await back.focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('button', { name: /^Rug: Barrel underneath · column/ }),
    ).toBeVisible();
    await page
      .locator('.editor-inspector')
      .screenshot({ path: 'artifacts/dungeon-layers/mobile-controls.png' });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole('button', { name: 'Pin this map', exact: true }).click();
    await page.getByRole('button', { name: 'Pinned', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit objects', exact: true })).toBeDisabled();
    await expect(back).toHaveCount(0);
    await page.getByRole('button', { name: /^Rug: Barrel underneath · column/ }).tap();
    await expect(panel).toBeVisible();
    await page.locator('.layer-list summary').click();
    await expect(page.locator('.layer-list')).toContainText('Barrel underneath');
    await expect(page.locator('.layer-list')).toContainText('Rug underneath');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page
      .locator('forge-preview')
      .screenshot({ path: 'artifacts/dungeon-layers/mobile-named-badges.png' });
  });
});

test('busy export disables ordering, failure recovers controls, and delayed previews cannot download stale indicators', async ({
  page,
}) => {
  const { covered, rug } = layeredRugFixture();
  await open(page, covered);
  await page.getByRole('button', { name: 'Edit objects', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Objects on this map', exact: true })
    .selectOption(rug.id);
  const back = page.getByRole('button', { name: 'Send backward', exact: true });
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      HTMLCanvasElement.prototype.toBlob = original;
      setTimeout(() => callback(null), 1200);
    };
  });
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  await expect(back).toBeDisabled();
  await ready(page);
  await expect(back).toBeEnabled();
  await expect(page.locator('#settings-error')).toContainText('could not create a PNG');
  await page.getByRole('button', { name: 'Export options', exact: true }).click();
  await exportPreview(page);
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
      original.call(this, (blob) => setTimeout(() => callback(blob), 750), ...args);
    };
  });
  const toggle = page.getByRole('checkbox', { name: 'Show layer indicators', exact: true });
  await toggle.check();
  await expect(page.getByRole('button', { name: 'Download PNG', exact: true })).toBeDisabled();
  await toggle.uncheck();
  await expect(page.getByRole('button', { name: 'Download PNG', exact: true })).toBeDisabled();
  const result = await exportPreview(page);
  expect(result.name).not.toContain('-layers');
});
