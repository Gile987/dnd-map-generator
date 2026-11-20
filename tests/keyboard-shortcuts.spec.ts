import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createCanvas } from '@napi-rs/canvas';
import { editorFixture } from '../scripts/editor-test-support';
import { forestEditorFixture } from '../scripts/forest-editor-test-support';
import { courtyardEditorFixture } from '../scripts/courtyard-editor-test-support';
import { towerEditorFixture } from '../scripts/tower-editor-test-support';
import { applyEditorCommand } from '../src/app/engine/object-editor/editor-commands';
import { editorInstances, editorSelections } from '../src/app/engine/object-editor/editor-view';
import { mapDimensions } from '../src/app/engine/model';
import type { EditableMapDocument } from '../src/app/engine/model';
import { towerFloorAt } from '../src/app/engine/tower';
import { renderMap } from '../src/app/rendering/render-map';
import {
  makeSavedMap,
  parseSavedMap,
  serializeBundle,
  SAVE_STORAGE_KEY,
} from '../src/app/save/save-format';

function prepare(source: EditableMapDocument): EditableMapDocument {
  let map = source;
  for (const item of editorSelections(source))
    if (item.removable) {
      const result = applyEditorCommand(map, { kind: 'remove', id: item.id });
      if (!result.ok) throw Error(result.error);
      map = result.document;
    }
  const { width } = mapDimensions(map);
  for (const [index, walkable] of map.layout.tiles.entries()) {
    if (!walkable) continue;
    const target = { x: index % width, y: Math.floor(index / width) };
    if (map.type === 'tower' && towerFloorAt(map, target)?.number !== 1) continue;
    const result = applyEditorCommand(map, { kind: 'add', propKind: 'weapon_rack', target });
    if (result.ok) return result.document;
  }
  throw Error('No valid object position');
}
async function ready(page: Page) {
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('forge-preview canvas')).toBeVisible();
}
async function open(page: Page, map: EditableMapDocument) {
  const { width, height } = mapDimensions(map),
    canvas = createCanvas(width * 8, height * 8);
  renderMap(canvas.getContext('2d'), map, { pixelsPerTile: 8, grid: false });
  const record = makeSavedMap(
    map,
    'Keyboard source',
    canvas.toDataURL(),
    'keyboard-source',
    '2026-11-20T12:00:00Z',
  );
  await page.goto('/');
  await page.locator('.import-label input').setInputFiles({
    name: 'keyboard.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serializeBundle([record])),
  });
  await expect(page.locator('.library-message .notice')).toHaveText('Imported 1 map.');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await ready(page);
}
async function saved(page: Page, name: string) {
  await ready(page);
  await page.locator('#save-name').fill(name);
  await page.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(page.locator('.library-message .notice')).toHaveText(`Saved “${name}”.`);
  const data: unknown = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? '[]'),
    SAVE_STORAGE_KEY,
  );
  if (!Array.isArray(data)) throw Error('Missing saved library');
  const record = data.map(parseSavedMap).find((record) => record?.name === name);
  if (!record) throw Error('Missing record');
  return record.map;
}
const sources = [
  editorFixture(),
  forestEditorFixture(),
  courtyardEditorFixture(),
  towerEditorFixture({ floorCount: 3, portalFloor: null }),
];
for (const base of sources)
  test(`${base.type}: map keys stage movement and rotation, preserve previews through help, select, remove, undo and redo`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    const source = prepare(base),
      item = editorInstances(source).find((item) => item.id === 'added-1');
    if (!item) throw Error('Missing rack');
    await open(page, source);
    await page.getByRole('button', { name: 'Edit objects', exact: true }).click();
    const select = page.getByRole('combobox', { name: 'Objects on this map', exact: true }),
      canvas = page.locator('forge-preview canvas');
    await select.selectOption(item.id);
    await canvas.focus();
    await page.keyboard.press('e');
    await expect(page.getByRole('status', { name: 'Object rotation' })).toHaveText(
      '90° from original',
    );
    await expect(page.locator('.placement-hint')).toContainText('Q/E: rotate');
    await canvas.dispatchEvent('keydown', { key: 'e', repeat: true, bubbles: true });
    await expect(page.getByRole('status', { name: 'Object rotation' })).toHaveText(
      '90° from original',
    );
    await page.keyboard.press('?');
    const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Edit objects mode');
    await expect(dialog.getByRole('heading', { level: 3 }).first()).toHaveText('Selection');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(canvas).toBeFocused();
    await expect(page.getByRole('status', { name: 'Object rotation' })).toHaveText(
      '90° from original',
    );
    await page.keyboard.press('Escape');
    await expect(page.getByRole('status', { name: 'Object rotation' })).toHaveText(
      '0° from original',
    );
    await page.keyboard.press('q');
    await expect(page.getByRole('status', { name: 'Object rotation' })).toHaveText(
      '270° from original',
    );
    await page.keyboard.press('Enter');
    const turned = await saved(page, 'Turned');
    expect(editorInstances(turned).find((other) => other.id === item.id)?.prop.artRotation).toBe(3);
    await canvas.focus();
    await page.keyboard.press('Control+z');
    const undone = await saved(page, 'Undone');
    expect(undone).toEqual(source);
    await canvas.focus();
    await page.keyboard.press('Control+Shift+z');
    const redone = await saved(page, 'Redone');
    expect(redone).toEqual(turned);
    await select.selectOption(item.id);
    await canvas.focus();
    const directions = [
      ['ArrowRight', 1, 0],
      ['ArrowDown', 0, 1],
      ['ArrowLeft', -1, 0],
      ['ArrowUp', 0, -1],
    ] as const;
    const destination = directions
      .map(([key, dx, dy]) => ({ key, target: { x: item.prop.x + dx, y: item.prop.y + dy } }))
      .find(({ target }) => applyEditorCommand(turned, { kind: 'move', id: item.id, target }).ok);
    if (!destination) throw Error('Missing adjacent position');
    await page.keyboard.press(destination.key);
    await page.keyboard.press('Enter');
    const moved = await saved(page, 'Moved');
    expect(editorInstances(moved).find((other) => other.id === item.id)?.prop).toMatchObject({
      ...destination.target,
      artRotation: 3,
    });
    await select.selectOption(item.id);
    await canvas.focus();
    const choices = editorSelections(moved).filter(
      (other) =>
        !other.lock &&
        (moved.type !== 'tower' || towerFloorAt(moved, other.position)?.number === 1),
    );
    const index = choices.findIndex((other) => other.id === item.id),
      next = choices[(index + 1) % choices.length];
    if (!next) throw Error('Missing next selection');
    await page.keyboard.press(']');
    await expect(select).toHaveValue(next.id);
    await page.keyboard.press('[');
    await expect(select).toHaveValue(item.id);
    await page.keyboard.press('Delete');
    const removed = await saved(page, 'Removed');
    expect(editorInstances(removed).some((other) => other.id === item.id)).toBe(false);
    await canvas.focus();
    await page.keyboard.press('Control+z');
    const restored = await saved(page, 'Restored');
    expect(restored).toEqual(moved);
    await select.selectOption(item.id);
    await page
      .locator('forge-object-editor')
      .screenshot({ path: `artifacts/keyboard-shortcuts/${base.type}-editing.png` });
  });

