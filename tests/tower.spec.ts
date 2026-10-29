import towerV1 from '../src/app/save/fixtures/tower-v1.json';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { parseSavedMap, SAVE_STORAGE_KEY } from '../src/app/save/save-format';
import { PNG } from './png';

async function settled(page: Page) {
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
}
async function selectTower(page: Page) {
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
async function png(page: Page, button = 'Quick export PNG') {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: button, exact: true }).click();
  const download = await pending;
  const path = await download.path();
  if (!path) throw new Error('Missing PNG');
  await settled(page);
  return {
    name: download.suggestedFilename(),
    size: await PNG.read(path),
    bytes: await readFile(path),
  };
}
test('tower floors, portal, drafts, exact saves, shuffle, comparison and player/GM exports work together', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto('/');
  await selectTower(page);
  const original = await snapshot(page, 'Original tower');
  expect(original.map.layout.floors).toHaveLength(4);
  await page.getByLabel(/^Floors/).selectOption('8');
  await page.getByLabel('Secret portal', { exact: true }).selectOption('3');
  expect((await snapshot(page, 'Pending tower')).map).toEqual(original.map);
  await page.getByRole('button', { name: 'Generate tower', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('8 floors');
  await settled(page);
  const accepted = await snapshot(page, 'Eight floors');
  expect(accepted.map.layout.portalFloor).toBe(3);
  await expect(page.getByLabel('Show secrets', { exact: true })).not.toBeChecked();
  await expect(page.getByLabel('Tower connections')).not.toContainText('Portal');
  const player = await png(page);
  expect(player.size).toEqual({ width: 3072, height: 3456 });
  expect(player.name).toContain('-player.png');
  await page.getByLabel('Show secrets', { exact: true }).check();
  await expect(page.getByLabel('Tower connections')).toContainText(
    'Portal P · Floor 3 ↔ Secret floor',
  );
  const gm = await png(page);
  expect(gm.size).toEqual(player.size);
  expect(gm.bytes).not.toEqual(player.bytes);
  expect(gm.name).toContain('-gm-secrets.png');
  await page.screenshot({ path: 'artifacts/tower/workbench-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Pin this map', exact: true }).click();
  await page.getByRole('button', { name: 'Shuffle details', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  await settled(page);
  const shuffled = await snapshot(page, 'Shuffled tower');
  expect(shuffled.map.layout).toEqual(accepted.map.layout);
  await page.getByRole('button', { name: 'Undo shuffle', exact: true }).click();
  await settled(page);
  expect((await snapshot(page, 'Undone tower')).map).toEqual(accepted.map);
  expect((await png(page)).bytes).toEqual(gm.bytes);
  await page.getByRole('button', { name: 'Redo shuffle', exact: true }).click();
  await settled(page);
  await page.getByRole('button', { name: 'Pinned', exact: true }).click();
  expect((await png(page)).bytes).toEqual(gm.bytes);
  await page.getByRole('button', { name: 'Export options', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export options' });
  await expect(dialog.getByLabel('Show secrets', { exact: true })).toBeChecked();
  await dialog.getByLabel('Show secrets', { exact: true }).uncheck();
  await dialog.getByLabel('Export preset', { exact: true }).selectOption('roll20');
  await expect(dialog.locator('figcaption')).toContainText('3360 × 3780');
  await expect(dialog.locator('#preset-guidance')).toContainText('48 × 54');
  const configured = await png(page, 'Download PNG');
  expect(configured.size).toEqual({ width: 3360, height: 3780 });
  expect(configured.name).toContain('-player-roll20-48x54-70px-grid-off.png');
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByLabel('Show secrets', { exact: true })).toBeChecked();
  await page.getByRole('radio', { name: 'Dungeon', exact: true }).check();
  await expect(page.getByRole('heading', { name: 'Stone Dungeon', exact: true })).toBeVisible();
  await settled(page);
  await selectTower(page);
  await page.getByLabel('World seed').fill('unfinished-tower');
  await page.getByRole('radio', { name: 'Forest', exact: true }).check();
  await expect(page.getByRole('heading', { name: 'Forest Clearing', exact: true })).toBeVisible();
  await settled(page);
  await selectTower(page);
  await expect(page.getByLabel('World seed')).toHaveValue('unfinished-tower');
  await page.reload();
  const card = page
    .locator('.saved-item')
    .filter({ has: page.locator('.saved-name').getByText('Eight floors', { exact: true }) });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Open', exact: true }).click();
  await settled(page);
  await expect(page.getByLabel(/^Floors/)).toHaveValue('8');
  await expect(page.getByLabel('Secret portal', { exact: true })).toHaveValue('3');
  await expect(page.getByLabel('Show secrets', { exact: true })).not.toBeChecked();
  expect((await png(page)).bytes).toEqual(player.bytes);
});

test('tower controls support small screens, keyboard selection and portal correction when reducing floors', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  await selectTower(page);
  const floors = page.getByLabel(/^Floors/);
  await floors.focus();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(floors).toHaveValue('8');
  await page.getByLabel('Secret portal', { exact: true }).selectOption('7');
  await page.getByRole('button', { name: 'Generate tower', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('8 floors');
  await settled(page);
  await page.getByLabel('Show secrets', { exact: true }).check();
  await page.screenshot({ path: 'artifacts/tower/workbench-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await floors.selectOption('3');
  await expect(page.getByLabel('Secret portal', { exact: true })).toHaveValue('none');
  await page.getByRole('button', { name: 'Reset changes', exact: true }).click();
  await expect(floors).toHaveValue('8');
  await expect(page.getByLabel('Secret portal', { exact: true })).toHaveValue('7');
  await page.getByRole('button', { name: 'Focus map', exact: true }).click();
  await expect(page.getByLabel('Show secrets', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Focus map', exact: true })).toBeFocused();
  await page.getByLabel('World seed').fill(' ');
  await page.getByRole('button', { name: 'Generate tower', exact: true }).click();
  await expect(page.locator('#settings-error')).toContainText('Enter a world seed');
  await page.getByRole('button', { name: 'Reset changes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Generate tower', exact: true })).toBeDisabled();
});

test('tower export failure restores disabled controls and keeps the accepted tower and pending settings', async ({
  page,
}) => {
  await page.goto('/');
  await selectTower(page);
  await page.getByLabel('World seed').fill('pending-tower');
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      HTMLCanvasElement.prototype.toBlob = original;
      setTimeout(() => callback(null), 1500);
      void type;
      void quality;
    };
  });
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  await expect(page.getByLabel(/^Floors/)).toBeDisabled();
  await expect(page.getByLabel('Staircase style', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Secret portal', { exact: true })).toBeDisabled();
  await expect(page.getByRole('radio', { name: 'Tower', exact: true })).toBeDisabled();
  await page.screenshot({ path: 'artifacts/tower/disabled.png', fullPage: true });
  await expect(page.locator('#settings-error')).toContainText('could not create a PNG');
  await expect(page.getByLabel(/^Floors/)).toBeEnabled();
  await expect(page.getByLabel('World seed')).toHaveValue('pending-tower');
  const recovered = await png(page);
  expect(recovered.size).toEqual({ width: 2048, height: 2304 });
  expect(recovered.name).toContain('astral-watch');
  await page.getByRole('button', { name: 'Generate tower', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('pending-tower');
});

test('tower export secrets and sheet guidance fit narrow, tablet and short dialogs', async ({
  page,
}) => {
  await page.goto('/');
  await selectTower(page);
  await page.getByLabel(/^Floors/).selectOption('8');
  await page.getByLabel('Secret portal', { exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Generate tower', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('8 floors');
  await settled(page);
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 800, height: 420 },
  ]) {
    await page.setViewportSize(viewport);
    await page.getByRole('button', { name: 'Export options', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Export options', exact: true });
    await expect(dialog.getByRole('img')).toHaveJSProperty('naturalWidth', 3072);
    await expect(dialog.locator('#export-scale')).toContainText('48 × 54');
    const secrets = dialog.getByLabel('Show secrets', { exact: true });
    await secrets.focus();
    await page.keyboard.press('Space');
    await expect(secrets).toBeChecked();
    await expect(dialog.getByRole('button', { name: 'Download PNG', exact: true })).toBeEnabled();
    const bounds = await dialog.boundingBox();
    if (!bounds) throw new Error('Missing dialog');
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({ path: `artifacts/tower/export-${viewport.width}.png` });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Export options', exact: true })).toBeFocused();
  }
});

test('new seeds vary the shared stairwell, portal endpoints and secret floor, including a top-floor source', async ({
  page,
}) => {
  await page.goto('/');
  await selectTower(page);
  await page.getByLabel(/^Floors/).selectOption('8');
  await page.getByLabel('Secret portal', { exact: true }).selectOption('8');
  const sites = new Set<string>(),
    destinations = new Set<number>(),
    portals = new Set<string>();
  for (const seed of ['connections-a', 'connections-b', 'connections-c', 'connections-d']) {
    await page.getByLabel('World seed').fill(seed);
    await page.getByRole('button', { name: 'Generate tower', exact: true }).click();
    await expect(page.locator('#map-summary')).toContainText(seed);
    await settled(page);
    const saved = await snapshot(page, seed),
      map = saved.map;
    expect(map.version).toBe('3.0.0');
    const secret = map.layout.floors.find((f) => f.secret),
      portal = map.layout.connections.find((c) => c.kind === 'portal');
    if (!secret || !portal) throw new Error('Missing portal');
    expect(secret.number).not.toBe(1);
    expect(secret.number).not.toBe(8);
    expect(portal.from).toBe(8);
    expect(portal.to).toBe(secret.number);
    destinations.add(secret.number);
    portals.add(JSON.stringify([portal.departure, portal.arrival]));
    for (const floor of map.layout.floors.filter((f) => !f.secret)) {
      const points = map.layout.connections
        .filter((c) => c.kind === 'stairs')
        .flatMap((c) =>
          c.from === floor.number ? [c.departure] : c.to === floor.number ? [c.arrival] : [],
        );
      expect(new Set(points.map((p) => `${p.x},${p.y}`)).size).toBe(1);
      const p = points[0];
      if (p) sites.add(`${p.x - floor.x},${p.y - floor.y}`);
    }
    await page.getByLabel('Show secrets', { exact: true }).check();
    await expect(page.getByLabel('Tower connections')).toContainText(
      `Portal P · Floor 8 ↔ Secret floor ${secret.number}`,
    );
    await page.screenshot({ path: `artifacts/tower/${seed}-workbench.png`, fullPage: true });
  }
  expect(sites.size).toBeGreaterThan(1);
  expect(destinations.size).toBeGreaterThan(1);
  expect(portals.size).toBeGreaterThan(1);
  const accepted = await snapshot(page, 'Accepted source eight');
  await page.getByRole('radio', { name: 'Sparse', exact: true }).check();
  await page.getByRole('button', { name: 'Generate tower', exact: true }).click();
  await settled(page);
  expect((await snapshot(page, 'Sparse source eight')).map.layout).toEqual(accepted.map.layout);
  await page.getByLabel(/^Floors/).selectOption('3');
  await expect(page.getByLabel('Secret portal', { exact: true })).toHaveValue('none');
  await page.getByRole('button', { name: 'Reset changes', exact: true }).click();
  await expect(page.getByLabel('Secret portal', { exact: true })).toHaveValue('8');
});

test('original Tower-v1 saves retain their old connections, artwork and undo behavior in the browser', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('.import-label input').setInputFiles({
    name: 'tower-v1.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(towerV1)),
  });
  const card = page
    .locator('.saved-item')
    .filter({ has: page.getByText('Tower v1 4', { exact: true }) });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Wizard’s Tower', exact: true })).toBeVisible();
  await settled(page);
  const original = await snapshot(page, 'Legacy tower');
  expect(original.map).toEqual(towerV1.maps[0]?.map);
  await page.getByLabel('Show secrets', { exact: true }).check();
  const before = await png(page);
  expect(before.name).toContain('-v1.0.0-gm-secrets.png');
  await page.getByRole('button', { name: 'Shuffle details', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('r2');
  await settled(page);
  const shuffled = await snapshot(page, 'Legacy shuffled');
  expect(shuffled.map.version).toBe('1.0.0');
  expect(shuffled.map.layout).toEqual(original.map.layout);
  await page.getByRole('button', { name: 'Undo shuffle', exact: true }).click();
  await settled(page);
  expect((await png(page)).bytes).toEqual(before.bytes);
  await page.getByLabel('World seed').fill('updated-tower');
  await page.getByRole('button', { name: 'Generate tower', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('updated-tower');
  await settled(page);
  expect((await snapshot(page, 'New generation')).map.version).toBe('3.0.0');
});

test('staircase style is a pending choice and both drawings survive saves, history, exports and reset', async ({
  page,
}) => {
  await page.goto('/');
  await selectTower(page);
  const style = page.getByLabel('Staircase style', { exact: true });
  await expect(style).toHaveValue('spiral');
  const initial = await snapshot(page, 'Shared original');
  const spiral = await png(page);
  expect(spiral.name).toContain('-spiral-');
  await style.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(style).toHaveValue('separate');
  await expect(page.locator('.pending-settings')).toContainText('Staircase style');
  expect((await snapshot(page, 'Still shared')).map).toEqual(initial.map);
  expect((await png(page)).bytes).toEqual(spiral.bytes);
  await page.getByRole('radio', { name: 'Forest', exact: true }).check();
  await expect(page.getByRole('heading', { name: 'Forest Clearing', exact: true })).toBeVisible();
  await settled(page);
  await selectTower(page);
  await expect(style).toHaveValue('separate');
  await page.getByRole('button', { name: 'Reset changes', exact: true }).click();
  await expect(style).toHaveValue('spiral');
  await style.selectOption('separate');
  await page.getByRole('button', { name: 'Generate tower', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('Separate stairs');
  await settled(page);
  const separate = await snapshot(page, 'Separate accepted');
  expect(separate.map.layout.stairStyle).toBe('separate');
  expect(separate.map.version).toBe('3.0.0');
  const straight = await png(page);
  expect(straight.name).toContain('-separate-');
  expect(straight.bytes).not.toEqual(spiral.bytes);
  for (const floor of separate.map.layout.floors.slice(1, -1)) {
    const points = separate.map.layout.connections.flatMap((c) =>
      c.kind !== 'stairs'
        ? []
        : c.from === floor.number
          ? [c.departure]
          : c.to === floor.number
            ? [c.arrival]
            : [],
    );
    expect(new Set(points.map((p) => `${p.x},${p.y}`)).size).toBe(2);
  }
  await page.screenshot({ path: 'artifacts/tower/separate-stairs-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Shuffle details', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  await settled(page);
  expect((await snapshot(page, 'Separate shuffled')).map.layout).toEqual(separate.map.layout);
  await style.selectOption('spiral');
  await page.getByRole('button', { name: 'Undo shuffle', exact: true }).click();
  await settled(page);
  expect((await png(page)).bytes).toEqual(straight.bytes);
  await expect(style).toHaveValue('spiral');
  await page.reload();
  const card = page
    .locator('.saved-item')
    .filter({ has: page.getByText('Separate accepted', { exact: true }) });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Wizard’s Tower', exact: true })).toBeVisible();
  await settled(page);
  await expect(style).toHaveValue('separate');
  expect((await png(page)).bytes).toEqual(straight.bytes);
  await page.setViewportSize({ width: 320, height: 700 });
  await style.focus();
  await page.screenshot({ path: 'artifacts/tower/stair-style-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await style.selectOption('spiral');
  await page.getByRole('button', { name: 'Generate tower', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('Shared spiral');
  await settled(page);
  expect((await snapshot(page, 'Shared again')).map.layout.stairStyle).toBe('spiral');
});
