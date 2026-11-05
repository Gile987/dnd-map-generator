import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  forestEditorFixture,
  forestGroupFixture,
  clearForest,
  acceptForest,
  validForestCommand,
} from '../scripts/forest-editor-test-support';
import { forestInstances, forestBase } from '../src/app/engine/object-editor/forest-document';
import type { ForestDocument } from '../src/app/engine/object-editor/forest-document';
import { propBounds } from '../src/app/engine/prop-footprint';
import {
  makeSavedMap,
  parseSavedMap,
  serializeBundle,
  SAVE_STORAGE_KEY,
} from '../src/app/save/save-format';
import type { Point } from '../src/app/engine/model';

async function ready(page: Page) {
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('forge-preview canvas')).toBeVisible();
}
async function openMap(page: Page, map: ForestDocument) {
  await page.goto('/');
  const saved = makeSavedMap(
    map,
    'Prepared forest',
    'data:image/png;base64,AAAA',
    'court-editor',
    '2026-11-03T12:00:00Z',
  );
  await page.locator('input[type=file]').setInputFiles({
    name: 'forest.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serializeBundle([saved])),
  });
  await expect(page.locator('.library-message .notice')).toContainText('Imported 1 map');
  await page.locator('.saved-item').getByRole('button', { name: 'Open', exact: true }).click();
  await ready(page);
  await expect(page.getByRole('button', { name: 'Edit objects', exact: true })).toBeVisible();
  await expect(page.locator('.door-controls')).toHaveCount(0);
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
  if (!Array.isArray(raw)) throw Error('Missing library');
  const saved = raw.map(parseSavedMap).find((entry) => entry?.name === name);
  if (saved?.map.type !== 'forest') throw Error('Missing saved forest');
  return saved.map;
}
async function position(page: Page, target: Point) {
  await page.getByRole('spinbutton', { name: 'Column', exact: true }).fill(String(target.x + 1));
  await page.getByRole('spinbutton', { name: 'Row', exact: true }).fill(String(target.y + 1));
}
async function png(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  const file = await pending,
    bytes = await readFile(await file.path());
  await ready(page);
  return { hash: createHash('sha256').update(bytes).digest('hex'), name: file.suggestedFilename() };
}
async function point(page: Page, p: Point, zoom = 1, pan = { x: 0, y: 0 }) {
  const canvas = page.locator('forge-preview canvas');
  await canvas.scrollIntoViewIfNeeded();
  const r = await canvas.boundingBox();
  if (!r) throw Error('Missing canvas');
  const scale = Math.min(r.width / 40, r.height / 30) * 0.94 * zoom;
  return {
    x: r.x + (r.width - 40 * scale) / 2 + pan.x + p.x * scale,
    y: r.y + (r.height - 30 * scale) / 2 + pan.y + p.y * scale,
  };
}
const objects = (page: Page) =>
  page.getByRole('combobox', { name: 'Objects on this map', exact: true });
const edit = (page: Page) =>
  page.getByRole('button', { name: 'Edit objects', exact: true }).click();

