import { createCanvas } from '@napi-rs/canvas';
import { renderMap } from '../src/app/rendering/render-map';
import { generateCourtyard } from '../src/app/engine/courtyard-generate';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { editorFixture } from '../scripts/editor-test-support';
import { forestEditorFixture } from '../scripts/forest-editor-test-support';
import { courtyardEditorFixture } from '../scripts/courtyard-editor-test-support';
import { towerEditorFixture } from '../scripts/tower-editor-test-support';
import { applyEditorCommand } from '../src/app/engine/object-editor/editor-commands';
import { editorSelections, editorInstances } from '../src/app/engine/object-editor/editor-view';
import { mapDimensions } from '../src/app/engine/model';
import type { EditableMapDocument, PropKind, Point } from '../src/app/engine/model';
import type { ObjectCommand } from '../src/app/engine/object-editor/object-command';
import { towerFloorAt } from '../src/app/engine/tower';
import {
  makeSavedMap,
  parseSavedMap,
  serializeBundle,
  SAVE_STORAGE_KEY,
} from '../src/app/save/save-format';
import { selectCharacter } from './characters';

function fixtureRecord(map: EditableMapDocument, name: string, id: string) {
  const { width, height } = mapDimensions(map);
  const canvas = createCanvas(width * 8, height * 8);
  renderMap(canvas.getContext('2d'), map, { pixelsPerTile: 8, grid: false });
  return makeSavedMap(map, name, canvas.toDataURL(), id, '2026-11-19T12:00:00Z');
}