for (const [width, height] of [
  [1440, 900],
  [320, 568],
  [800, 420],
] as const)
  test(`help is keyboard-scrollable and closes before Focus map at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await ready(page);
    await page.getByRole('button', { name: 'Focus map', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Back to workbench', exact: true }),
    ).toBeFocused();
    const button = page.getByRole('button', { name: 'Keyboard shortcuts', exact: true });
    await button.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts', exact: true });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: 'Keyboard shortcuts', exact: true }),
    ).toBeFocused();
    await page.screenshot({
      path: `artifacts/keyboard-shortcuts/help-${width}.png`,
      fullPage: true,
    });
    await page.keyboard.press('Tab');
    const list = dialog.getByRole('region', { name: 'Shortcut list', exact: true });
    await expect(list).toBeFocused();
    await page.keyboard.press('End');
    if (height < 600) {
      await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      await expect(dialog.getByText('Redo an undone map change', { exact: true })).toBeInViewport();
    }
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    const close = dialog.getByRole('button', { name: 'Close keyboard shortcuts', exact: true });
    await close.focus();
    await page.keyboard.press('Shift+Tab');
    await expect(list).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await page
      .locator('.focus-button')
      .evaluate((element) => (element as HTMLButtonElement).focus());
    await expect(close).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(button).toBeFocused();
    await expect(
      page.getByRole('button', { name: 'Back to workbench', exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Focus map', exact: true })).toBeFocused();
    if (width === 320) {
      await page.getByRole('button', { name: 'Edit objects', exact: true }).click();
      await page.locator('forge-preview canvas').focus();
      await page.keyboard.press('?');
      await expect(dialog.getByRole('heading', { level: 3 }).first()).toHaveText('Selection');
      await dialog.screenshot({ path: 'artifacts/keyboard-shortcuts/help-edit-320.png' });
      await dialog.getByRole('button', { name: 'Close keyboard shortcuts', exact: true }).click();
      await expect(page.locator('forge-preview canvas')).toBeFocused();
    }
  });

test('typing, browser modifiers, protected objects, composition and pinned maps do not trigger editing commands', async ({
  page,
}) => {
  const source = prepare(editorFixture());
  await open(page, source);
  await page.getByRole('button', { name: 'Edit objects', exact: true }).click();
  const canvas = page.locator('forge-preview canvas'),
    select = page.getByRole('combobox', { name: 'Objects on this map', exact: true });
  await select.selectOption('added-1');
  await page.getByRole('button', { name: 'Add object', exact: true }).click();
  const search = page.getByRole('searchbox', { name: 'Find an object', exact: true });
  await search.fill('');
  await search.pressSequentially('qe[]');
  await expect(search).toHaveValue('qe[]');
  await search.press('Control+z');
  expect(await search.inputValue()).not.toBe('qe[]');
  await page.getByRole('button', { name: 'Add object', exact: true }).click();
  await canvas.focus();
  await page.keyboard.press('Control+e');
  await canvas.focus();
  await canvas.dispatchEvent('keydown', { key: 'e', isComposing: true, bubbles: true });
  const untouched = await saved(page, 'Untouched');
  expect(untouched).toEqual(source);
  const locked = editorSelections(source).find((item) => item.lock);
  if (!locked) throw Error('Missing locked object');
  await select.selectOption(locked.id);
  await canvas.focus();
  await page.keyboard.press('e');
  await page.keyboard.press('Delete');
  const protectedMap = await saved(page, 'Protected');
  expect(protectedMap).toEqual(source);
  await expect(page.locator('.placement-hint')).not.toContainText('Q/E');
  await select.selectOption('added-1');
  await canvas.focus();
  await page.keyboard.press('e');
  await page.keyboard.press('Enter');
  const beforePin = await saved(page, 'Before pin');
  await expect(page.getByRole('button', { name: 'Undo map change', exact: true })).toHaveAttribute(
    'aria-disabled',
    'false',
  );
  await page.getByRole('button', { name: 'Pin this map', exact: true }).click();
  await page.getByRole('button', { name: 'Pinned', exact: true }).click();
  await ready(page);
  await canvas.focus();
  await page.keyboard.press('e');
  await page.keyboard.press('Delete');
  await page.keyboard.press('Control+z');
  const pinned = await saved(page, 'Pinned safe');
  expect(pinned).toEqual(beforePin);
  await page.getByRole('button', { name: 'Current', exact: true }).click();
  expect(await saved(page, 'Current safe')).toEqual(beforePin);
});