test('Forest catalog, independent movement, pending settings, pins and recoverable Generate preserve the accepted arrangement', async ({
  page,
}) => {
  const base = forestEditorFixture('Fey'),
    item = forestInstances(base).find((item) => item.prop.kind === 'boulder');
  if (!item) throw Error('Missing boulder');
  const command = validForestCommand(
    base,
    (target) => ({ kind: 'move', id: item.id, target }),
    item.prop,
  );
  if (command.kind !== 'move') throw Error('Missing move');
  await openMap(page, base);
  await page.getByRole('button', { name: 'Pin this map', exact: true }).click();
  await page.getByLabel('World seed').fill('pending-forest-layout');
  await edit(page);
  await page.getByRole('button', { name: 'Add object', exact: true }).click();
  const catalog = page.getByRole('region', { name: 'Forest object catalog', exact: true });
  await expect(catalog.locator('.object-cards button')).toHaveCount(7);
  for (const name of ['Boulder', 'Log', 'Stump', 'Bush', 'Fern', 'Mushrooms', 'Flowers'])
    await expect(catalog.getByRole('button', { name: `Add ${name}`, exact: true })).toBeVisible();
  await catalog.screenshot({ path: 'artifacts/forest-editor/Fey-catalog.png' });
  await page.getByRole('button', { name: 'Add object', exact: true }).click();
  const tree = forestInstances(base).find((item) => item.prop.kind === 'tree');
  if (!tree) throw Error('Missing tree');
  await objects(page).selectOption(tree.id);
  await expect(page.getByRole('button', { name: 'Remove object', exact: true })).toHaveCount(0);
  await expect(page.locator('.selection-label')).toContainText(
    'Trees form the fixed forest boundary',
  );
  await objects(page).selectOption(item.id);
  await position(page, tree.prop);
  await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeDisabled();
  await expect(page.locator('.placement-status')).toContainText('walkable clearing');
  await position(page, command.target);
  await page.getByRole('button', { name: 'Place object', exact: true }).click();
  const expected = acceptForest(base, command);
  expect(await snapshot(page, 'Moved boulder')).toEqual(expected);
  await expect(page.getByLabel('World seed')).toHaveValue('pending-forest-layout');
  await expect(page.getByRole('button', { name: 'Shuffle details', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Pinned', exact: true }).click();
  expect(await snapshot(page, 'Original pin')).toEqual(base);
  await expect(page.getByRole('button', { name: 'Edit objects', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Current', exact: true }).click();
  await edit(page);
  await page.getByRole('button', { name: 'Undo map change', exact: true }).click();
  expect(await snapshot(page, 'Undo boulder')).toEqual(base);
  await page.getByRole('button', { name: 'Redo map change', exact: true }).click();
  expect(await snapshot(page, 'Redo boulder')).toEqual(expected);
  await page
    .getByRole('button', { name: 'Replace customizations and generate', exact: true })
    .click();
  await ready(page);
  expect(await snapshot(page, 'Replacement')).not.toHaveProperty('objectEdits');
  await page.getByRole('button', { name: 'Undo change', exact: true }).click();
  await ready(page);
  expect(await snapshot(page, 'Recovered forest')).toEqual(expected);
});

for (const id of ['camp', 'stone-circle', 'fallen-tree'] as const) {
  test(`${id} moves through a zoomed viewport, takes four turns, and retains exact saved/exported artwork`, async ({
    page,
  }) => {
    const { base, prepared, group, target } = forestGroupFixture(id);
    await openMap(page, prepared);
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    const canvas = page.locator('forge-preview canvas');
    await canvas.focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await edit(page);
    const body = forestInstances(prepared).find(
      (item) => group.members.includes(item.id) && item.prop.blocking,
    );
    if (!body) throw Error('Missing group body');
    const b = propBounds(body.prop),
      center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    const start = await point(page, center, 1.25, { x: 40, y: 80 }),
      end = await point(
        page,
        { x: center.x + target.x - group.area.x, y: center.y + target.y - group.area.y },
        1.25,
        { x: 40, y: 80 },
      );
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 6 });
    await expect(page.locator('.placement-status')).toContainText('Valid position');
    await page.mouse.up();
    let expected = acceptForest(prepared, { kind: 'move-group', id, target });
    expect(await snapshot(page, `${id} dragged`)).toEqual(expected);
    for (const rotation of [1, 2, 3, 0] as const) {
      await objects(page).selectOption(`group-${id}`);
      await page.getByRole('button', { name: 'Rotate addition right', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: 'Place object', exact: true }).click();
      expected = acceptForest(expected, { kind: 'move-group', id, target, rotation });
      expect(await snapshot(page, `${id} turn ${rotation}`)).toEqual(expected);
    }
    await objects(page).selectOption(`group-${id}`);
    await position(page, { x: 39, y: 29 });
    await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeDisabled();
    const before = await png(page);
    expect(before.name).toContain('-customized-');
    await objects(page).selectOption(`group-${id}`);
    await page.getByRole('button', { name: 'Rotate addition right', exact: true }).click();
    await canvas.focus();
    await page.keyboard.press('Escape');
    expect(await snapshot(page, `${id} canceled`)).toEqual(expected);
    await page
      .locator('forge-object-editor')
      .screenshot({ path: `artifacts/forest-editor/${id}-controls.png` });
    await page.reload();
    await page
      .locator('.saved-item')
      .filter({ has: page.getByText(`${id} canceled`, { exact: true }) })
      .getByRole('button', { name: 'Open', exact: true })
      .click();
    await ready(page);
    expect((await png(page)).hash).toBe(before.hash);
    await edit(page);
    await page.getByRole('button', { name: 'Reset customizations', exact: true }).click();
    expect(await snapshot(page, `${id} reset`)).toEqual(base);
    await page.getByRole('button', { name: 'Undo map change', exact: true }).click();
    expect(await snapshot(page, `${id} recovered`)).toEqual(expected);
  });
}

test('Forest named layers and annotated PNG previews retain complete JSON and exact downloaded bytes', async ({
  page,
}) => {
  const prepared = clearForest(forestEditorFixture());
  const added = acceptForest(
      prepared,
      validForestCommand(prepared, (target) => ({ kind: 'add', propKind: 'boulder', target })),
    ),
    boulder = forestInstances(added).find((item) => item.id === 'added-1');
  if (!boulder) throw Error('Missing boulder');
  const flowers = acceptForest(added, { kind: 'add', propKind: 'flower', target: boulder.prop });
  await openMap(page, flowers);
  await edit(page);
  await objects(page).selectOption('added-2');
  await page.getByRole('button', { name: 'Bring forward', exact: true }).click();
  const badge = page.getByRole('button', { name: /^Flowers: Boulder underneath/ });
  await expect(badge).toHaveText('Boulder underneath');
  await badge.click();
  await page
    .getByRole('region', { name: 'Overlapping objects' })
    .getByRole('button', { name: /^Boulder · column/ })
    .click();
  await expect(objects(page)).toHaveValue('added-1');
  const before = await snapshot(page, 'Covered boulder');
  await page.getByRole('button', { name: 'Export options', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export options', exact: true }),
    toggle = dialog.getByRole('checkbox', { name: 'Show layer indicators', exact: true });
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await expect(dialog.getByRole('button', { name: 'Download PNG', exact: true })).toBeEnabled({
    timeout: 10000,
  });
  const bytes = await dialog
    .getByRole('img', { name: 'Full map PNG preview', exact: true })
    .evaluate(async (img: HTMLImageElement) =>
      Array.from(new Uint8Array(await (await fetch(img.src)).arrayBuffer())),
    );
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download PNG', exact: true }).click();
  const file = await download;
  expect(
    createHash('sha256')
      .update(await readFile(await file.path()))
      .digest('hex'),
  ).toBe(createHash('sha256').update(Buffer.from(bytes)).digest('hex'));
  expect(file.suggestedFilename()).toMatch(/-layers.png$/);
  await dialog.screenshot({ path: 'artifacts/forest-editor/annotated-export.png' });
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  expect(await snapshot(page, 'Export preserved')).toEqual(before);
  expect(forestBase(before)).toEqual(forestBase(prepared));
});

test.describe('mobile touch workspace', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, deviceScaleFactor: 2 });
  test('touch insertion, keyboard controls, named layers, pins and export failure recover', async ({
    page,
  }) => {
    const prepared = clearForest(forestEditorFixture()),
      added = acceptForest(
        prepared,
        validForestCommand(prepared, (target) => ({ kind: 'add', propKind: 'boulder', target })),
      ),
      body = forestInstances(added).find((item) => item.id === 'added-1');
    if (!body) throw Error('Missing boulder');
    const planted = acceptForest(added, { kind: 'add', propKind: 'flower', target: body.prop }),
      covered = acceptForest(planted, { kind: 'order', id: 'added-2', direction: 'forward' });
    await openMap(page, covered);
    await edit(page);
    await objects(page).selectOption('added-2');
    const back = page.getByRole('button', { name: 'Send backward', exact: true });
    await page.evaluate(() => {
      HTMLCanvasElement.prototype.toBlob = function (callback) {
        setTimeout(() => callback(null), 1200);
      };
    });
    await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
    await expect(back).toBeDisabled();
    await ready(page);
    await expect(back).toBeEnabled();
    await expect(page.locator('#settings-error')).toContainText('could not create a PNG');
    await page.getByRole('button', { name: 'Add object', exact: true }).tap();
    await page.getByRole('button', { name: 'Add Fern', exact: true }).tap();
    await position(page, body.prop);
    const place = page.getByRole('button', { name: 'Place object', exact: true });
    await place.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Pin this map', exact: true }).click();
    await page.getByRole('button', { name: 'Pinned', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit objects', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: /^Flowers: Boulder, Fern underneath/ }).tap();
    await expect(page.getByRole('region', { name: 'Overlapping objects' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page
      .locator('forge-object-editor')
      .screenshot({ path: 'artifacts/forest-editor/mobile-pinned.png' });
  });
});
