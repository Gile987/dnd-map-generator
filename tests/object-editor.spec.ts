import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { parseSavedMap, SAVE_STORAGE_KEY } from '../src/app/save/save-format';
import type { DungeonDocument, Point } from '../src/app/engine/model';
import { dungeonBase, dungeonInstances } from '../src/app/engine/object-editor/document';
import { dungeonObjectLock } from '../src/app/engine/object-editor/dungeon-rules';
import { applyObjectCommand } from '../src/app/engine/object-editor/commands';
import { validCommand } from '../scripts/editor-test-support';

test.use({ deviceScaleFactor: 2 });
async function settled(page: Page) {
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
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
  if (!record || record.map.type !== 'dungeon') throw new Error('Missing dungeon');
  return { ...record, map: record.map };
}
async function png(page: Page) {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  const file = await download,
    bytes = await readFile(await file.path());
  await settled(page);
  return { bytes, name: file.suggestedFilename() };
}
async function position(page: Page, target: Point) {
  await page.getByRole('spinbutton', { name: 'Column', exact: true }).fill(String(target.x + 1));
  await page.getByRole('spinbutton', { name: 'Row', exact: true }).fill(String(target.y + 1));
}
function movable(map: DungeonDocument) {
  const item = dungeonInstances(map).find(
    (item) => !dungeonObjectLock(dungeonBase(map), item.prop),
  );
  if (!item) throw new Error('No movable object');
  return item;
}
async function enter(page: Page) {
  await page.getByRole('button', { name: 'Edit objects', exact: true }).click();
}