function clear(base: EditableMapDocument): EditableMapDocument {
  let map = base;
  for (const item of editorSelections(base)) {
    if (!item.removable) continue;
    const result = applyEditorCommand(map, { kind: 'remove', id: item.id });
    if (!result.ok) throw Error(result.error);
    map = result.document;
  }
  return map;
}
function placement(map: EditableMapDocument, make: (target: Point) => ObjectCommand, skip?: Point) {
  const { width } = mapDimensions(map);
  for (const [index, walkable] of map.layout.tiles.entries()) {
    if (!walkable) continue;
    const target = { x: index % width, y: Math.floor(index / width) };
    if (target.x === skip?.x && target.y === skip.y) continue;
    if (map.type === 'tower' && towerFloorAt(map, target)?.number !== 1) continue;
    const command = make(target),
      result = applyEditorCommand(map, command);
    if (result.ok && result.document !== map) return { command, map: result.document, target };
  }
  throw Error('Fixture needs a valid placement');
}
async function ready(page: Page) {
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('forge-preview canvas')).toBeVisible();
}
async function position(page: Page, target: Point) {
  await page.getByRole('spinbutton', { name: 'Column', exact: true }).fill(String(target.x + 1));
  await page.getByRole('spinbutton', { name: 'Row', exact: true }).fill(String(target.y + 1));
}
async function snapshot(page: Page, name: string) {
  await ready(page);
  await expect(page.locator('.library')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#save-name').fill(name);
  await page.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(page.locator('.library-message .notice')).toHaveText(`Saved “${name}”.`);
  const saved: unknown = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? '[]'),
    SAVE_STORAGE_KEY,
  );
  if (!Array.isArray(saved)) throw Error('Missing library');
  const record = saved.map(parseSavedMap).find((entry) => entry?.name === name);
  if (!record) throw Error('Missing saved map');
  return record;
}
async function download(page: Page, label: string) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: label, exact: true }).click();
  const file = await pending;
  return readFile(await file.path());
}
async function pngHash(page: Page) {
  return createHash('sha256')
    .update(await download(page, 'Quick export PNG'))
    .digest('hex');
}
const definitions = [
  { type: 'Dungeon', create: () => editorFixture('Storehouse'), extra: ['desk', 'bookshelf'] },
  { type: 'Forest', create: () => forestEditorFixture('Fey'), extra: ['bedroll'] },
  {
    type: 'Courtyard',
    create: () => {
      const result = generateCourtyard({
        seed: 'ivy-court',
        density: 'Balanced',
        character: 'Frostbound',
        fountain: true,
        wagon: true,
      });
      if (!result.ok) throw Error(result.error);
      return result.map;
    },
    extra: ['log', 'stump'],
  },
  {
    type: 'Tower',
    create: () => towerEditorFixture({ floorCount: 3, portalFloor: null }),
    extra: ['fern'],
  },
] as const;
const labels: Partial<Record<PropKind, string>> = {
  treasure_chest: 'Treasure chest',
  supply_sacks: 'Supply sacks',
  weapon_rack: 'Weapon rack',
  crate: 'Crate',
  barrel: 'Barrel',
  bedroll: 'Bedroll',
  moss: 'Moss',
  fern: 'Fern',
  log: 'Log',
  stump: 'Stump',
  desk: 'Desk',
  bookshelf: 'Bookshelf',
};
for (const definition of definitions) {
  test(`${definition.type} shared catalog supports placement, independent movement, undo, save/reopen and exact PNG exports`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(60000);
    const source = clear(definition.create());
    const record = fixtureRecord(source, 'Prepared map', 'shared-source');
    await page.goto('/');
    await page.locator('.import-label input').setInputFiles({
      name: 'prepared.json',
      mimeType: 'application/json',
      buffer: Buffer.from(serializeBundle([record])),
    });
    await expect(page.locator('.library-message .notice')).toHaveText('Imported 1 map.');
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await ready(page);
    await page.getByRole('button', { name: 'Edit objects', exact: true }).click();
    await page.getByRole('button', { name: 'Add object', exact: true }).click();
    const catalog = page.getByRole('region', {
      name: `${definition.type} object catalog`,
      exact: true,
    });
    for (const name of [
      'Treasure chest',
      'Supply sacks',
      'Weapon rack',
      'Crate',
      'Barrel',
      'Bedroll',
      'Moss',
      'Fern',
    ])
      await expect(catalog.getByRole('button', { name: `Add ${name}`, exact: true })).toBeVisible();
    await catalog.screenshot({ path: `artifacts/shared-props/${definition.type}-catalog.png` });
    if (definition.type === 'Dungeon') {
      const artwork = catalog
        .getByRole('button', { name: 'Add Treasure chest', exact: true })
        .locator('img');
      const before = await artwork.getAttribute('src');
      await selectCharacter(page, 'Ancient crypt');
      await expect(artwork).toHaveAttribute('src', before ?? '');
    }
    await page.getByRole('button', { name: 'Add object', exact: true }).click();
    let expected = source;
    for (const kind of [
      'treasure_chest',
      'supply_sacks',
      'weapon_rack',
      ...definition.extra,
    ] as const) {
      const next = placement(expected, (target) => ({
        kind: 'add',
        propKind: kind,
        target,
        ...(expected.type === 'tower' ? { floor: 1 } : {}),
      }));
      await page.getByRole('button', { name: 'Add object', exact: true }).click();
      await page.getByRole('button', { name: `Add ${labels[kind]}`, exact: true }).click();
      await position(page, next.target);
      await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: 'Place object', exact: true }).click();
      expected = next.map;
    }
    const saved = await snapshot(page, 'Shared props');
    expect(saved.map).toEqual(expected);
    const image = await pngHash(page);
    const chest = editorInstances(expected).find((item) => item.prop.kind === 'treasure_chest');
    if (!chest) throw Error('Missing chest');
    const moved = placement(
      expected,
      (target) => ({ kind: 'move', id: chest.id, target }),
      chest.prop,
    );
    await page
      .getByRole('combobox', { name: 'Objects on this map', exact: true })
      .selectOption(chest.id);
    await position(page, moved.target);
    await page.getByRole('button', { name: 'Place object', exact: true }).click();
    expect((await snapshot(page, 'Moved chest')).map).toEqual(moved.map);
    await page.getByRole('button', { name: 'Undo map change', exact: true }).click();
    expect((await snapshot(page, 'Restored props')).map).toEqual(expected);
    expect(await pngHash(page)).toBe(image);
    await page.screenshot({
      path: `artifacts/shared-props/${definition.type}-workbench.png`,
      fullPage: true,
    });
    const backup = await download(page, 'Download backup');
    const fresh = await browser.newContext();
    try {
      const other = await fresh.newPage();
      await other.goto('/');
      await other
        .locator('.import-label input')
        .setInputFiles({ name: 'shared-props.json', mimeType: 'application/json', buffer: backup });
      await expect(other.locator('.library-message .notice')).toContainText('Imported');
      await other
        .locator('.saved-item')
        .filter({ has: other.getByText('Shared props', { exact: true }) })
        .getByRole('button', { name: 'Open', exact: true })
        .click();
      await ready(other);
      expect(await pngHash(other)).toBe(image);
    } finally {
      await fresh.close();
    }
    await page.reload();
    await page
      .locator('.saved-item')
      .filter({ has: page.getByText('Shared props', { exact: true }) })
      .getByRole('button', { name: 'Open', exact: true })
      .click();
    await ready(page);
    expect(await pngHash(page)).toBe(image);
  });
}

test('shared objects are searchable and keyboard-placeable on a narrow screen, with invalid-placement recovery', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const source = clear(courtyardEditorFixture());
  const record = fixtureRecord(source, 'Mobile props', 'mobile');
  await page.goto('/');
  await page.locator('.import-label input').setInputFiles({
    name: 'mobile.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serializeBundle([record])),
  });
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await ready(page);
  await page.getByRole('button', { name: 'Edit objects', exact: true }).click();
  await page.getByRole('button', { name: 'Add object', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Find an object', exact: true }).fill('sacks');
  const add = page.getByRole('button', { name: 'Add Supply sacks', exact: true });
  await add.focus();
  await page.keyboard.press('Enter');
  await position(page, { x: 40, y: 30 });
  await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeDisabled();
  const valid = placement(source, (target) => ({ kind: 'add', propKind: 'supply_sacks', target }));
  await position(page, valid.target);
  await page.getByRole('button', { name: 'Place object', exact: true }).click();
  expect((await snapshot(page, 'Mobile sacks')).map).toEqual(valid.map);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: 'artifacts/shared-props/mobile-placement.png', fullPage: true });
});
