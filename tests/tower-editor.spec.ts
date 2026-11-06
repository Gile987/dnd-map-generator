import { editableTowerStairs } from '../src/app/engine/object-editor/tower-stairs';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  towerStairFixture,
  towerEditorFixture,
  towerGroupFixture,
  clearTower,
  acceptTower,
  validTowerCommand,
} from '../scripts/tower-editor-test-support';
import { towerInstances } from '../src/app/engine/object-editor/tower-document';
import type { TowerDocument } from '../src/app/engine/object-editor/tower-document';
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
async function openMap(page: Page, map: TowerDocument) {
  await page.goto('/');
  const saved = makeSavedMap(
    map,
    'Prepared tower',
    'data:image/png;base64,AAAA',
    'court-editor',
    '2026-11-03T12:00:00Z',
  );
  await page.locator('input[type=file]').setInputFiles({
    name: 'tower.json',
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
  if (saved?.map.type !== 'tower') throw Error('Missing saved tower');
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
  const scale = Math.min(r.width / 48, r.height / 54) * 0.94 * zoom;
  return {
    x: r.x + (r.width - 48 * scale) / 2 + pan.x + p.x * scale,
    y: r.y + (r.height - 54 * scale) / 2 + pan.y + p.y * scale,
  };
}
const objects = (page: Page) =>
  page.getByRole('combobox', { name: 'Objects on this map', exact: true });
const edit = (page: Page) =>
  page.getByRole('button', { name: 'Edit objects', exact: true }).click();

const floors = (page: Page) => page.getByRole('combobox', { name: 'Editing floor', exact: true });
const secrets = (page: Page) => page.getByRole('checkbox', { name: 'Show secrets', exact: true });

test('Tower catalog and last-floor placement retain pending settings, per-floor ownership, pins and recoverable Generate', async ({
  page,
}) => {
  const base = towerEditorFixture({ portalFloor: null }),
    prepared = clearTower(base),
    command = validTowerCommand(prepared, 8, (target) => ({
      kind: 'add',
      propKind: 'crate',
      target,
      floor: 8,
    }));
  if (command.kind !== 'add') throw Error('Missing add');
  await openMap(page, prepared);
  await page.getByRole('button', { name: 'Pin this map', exact: true }).click();
  await page.getByLabel('World seed').fill('pending-tower-layout');
  await edit(page);
  await floors(page).selectOption('8');
  await page.getByRole('button', { name: 'Add object', exact: true }).click();
  const catalog = page.getByRole('region', { name: 'Tower object catalog', exact: true });
  await expect(catalog.locator('.object-cards button')).toHaveCount(10);
  await catalog.getByRole('button', { name: 'Add Crate', exact: true }).click();
  await position(page, command.target);
  await expect(page.getByRole('spinbutton', { name: 'Column', exact: true })).toHaveAttribute(
    'max',
    '48',
  );
  await expect(page.getByRole('spinbutton', { name: 'Row', exact: true })).toHaveAttribute(
    'max',
    '54',
  );
  await page.getByRole('button', { name: 'Place object', exact: true }).click();
  const expected = acceptTower(prepared, command);
  expect(await snapshot(page, 'Added on floor eight')).toEqual(expected);
  await objects(page).selectOption('added-1');
  const other = validTowerCommand(prepared, 1, (target) => ({
    kind: 'add',
    propKind: 'crate',
    target,
  }));
  if (other.kind !== 'add') throw Error('Missing placement');
  await position(page, other.target);
  await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeDisabled();
  await expect(page.locator('.placement-status')).toContainText('floor 8');
  await page.getByRole('button', { name: 'Focus floor', exact: true }).click();
  await expect
    .poll(async () => Number((await page.getByLabel('Zoom level').textContent())?.replace('%', '')))
    .toBeGreaterThan(100);
  await page
    .locator('forge-object-editor')
    .screenshot({ path: 'artifacts/tower-editor/floor-eight-focused.png' });
  await expect(page.getByLabel('World seed')).toHaveValue('pending-tower-layout');
  await expect(page.getByRole('button', { name: 'Shuffle details', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Pinned', exact: true }).click();
  expect(await snapshot(page, 'Original Tower pin')).toEqual(prepared);
  await expect(page.getByRole('button', { name: 'Edit objects', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Current', exact: true }).click();
  await edit(page);
  await page.getByRole('button', { name: 'Undo map change', exact: true }).click();
  expect(await snapshot(page, 'Undone Tower')).toEqual(prepared);
  await page.getByRole('button', { name: 'Redo map change', exact: true }).click();
  expect(await snapshot(page, 'Redone Tower')).toEqual(expected);
  await page
    .getByRole('button', { name: 'Replace customizations and generate', exact: true })
    .click();
  await ready(page);
  expect(await snapshot(page, 'Tower replacement')).not.toHaveProperty('objectEdits');
  await page.getByRole('button', { name: 'Undo change', exact: true }).click();
  expect(await snapshot(page, 'Tower recovered')).toEqual(expected);
});

for (const id of ['laboratory', 'observatory'] as const)
  test(`${id} drags and turns as a complete same-floor group with saved/PNG parity`, async ({
    page,
  }) => {
    const { base, prepared, group, target, floor } = towerGroupFixture(id);
    await openMap(page, prepared);
    await secrets(page).check();
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await page.locator('forge-preview canvas').focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await edit(page);
    const body = towerInstances(prepared).find(
      (i) => group.members.includes(i.id) && i.prop.blocking,
    );
    if (!body) throw Error('Missing group body');
    const b = propBounds(body.prop),
      center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    const start = await point(page, center, 1.25, { x: 40, y: 80 }),
      end = await point(
        page,
        {
          x: center.x + target.x - group.area.x,
          y: center.y + target.y - group.area.y,
        },
        1.25,
        { x: 40, y: 80 },
      );
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 6 });
    await expect(page.locator('.placement-status')).toContainText('Valid position');
    await page.mouse.up();
    let expected = acceptTower(prepared, { kind: 'move-group', id, target });
    expect(await snapshot(page, `${id} dragged`)).toEqual(expected);
    await expect(floors(page)).toHaveValue(String(floor.number));
    for (const rotation of [1, 2, 3, 0] as const) {
      await objects(page).selectOption(`group-${id}`);
      await page.getByRole('button', { name: 'Rotate addition right', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: 'Place object', exact: true }).click();
      expected = acceptTower(expected, { kind: 'move-group', id, target, rotation });
      expect(await snapshot(page, `${id} turn ${rotation}`)).toEqual(expected);
    }
    await objects(page).selectOption(`group-${id}`);
    await page.getByRole('button', { name: 'Rotate addition right', exact: true }).click();
    await page.locator('forge-preview canvas').focus();
    await page.keyboard.press('Escape');
    expect(await snapshot(page, `${id} canceled`)).toEqual(expected);
    await page.getByRole('button', { name: 'Focus floor', exact: true }).click();
    await page
      .locator('forge-object-editor')
      .screenshot({ path: `artifacts/tower-editor/${id}-controls.png` });
    const before = await png(page);
    expect(before.name).toContain('-customized-');
    await page.reload();
    await page
      .locator('.saved-item')
      .filter({ has: page.getByText(`${id} canceled`, { exact: true }) })
      .getByRole('button', { name: 'Open', exact: true })
      .click();
    await ready(page);
    await secrets(page).check();
    expect((await png(page)).hash).toBe(before.hash);
    await edit(page);
    await floors(page).selectOption(String(floor.number));
    await page.getByRole('button', { name: 'Reset customizations', exact: true }).click();
    expect(await snapshot(page, `${id} reset`)).toEqual(base);
    await page.getByRole('button', { name: 'Undo map change', exact: true }).click();
    expect(await snapshot(page, `${id} recovered`)).toEqual(expected);
  });

test('turning off secrets cancels placement and removes hidden objects, group choices and named layer details', async ({
  page,
}) => {
  const base = towerEditorFixture(),
    prepared = clearTower(base),
    floor = base.layout.floors.find((f) => f.secret);
  if (!floor) throw Error('Missing secret floor');
  const command = validTowerCommand(prepared, floor.number, (target) => ({
    kind: 'add',
    propKind: 'crate',
    target,
  }));
  if (command.kind !== 'add') throw Error('Missing add');
  const box = acceptTower(prepared, command),
    moss = acceptTower(box, { kind: 'add', propKind: 'moss', target: command.target }),
    covered = acceptTower(moss, { kind: 'order', id: 'added-2', direction: 'forward' });
  await openMap(page, covered);
  const editor = page.locator('forge-object-editor');
  const editButton = page.getByRole('button', { name: 'Edit objects', exact: true });
  const requirement = editor.locator('#object-editor-state');
  await expect(editButton).toBeDisabled();
  await expect(requirement).toHaveText('Enable Show secrets above the map to edit objects.');
  await expect(editButton).toHaveAccessibleDescription(
    'Enable Show secrets above the map to edit objects.',
  );
  await expect(editor.locator('.layer-badge')).toHaveCount(0);
  const player = await png(page);
  await secrets(page).check();
  await expect(editButton).toBeEnabled();
  await expect(requirement).not.toContainText('Enable Show secrets');
  const gm = await png(page);
  expect(gm.hash).not.toBe(player.hash);
  await edit(page);
  await floors(page).selectOption(String(floor.number));
  await page.getByRole('button', { name: 'Focus floor', exact: true }).click();
  const badge = page.getByRole('button', { name: /^Moss: Crate underneath/ });
  await badge.click();
  await expect(page.getByRole('region', { name: 'Overlapping objects' })).toBeVisible();
  await page
    .getByRole('region', { name: 'Overlapping objects' })
    .getByRole('button', { name: /^Crate · column/ })
    .click();
  await expect(objects(page)).toHaveValue('added-1');
  await position(page, command.target);
  await secrets(page).uncheck();
  await expect(page.getByRole('button', { name: 'Edit objects', exact: true })).toBeDisabled();
  await expect(editor.locator('.layer-badge')).toHaveCount(0);
  await expect(editor.locator('.layer-details')).toHaveCount(0);
  await expect(editor.locator('.placement-status')).toHaveCount(0);
  await expect(objects(page)).toHaveCount(0);
  await expect(floors(page)).toHaveCount(0);
  await expect(requirement).toHaveText('Enable Show secrets above the map to edit objects.');
  await editor
    .locator('.editor-toolbar')
    .screenshot({ path: 'artifacts/tower-editor/edit-requirement-desktop.png' });
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(requirement).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await editor
    .locator('.editor-toolbar')
    .screenshot({ path: 'artifacts/tower-editor/edit-requirement-mobile.png' });
  await secrets(page).focus();
  await page.keyboard.press('Space');
  await expect(editButton).toBeEnabled();
  await expect(requirement).not.toContainText('Enable Show secrets');
  await page.keyboard.press('Space');
  await expect(editButton).toBeDisabled();
  await expect(editButton).toHaveAccessibleDescription(
    'Enable Show secrets above the map to edit objects.',
  );
  expect((await png(page)).hash).toBe(player.hash);
  expect(await snapshot(page, 'Secrets safely retained')).toEqual(covered);
  await editor.screenshot({ path: 'artifacts/tower-editor/player-view.png' });
});

test('annotated Tower exports respect player/GM floor choices and download the exact prepared image', async ({
  page,
}) => {
  const base = towerEditorFixture(),
    prepared = clearTower(base),
    secret = base.layout.floors.find((f) => f.secret);
  if (!secret) throw Error('Missing secret floor');
  const command = validTowerCommand(prepared, secret.number, (target) => ({
    kind: 'add',
    propKind: 'crate',
    target,
  }));
  if (command.kind !== 'add') throw Error('Missing add');
  const box = acceptTower(prepared, command),
    moss = acceptTower(box, { kind: 'add', propKind: 'moss', target: command.target }),
    covered = acceptTower(moss, { kind: 'order', id: 'added-2', direction: 'forward' });
  await openMap(page, covered);
  await page.getByRole('button', { name: 'Export options', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export options', exact: true });
  await dialog.getByRole('checkbox', { name: 'Show layer indicators', exact: true }).check();
  const selector = dialog.getByRole('combobox', { name: 'Tower floors', exact: true });
  await expect(selector.locator(`option[value="${secret.number}"]`)).toHaveCount(0);
  await dialog.getByRole('checkbox', { name: 'Show secrets', exact: true }).check();
  await selector.selectOption(String(secret.number));
  await expect(dialog.getByRole('button', { name: 'Download PNG', exact: true })).toBeEnabled({
    timeout: 10000,
  });
  const image = dialog.getByRole('img'),
    bytes = await image.evaluate(async (img: HTMLImageElement) =>
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
  expect(file.suggestedFilename()).toContain(`floor-${secret.number}`);
  expect(file.suggestedFilename()).toMatch(/-layers.png$/);
  await dialog.screenshot({ path: 'artifacts/tower-editor/secret-floor-export.png' });
  await dialog.getByRole('checkbox', { name: 'Show secrets', exact: true }).uncheck();
  await expect(selector).toHaveValue('whole');
  await expect(selector.locator(`option[value="${secret.number}"]`)).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  expect(await snapshot(page, 'Export unchanged')).toEqual(covered);
});

test.describe('mobile Tower workspace', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, deviceScaleFactor: 2 });
  test('floor focus, touch catalog, keyboard placement, pinned controls and export failure recover', async ({
    page,
  }) => {
    const base = towerEditorFixture({ portalFloor: null }),
      prepared = clearTower(base),
      command = validTowerCommand(prepared, 8, (target) => ({
        kind: 'add',
        propKind: 'moss',
        target,
        floor: 8,
      }));
    if (command.kind !== 'add') throw Error('Missing add');
    await openMap(page, prepared);
    await edit(page);
    await floors(page).selectOption('8');
    await page.getByRole('button', { name: 'Focus floor', exact: true }).tap();
    await page.getByRole('button', { name: 'Add object', exact: true }).tap();
    await page.getByRole('button', { name: 'Add Moss', exact: true }).tap();
    await position(page, command.target);
    await page.getByRole('button', { name: 'Place object', exact: true }).focus();
    await page.keyboard.press('Enter');
    const expected = acceptTower(prepared, command);
    expect(await snapshot(page, 'Mobile floor eight')).toEqual(expected);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page
      .locator('forge-object-editor')
      .screenshot({ path: 'artifacts/tower-editor/mobile-editing.png' });
    await objects(page).selectOption('added-1');
    await page.evaluate(() => {
      HTMLCanvasElement.prototype.toBlob = function (callback) {
        setTimeout(() => callback(null), 1200);
      };
    });
    await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Focus floor', exact: true })).toBeDisabled();
    await ready(page);
    await expect(page.getByRole('button', { name: 'Focus floor', exact: true })).toBeEnabled();
    await expect(page.locator('#settings-error')).toContainText('could not create a PNG');
    await page.getByRole('button', { name: 'Pin this map', exact: true }).click();
    await page.getByRole('button', { name: 'Pinned', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit objects', exact: true })).toBeDisabled();
    expect(await snapshot(page, 'Pinned mobile Tower')).toEqual(expected);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page
      .locator('forge-object-editor')
      .screenshot({ path: 'artifacts/tower-editor/mobile-pinned.png' });
  });
});

for (const style of ['spiral', 'separate'] as const)
  test(`${style} stairs drag with their labels, save and reopen exactly, and undo without changing routes`, async ({
    page,
  }) => {
    const { prepared, stair, command, moved } = towerStairFixture(style);
    await openMap(page, prepared);
    const original = await png(page);
    await edit(page);
    await floors(page).selectOption(String(stair.floor));
    await objects(page).selectOption(stair.id);
    await expect(page.getByRole('group', { name: 'Drawing order', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Remove object', exact: true })).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Rotate addition right', exact: true }),
    ).toHaveCount(0);
    // Invalid coordinates stay staged and leave history and accepted data alone.
    await position(page, { x: 0, y: 0 });
    await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeDisabled();
    await page.locator('forge-preview canvas').focus();
    await page.keyboard.press('Escape');
    const start = await point(page, { x: stair.x + 0.5, y: stair.y + 0.5 }),
      end = await point(page, { x: command.target.x + 0.5, y: command.target.y + 0.5 });
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 6 });
    await expect(page.locator('.placement-status')).toContainText('Valid position');
    await page
      .locator('forge-object-editor')
      .screenshot({ path: `artifacts/tower-editor/${style}-stairs-ghost.png` });
    await page.mouse.up();
    expect(await snapshot(page, `${style} stairs moved`)).toEqual(moved);
    const exported = await png(page);
    expect(exported.hash).not.toBe(original.hash);
    await page.getByRole('button', { name: 'Undo map change', exact: true }).click();
    expect((await png(page)).hash).toBe(original.hash);
    await page.getByRole('button', { name: 'Redo map change', exact: true }).click();
    expect((await png(page)).hash).toBe(exported.hash);
    // A crate can occupy the vacated landing, including after a JSON round trip.
    await page.getByRole('button', { name: 'Add object', exact: true }).click();
    await page.getByRole('button', { name: 'Add Crate', exact: true }).click();
    await position(page, stair);
    await page.getByRole('button', { name: 'Place object', exact: true }).click();
    const withBox = acceptTower(moved, { kind: 'add', propKind: 'crate', target: stair });
    expect(await snapshot(page, `${style} usable old landing`)).toEqual(withBox);
    await page.reload();
    await ready(page);
    await page
      .locator('.saved-item')
      .filter({ has: page.getByText(`${style} usable old landing`, { exact: true }) })
      .getByRole('button', { name: 'Open', exact: true })
      .click();
    await ready(page);
    expect(await snapshot(page, `${style} reopened stairs`)).toEqual(withBox);
    await edit(page);
    await floors(page).selectOption(String(stair.floor));
    await objects(page).selectOption(stair.id);
    await page.getByRole('button', { name: 'Focus floor', exact: true }).click();
    await page
      .locator('forge-object-editor')
      .screenshot({ path: `artifacts/tower-editor/${style}-stairs-accepted.png` });
  });

test.describe('mobile stair editing', () => {
  test.use({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true });
  test('stairs are discoverable by floor and movable with touch controls and keyboard', async ({
    page,
  }) => {
    const { prepared, stair, command, moved } = towerStairFixture('spiral', 8);
    await openMap(page, prepared);
    await edit(page);
    await floors(page).selectOption('8');
    await objects(page).selectOption(stair.id);
    await page.getByRole('button', { name: 'Focus floor', exact: true }).tap();
    await position(page, command.target);
    await page.getByRole('button', { name: 'Place object', exact: true }).focus();
    await page.keyboard.press('Enter');
    expect(await snapshot(page, 'Mobile staircase')).toEqual(moved);
    await objects(page).selectOption(stair.id);
    await page.getByRole('button', { name: 'Move right', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Cancel placement', exact: true })).toBeEnabled();
    await page.locator('forge-preview canvas').focus();
    await page.keyboard.press('Escape');
    expect(await snapshot(page, 'Mobile stair canceled')).toEqual(moved);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page
      .locator('forge-object-editor')
      .screenshot({ path: 'artifacts/tower-editor/mobile-stairs.png' });
  });
});

test('a clear stair destination is accepted beside furniture below its visible caption', async ({
  page,
}) => {
  const base = towerEditorFixture({
      portalFloor: null,
      laboratoryFloor: undefined,
      observatoryFloor: undefined,
    }),
    prepared = clearTower(base),
    stair = editableTowerStairs(prepared).find((s) => s.floor === 1);
  if (!stair) throw Error('Missing stairs');
  const target = { x: 8, y: 10 },
    adjacent = { x: 8, y: 13 },
    occupied = acceptTower(prepared, { kind: 'add', propKind: 'barrel', target: adjacent }),
    expected = acceptTower(occupied, { kind: 'move', id: stair.id, target });
  await openMap(page, occupied);
  await edit(page);
  await objects(page).selectOption(stair.id);
  await position(page, target);
  await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Focus floor', exact: true }).click();
  // Focus cancels staging; select the same clear position again at the closer zoom.
  await position(page, target);
  await expect(page.locator('.placement-status')).toContainText('Valid position');
  await page
    .locator('forge-object-editor')
    .screenshot({ path: 'artifacts/tower-editor/stairs-clearance-fixed.png' });
  await page.getByRole('button', { name: 'Place object', exact: true }).click();
  expect(await snapshot(page, 'Stairs beside barrel')).toEqual(expected);
  const exported = await png(page);
  // A genuine collision with the caption is still rejected, and can be cancelled.
  await objects(page).selectOption('added-1');
  await position(page, { x: 8, y: 12 });
  await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeDisabled();
  await page.locator('forge-preview canvas').focus();
  await page.keyboard.press('Escape');
  expect(await snapshot(page, 'Rejected overlap unchanged')).toEqual(expected);
  expect((await png(page)).hash).toBe(exported.hash);
  await page.reload();
  await ready(page);
  await page
    .locator('.saved-item')
    .filter({ has: page.getByText('Stairs beside barrel', { exact: true }) })
    .getByRole('button', { name: 'Open', exact: true })
    .click();
  await ready(page);
  expect((await png(page)).hash).toBe(exported.hash);
});

for (const stairStyle of ['spiral', 'separate'] as const)
  test(`${stairStyle} stairs fit beside curved walls, reject crossing masonry, and retain the accepted edge position`, async ({
    page,
  }) => {
    const prepared = clearTower(
        towerEditorFixture({
          stairStyle,
          portalFloor: null,
          laboratoryFloor: undefined,
          observatoryFloor: undefined,
        }),
      ),
      stair = editableTowerStairs(prepared).find((s) => s.floor === 1);
    if (!stair) throw Error('Missing stairs');
    await openMap(page, prepared);
    await edit(page);
    await objects(page).selectOption(stair.id);
    await page.getByRole('button', { name: 'Focus floor', exact: true }).click();
    let expected = prepared;
    for (const [side, target] of [
      ['left', { x: 4, y: 10 }],
      ['right', { x: 11, y: 10 }],
    ] as const) {
      await objects(page).selectOption(stair.id);
      await position(page, target);
      await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeEnabled();
      await expect(page.locator('.placement-status')).toContainText('Valid position');
      await page
        .locator('forge-object-editor')
        .screenshot({ path: `artifacts/tower-editor/${stairStyle}-${side}-wall-fit.png` });
      await page.locator('forge-preview canvas').focus();
      await page.keyboard.press('Enter');
      expected = acceptTower(expected, { kind: 'move', id: stair.id, target });
      expect(await snapshot(page, `${stairStyle} ${side} wall fit`)).toEqual(expected);
    }
    const exported = await png(page);
    await objects(page).selectOption(stair.id);
    await position(page, { x: 2, y: 10 });
    await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeDisabled();
    await expect(page.locator('.placement-status')).toContainText('inside the circular walls');
    await page.locator('forge-preview canvas').focus();
    await page.keyboard.press('Escape');
    expect((await png(page)).hash).toBe(exported.hash);
    await page.reload();
    await ready(page);
    await page
      .locator('.saved-item')
      .filter({ has: page.getByText(`${stairStyle} right wall fit`, { exact: true }) })
      .getByRole('button', { name: 'Open', exact: true })
      .click();
    await ready(page);
    expect((await png(page)).hash).toBe(exported.hash);
    await page.setViewportSize({ width: 375, height: 812 });
    await edit(page);
    await objects(page).selectOption(stair.id);
    await page.getByRole('button', { name: 'Focus floor', exact: true }).click();
    await position(page, { x: 4, y: 10 });
    await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeEnabled();
    await page
      .locator('forge-object-editor')
      .screenshot({ path: `artifacts/tower-editor/${stairStyle}-mobile-wall-fit.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

for (const stairStyle of ['spiral', 'separate'] as const)
  test(`${stairStyle} stairs move over moss while naming real furniture collisions`, async ({
    page,
  }) => {
    const base = towerEditorFixture({
        stairStyle,
        portalFloor: null,
        laboratoryFloor: undefined,
        observatoryFloor: undefined,
      }),
      cleared = clearTower(base),
      stair = editableTowerStairs(cleared).find((s) => s.floor === 1);
    if (!stair) throw Error('Missing first-floor stairs');
    const initial = acceptTower(cleared, {
        kind: 'move',
        id: stair.id,
        target: { x: 8, y: 10 },
      }),
      moss = acceptTower(initial, { kind: 'add', propKind: 'moss', target: { x: 7, y: 6 } }),
      prepared = acceptTower(moss, { kind: 'add', propKind: 'crate', target: { x: 5, y: 10 } });
    await openMap(page, prepared);
    await edit(page);
    await objects(page).selectOption(stair.id);
    await page.getByRole('button', { name: 'Focus floor', exact: true }).click();
    await position(page, { x: 8, y: 7 });
    await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeEnabled();
    await expect(page.locator('.placement-status')).toContainText('Valid position');
    await page
      .locator('forge-object-editor')
      .screenshot({ path: `artifacts/tower-editor/${stairStyle}-moss-fit.png` });
    await page.locator('forge-preview canvas').focus();
    await page.keyboard.press('Enter');
    const expected = acceptTower(prepared, { kind: 'move', id: stair.id, target: { x: 8, y: 7 } });
    expect(await snapshot(page, `${stairStyle} stairs over moss`)).toEqual(expected);
    const exported = await png(page);
    await objects(page).selectOption(stair.id);
    await position(page, { x: 5, y: 9 });
    await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeDisabled();
    await expect(page.locator('.placement-status')).toContainText(
      'Crate on floor 1 at column 6, row 11',
    );
    await position(page, { x: 8, y: 7 });
    await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeEnabled();
    await page.locator('forge-preview canvas').focus();
    await page.keyboard.press('Escape');
    expect((await png(page)).hash).toBe(exported.hash);
    await page.reload();
    await ready(page);
    await page
      .locator('.saved-item')
      .filter({ has: page.getByText(`${stairStyle} stairs over moss`, { exact: true }) })
      .getByRole('button', { name: 'Open', exact: true })
      .click();
    await ready(page);
    expect((await png(page)).hash).toBe(exported.hash);
  });

test('spiral footprint leaves the space beside its body usable while protecting the caption below', async ({
  page,
}) => {
  const base = towerEditorFixture({
      portalFloor: null,
      laboratoryFloor: undefined,
      observatoryFloor: undefined,
    }),
    cleared = clearTower(base),
    stair = editableTowerStairs(cleared).find((s) => s.floor === 1);
  if (!stair) throw Error('Missing stairs');
  const initial = acceptTower(cleared, { kind: 'move', id: stair.id, target: { x: 8, y: 7 } }),
    prepared = acceptTower(initial, { kind: 'add', propKind: 'crate', target: { x: 12, y: 9 } });
  await openMap(page, prepared);
  await edit(page);
  await objects(page).selectOption(stair.id);
  await page.getByRole('button', { name: 'Focus floor', exact: true }).click();
  await position(page, { x: 10, y: 9 });
  await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeEnabled();
  await page
    .locator('forge-object-editor')
    .screenshot({ path: 'artifacts/tower-editor/spiral-compound-footprint.png' });
  await page.locator('forge-preview canvas').focus();
  await page.keyboard.press('Enter');
  const expected = acceptTower(prepared, { kind: 'move', id: stair.id, target: { x: 10, y: 9 } });
  expect(await snapshot(page, 'Stairs beside the crate')).toEqual(expected);
  const exported = await png(page);
  // The adjacent cell lies inside the old broad rectangle. It must select the
  // crate rather than capture clicks as part of the stairs.
  await page.locator('forge-preview canvas').focus();
  await page.keyboard.press('Home');
  const crate = await point(page, { x: 12.05, y: 9.5 });
  await page.mouse.click(crate.x, crate.y);
  await expect(objects(page)).toHaveValue('added-1');
  await position(page, { x: 12, y: 10 });
  await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeDisabled();
  await expect(page.locator('.placement-status')).toContainText('Crate');
  await page.locator('forge-preview canvas').focus();
  await page.keyboard.press('Escape');
  expect((await png(page)).hash).toBe(exported.hash);
  await page.reload();
  await ready(page);
  await page
    .locator('.saved-item')
    .filter({ has: page.getByText('Stairs beside the crate', { exact: true }) })
    .getByRole('button', { name: 'Open', exact: true })
    .click();
  await ready(page);
  expect((await png(page)).hash).toBe(exported.hash);
  await page.setViewportSize({ width: 375, height: 812 });
  await edit(page);
  await objects(page).selectOption(stair.id);
  await page.getByRole('button', { name: 'Focus floor', exact: true }).click();
  await page
    .locator('forge-object-editor')
    .screenshot({ path: 'artifacts/tower-editor/spiral-compound-footprint-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