test('Dungeon movement preserves pending settings and pins, shares undo history, and roundtrips exact authored PNGs through saved JSON', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto('/');
  const base = await snapshot(page, 'Base'),
    original = await png(page);
  await page.getByRole('button', { name: 'Pin this map', exact: true }).click();
  await page.locator('#seed').fill('pending-custom-dungeon');
  await enter(page);
  const source = movable(base.map),
    command = validCommand(
      base.map,
      (target) => ({ kind: 'move', id: source.id, target }),
      source.prop,
    );
  if (command.kind !== 'move') throw new Error('Missing move');
  await page
    .getByRole('combobox', { name: 'Objects on this map', exact: true })
    .selectOption(source.id);
  await position(page, command.target);
  expect((await png(page)).bytes).toEqual(original.bytes); // Export cancels the temporary gesture and excludes the ghost.
  await page
    .getByRole('combobox', { name: 'Objects on this map', exact: true })
    .selectOption(source.id);
  await position(page, command.target);
  await page.getByRole('button', { name: 'Place object', exact: true }).click();
  const accepted = await snapshot(page, 'Moved'),
    image = await png(page);
  const expected = applyObjectCommand(base.map, command);
  if (!expected.ok) throw new Error(expected.error);
  expect(accepted.map).toEqual(expected.document);
  expect(image.bytes).not.toEqual(original.bytes);
  expect(image.name).toContain('-customized-');
  await expect(page.locator('#seed')).toHaveValue('pending-custom-dungeon');
  await expect(page.getByRole('button', { name: 'Shuffle details', exact: true })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Replace customizations and generate', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Pinned', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit objects', exact: true })).toBeDisabled();
  expect((await png(page)).bytes).toEqual(original.bytes);
  await page.getByRole('button', { name: 'Current', exact: true }).click();
  await page.getByRole('button', { name: 'Undo change', exact: true }).click();
  await settled(page);
  expect((await png(page)).bytes).toEqual(original.bytes);
  await page.getByRole('button', { name: 'Redo change', exact: true }).click();
  await settled(page);
  expect((await png(page)).bytes).toEqual(image.bytes);
  await page
    .getByRole('button', { name: 'Replace customizations and generate', exact: true })
    .click();
  await settled(page);
  await expect(page.locator('#settings-error')).toBeEmpty();
  await page.getByRole('button', { name: 'Undo change', exact: true }).click();
  await settled(page);
  expect((await png(page)).bytes).toEqual(image.bytes);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup', exact: true }).click();
  const backup = await downloading,
    text = await readFile(await backup.path(), 'utf8');
  expect(
    parseSavedMap(JSON.parse(text).maps.find((r: { name: string }) => r.name === 'Moved'))?.map,
  ).toEqual(accepted.map);
  await page.reload();
  await settled(page);
  await page
    .locator('.saved-item')
    .filter({ has: page.locator('.saved-name').getByText('Moved', { exact: true }) })
    .getByRole('button', { name: 'Open', exact: true })
    .click();
  await settled(page);
  expect((await png(page)).bytes).toEqual(image.bytes);
  await page.evaluate((key) => localStorage.removeItem(key), SAVE_STORAGE_KEY);
  await page.reload();
  await settled(page);
  await page.locator('input[type=file]').setInputFiles({
    name: 'authored-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  });
  await expect(page.locator('.library-message .notice')).toContainText('Imported');
  await page
    .locator('.saved-item')
    .filter({ has: page.locator('.saved-name').getByText('Moved', { exact: true }) })
    .getByRole('button', { name: 'Open', exact: true })
    .click();
  await settled(page);
  expect((await png(page)).bytes).toEqual(image.bytes);
  await page.getByRole('button', { name: 'Export options', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export options', exact: true });
  await dialog
    .getByRole('combobox', { name: 'Export preset', exact: true })
    .selectOption('foundry');
  const vttDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download PNG', exact: true }).click();
  const vtt = await vttDownload,
    bytes = await readFile(await vtt.path());
  expect(vtt.suggestedFilename()).toContain('customized');
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([4000, 3000]);
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await enter(page);
  await page.getByRole('button', { name: 'Add object', exact: true }).click();
  await page
    .locator('forge-object-editor')
    .screenshot({ path: 'artifacts/object-editor/editor-desktop.png' });
  await page.getByRole('button', { name: 'Add object', exact: true }).focus();
  await page.keyboard.press('Tab');
  await page
    .locator('forge-object-editor')
    .screenshot({ path: 'artifacts/object-editor/keyboard-desktop.png' });
  await page.screenshot({ path: 'artifacts/object-editor/workbench-desktop.png', fullPage: true });
});

test('catalog insertion, invalid placement and cancellation keep accepted objects intact and allow correction', async ({
  page,
}) => {
  await page.goto('/');
  const base = await snapshot(page, 'Before insertion'),
    original = await png(page);
  await enter(page);
  await page.getByRole('button', { name: 'Add object', exact: true }).click();
  await expect(page.locator('.object-cards button')).toHaveCount(7);
  await page.getByLabel('Find an object', { exact: true }).fill('moss');
  await expect(page.locator('.object-cards button')).toHaveCount(1);
  await page.getByRole('button', { name: 'Add Moss', exact: true }).click();
  await position(page, { x: 0, y: 0 });
  await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeDisabled();
  await expect(page.locator('.placement-hint')).toContainText('walls');
  expect((await png(page)).bytes).toEqual(original.bytes);
  await expect(page.getByRole('button', { name: 'Cancel placement', exact: true })).toHaveCount(0);
  const command = validCommand(base.map, (target) => ({ kind: 'add', propKind: 'moss', target }));
  if (command.kind !== 'add') throw new Error('Missing insertion');
  await page.getByRole('button', { name: 'Add object', exact: true }).click();
  await page.getByRole('button', { name: 'Add Moss', exact: true }).click();
  await position(page, command.target);
  await page.getByRole('button', { name: 'Place object', exact: true }).click();
  const accepted = await snapshot(page, 'Inserted');
  expect(accepted.map.objectEdits?.added).toHaveLength(1);
  await page.getByRole('button', { name: 'Reset customizations', exact: true }).click();
  expect((await png(page)).bytes).toEqual(original.bytes);
  await page.getByRole('button', { name: 'Undo change', exact: true }).click();
  await settled(page);
  expect((await snapshot(page, 'Restored insertion')).map).toEqual(accepted.map);
  await page.getByRole('radio', { name: 'Forest', exact: true }).check();
  await settled(page);
  await expect(page.getByRole('button', { name: 'Edit objects', exact: true })).toHaveCount(0);
  await page.getByRole('radio', { name: 'Dungeon', exact: true }).check();
  await settled(page);
  expect((await snapshot(page, 'Returned')).map).toEqual(accepted.map);
});

async function screenPoint(page: Page, point: Point, zoom = 1, pan = { x: 0, y: 0 }) {
  await page.locator('forge-preview canvas').scrollIntoViewIfNeeded();
  const rect = await page.locator('forge-preview canvas').boundingBox();
  if (!rect) throw new Error('Missing canvas');
  const scale = Math.min(rect.width / 40, rect.height / 30) * 0.94 * zoom;
  return {
    x: rect.x + (rect.width - 40 * scale) / 2 + pan.x + point.x * scale,
    y: rect.y + (rect.height - 30 * scale) / 2 + pan.y + point.y * scale,
  };
}

test('pointer movement uses zoomed and panned coordinates, cancels interrupted drags, and supports keyboard placement', async ({
  page,
}) => {
  await page.goto('/');
  const base = await snapshot(page, 'Pointer base');
  const source = movable(base.map);
  const command = validCommand(
    base.map,
    (target) => ({ kind: 'move', id: source.id, target }),
    source.prop,
  );
  if (command.kind !== 'move') throw new Error('Missing move');
  // Establish a nonzero viewport pan through Explore.
  const canvas = page.locator('forge-preview canvas');
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Missing canvas');
  await page.mouse.move(bounds.x + 80, bounds.y + 80);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 95, bounds.y + 70);
  await page.mouse.up();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await enter(page);
  let from = await screenPoint(page, { x: source.prop.x + 0.5, y: source.prop.y + 0.5 }, 1.25, {
    x: 15,
    y: -10,
  });
  let to = await screenPoint(page, { x: command.target.x + 0.5, y: command.target.y + 0.5 }, 1.25, {
    x: 15,
    y: -10,
  });
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await canvas.dispatchEvent('pointercancel', { pointerId: 1, clientX: to.x, clientY: to.y });
  await page.mouse.up();
  expect((await snapshot(page, 'Canceled drag')).map).toEqual(base.map);
  // Saving scrolls the page. Recompute client coordinates without changing the viewport transform.
  from = await screenPoint(page, { x: source.prop.x + 0.5, y: source.prop.y + 0.5 }, 1.25, {
    x: 15,
    y: -10,
  });
  to = await screenPoint(page, { x: command.target.x + 0.5, y: command.target.y + 0.5 }, 1.25, {
    x: 15,
    y: -10,
  });
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
  const moved = await snapshot(page, 'Pointer moved');
  const expected = applyObjectCommand(base.map, command);
  if (!expected.ok) throw new Error(expected.error);
  expect(moved.map).toEqual(expected.document);
  await page
    .getByRole('combobox', { name: 'Objects on this map', exact: true })
    .selectOption(source.id);
  const back = source.prop;
  await position(page, back);
  await canvas.focus();
  await canvas.press('Enter');
  expect((await snapshot(page, 'Keyboard restored')).map).toEqual(base.map);
});

test('objects can be dragged from the catalog, and a refused drop can be corrected with a tap destination', async ({
  page,
}) => {
  await page.goto('/');
  const base = await snapshot(page, 'Palette base');
  const command = validCommand(base.map, (target) => ({ kind: 'add', propKind: 'moss', target }));
  if (command.kind !== 'add') throw new Error('Missing insertion');
  await enter(page);
  await page.getByRole('button', { name: 'Add object', exact: true }).click();
  const card = page.getByRole('button', { name: 'Add Moss', exact: true });
  await card.scrollIntoViewIfNeeded();
  const cardRect = await card.boundingBox();
  if (!cardRect) throw new Error('Missing card');
  const to = await screenPoint(page, { x: command.target.x + 0.5, y: command.target.y + 0.5 });
  // The desktop viewport fits the open catalog and the canvas; recompute the source after scrolling.
  const fresh = await card.boundingBox();
  if (!fresh) throw new Error('Missing card');
  await page.mouse.move(fresh.x + fresh.width / 2, fresh.y + fresh.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  const accepted = await snapshot(page, 'Dragged from catalog');
  expect(accepted.map.objectEdits?.added).toHaveLength(1);
  const second = validCommand(accepted.map, (target) => ({
    kind: 'add',
    propKind: 'moss',
    target,
  }));
  if (second.kind !== 'add') throw new Error('Missing insertion');
  await card.click();
  await position(page, { x: 0, y: 0 });
  const destination = await screenPoint(page, {
    x: second.target.x + 0.5,
    y: second.target.y + 0.5,
  });
  await page.mouse.click(destination.x, destination.y);
  expect((await snapshot(page, 'Click placement')).map.objectEdits?.added).toHaveLength(2);
});

test('removing a blocker makes room for a catalog replacement and both actions are independently undoable', async ({
  page,
}) => {
  await page.goto('/');
  const before = await snapshot(page, 'Replacement base');
  const source = dungeonInstances(before.map).find(
    (item) => item.prop.blocking && !dungeonObjectLock(dungeonBase(before.map), item.prop),
  );
  if (!source) throw new Error('Missing blocker');
  const removed = applyObjectCommand(before.map, { kind: 'remove', id: source.id });
  if (!removed.ok) throw new Error(removed.error);
  const command = validCommand(
    removed.document,
    (target) => ({ kind: 'add', propKind: 'barrel', target }),
    source.prop,
  );
  if (command.kind !== 'add') throw new Error('Missing replacement');
  await enter(page);
  await page
    .getByRole('combobox', { name: 'Objects on this map', exact: true })
    .selectOption(source.id);
  await page.getByRole('button', { name: 'Remove object', exact: true }).click();
  expect((await snapshot(page, 'Removed blocker')).map).toEqual(removed.document);
  await page.getByRole('button', { name: 'Add object', exact: true }).click();
  await page.getByRole('button', { name: 'Add Barrel', exact: true }).click();
  await position(page, command.target);
  await page.getByRole('button', { name: 'Place object', exact: true }).click();
  const replaced = await snapshot(page, 'Replacement');
  expect(replaced.map.objectEdits?.added[0]?.prop.kind).toBe('barrel');
  await page.getByRole('button', { name: 'Undo change', exact: true }).click();
  await settled(page);
  expect((await snapshot(page, 'Undo replacement')).map).toEqual(removed.document);
  await page.getByRole('button', { name: 'Undo change', exact: true }).click();
  await settled(page);
  expect((await snapshot(page, 'Undo removal')).map).toEqual(before.map);
});

test.describe('small touch workspace', () => {
  test.use({ viewport: { width: 320, height: 700 }, hasTouch: true });
  test('catalog, tap placement, locked selection, focus workspace and disabled export recovery remain usable', async ({
    page,
  }) => {
    await page.goto('/');
    const base = await snapshot(page, 'Mobile base');
    await page.getByRole('button', { name: 'Focus map', exact: true }).click();
    await enter(page);
    await page.getByRole('button', { name: 'Add object', exact: true }).click();
    await page.getByLabel('Find an object', { exact: true }).fill('moss');
    await page.screenshot({ path: 'artifacts/object-editor/picker-320.png', fullPage: true });
    await page.getByRole('button', { name: 'Add Moss', exact: true }).tap();
    const command = validCommand(base.map, (target) => ({ kind: 'add', propKind: 'moss', target }));
    if (command.kind !== 'add') throw new Error('Missing insertion');
    await position(page, command.target);
    await page.getByRole('button', { name: 'Place object', exact: true }).tap();
    await expect(page.locator('.editor-toolbar')).toContainText('Customized');
    await expect(
      page.getByRole('button', { name: 'Undo map change', exact: true }),
    ).toHaveAttribute('aria-disabled', 'false');
    await page.getByRole('button', { name: 'Undo map change', exact: true }).tap();
    await settled(page);
    await expect(page.locator('.editor-toolbar')).not.toContainText('Customized');
    await page.getByRole('button', { name: 'Redo map change', exact: true }).tap();
    await settled(page);
    await expect(page.locator('.editor-toolbar')).toContainText('Customized');

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const locked = dungeonInstances(base.map).find((item) =>
      dungeonObjectLock(dungeonBase(base.map), item.prop),
    );
    if (!locked) throw new Error('No protected item');
    await page
      .getByRole('combobox', { name: 'Objects on this map', exact: true })
      .selectOption(locked.id);
    await expect(page.locator('.selection-label')).toContainText(
      /attachment|protected|arrangement|artwork/,
    );
    await expect(page.getByRole('spinbutton', { name: 'Column', exact: true })).toHaveCount(0);
    await page.screenshot({ path: 'artifacts/object-editor/workspace-320.png', fullPage: true });
    await page.evaluate(() => {
      HTMLCanvasElement.prototype.toBlob = function (callback) {
        setTimeout(() => callback(null), 800);
      };
    });
    await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit objects', exact: true })).toBeDisabled();
    await page
      .locator('.editor-toolbar')
      .screenshot({ path: 'artifacts/object-editor/disabled-320.png' });
    await settled(page);
    await expect(page.locator('#settings-error')).toContainText('could not create a PNG');
    await expect(page.getByRole('button', { name: 'Edit objects', exact: true })).toBeEnabled();
    await page.setViewportSize({ width: 800, height: 420 });
    await page
      .locator('forge-object-editor')
      .screenshot({ path: 'artifacts/object-editor/workspace-800.png' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Back to workbench', exact: true }).click();
    expect((await snapshot(page, 'Mobile edited')).map.objectEdits?.added).toHaveLength(1);
  });
});
