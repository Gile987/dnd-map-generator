import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { generateDungeon } from '../src/app/engine/generate';
import type { DungeonDocument, Point } from '../src/app/engine/model';
import { dungeonGroups } from '../src/app/engine/object-editor/dungeon-groups';
import { dungeonInstances, dungeonBase } from '../src/app/engine/object-editor/document';
import { individualObjectLock } from '../src/app/engine/object-editor/dungeon-authoring-rules';
import { applyObjectCommand } from '../src/app/engine/object-editor/commands';
import { validCommand } from '../scripts/editor-test-support';
import {
  makeSavedMap,
  parseSavedMap,
  serializeBundle,
  SAVE_STORAGE_KEY,
} from '../src/app/save/save-format';

async function ready(page: Page) {
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
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
  const saved = raw.map(parseSavedMap).find((s) => s?.name === name);
  if (!saved || saved.map.type !== 'dungeon') throw Error('Missing dungeon');
  return saved.map;
}
async function position(page: Page, point: Point) {
  await page.getByRole('spinbutton', { name: 'Column', exact: true }).fill(String(point.x + 1));
  await page.getByRole('spinbutton', { name: 'Row', exact: true }).fill(String(point.y + 1));
}
async function png(page: Page) {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  const file = await download;
  const bytes = await readFile(await file.path());
  await ready(page);
  return bytes;
}
async function screenPoint(page: Page, point: Point) {
  const canvas = page.locator('forge-preview canvas');
  await canvas.scrollIntoViewIfNeeded();
  const r = await canvas.boundingBox();
  if (!r) throw Error('Missing canvas');
  const scale = Math.min(r.width / 40, r.height / 30) * 0.94;
  return {
    x: r.x + (r.width - 40 * scale) / 2 + point.x * scale,
    y: r.y + (r.height - 30 * scale) / 2 + point.y * scale,
  };
}
async function openDocument(page: Page, document: DungeonDocument) {
  const saved = makeSavedMap(
    document,
    'Prepared addition',
    'data:image/png;base64,AAAA',
    'prepared-addition',
    '2026-11-02T12:00:00Z',
  );
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({
    name: 'addition.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serializeBundle([saved])),
  });
  await expect(page.locator('.library-message .notice')).toContainText('Imported 1 map');
  await page.locator('.saved-item').getByRole('button', { name: 'Open', exact: true }).click();
  await ready(page);
  await page.getByRole('button', { name: 'Edit objects', exact: true }).click();
}

test('objects layer over rugs, topmost selection works, and moving the rug leaves the barrel in place through undo and saved reopen', async ({
  page,
}) => {
  const generated = generateDungeon({
    seed: 'mosslit-sanctum',
    roomCount: 6,
    density: 'Balanced',
    preset: 'Mosslit',
  });
  if (!generated.ok) throw Error(generated.error);
  const base = generated.map,
    rug = dungeonInstances(base).find((item) => item.prop.kind === 'rug');
  if (!rug) throw Error('Missing rug');
  let prepared: DungeonDocument = base;
  for (const item of dungeonInstances(base))
    if (item.id !== rug.id && !individualObjectLock(base, item.id, item.prop)) {
      const result = applyObjectCommand(prepared, { kind: 'remove', id: item.id });
      if (!result.ok) throw Error(result.error);
      prepared = result.document;
    }
  await openDocument(page, prepared);
  await page.getByRole('button', { name: 'Add object', exact: true }).click();
  await page.getByRole('button', { name: 'Add Barrel', exact: true }).click();
  await position(page, rug.prop);
  await page.getByRole('button', { name: 'Place object', exact: true }).click();
  const layered = await snapshot(page, 'Barrel on rug'),
    image = await png(page);
  const select = page.getByRole('combobox', { name: 'Objects on this map', exact: true });
  const point = await screenPoint(page, { x: rug.prop.x + 0.5, y: rug.prop.y + 0.5 });
  await page.mouse.click(point.x, point.y);
  await expect(select).toHaveValue('added-1');
  await page
    .locator('forge-object-editor')
    .screenshot({ path: 'artifacts/editor-movement/barrel-on-rug.png' });
  const command = validCommand(
    layered,
    (target) => ({ kind: 'move', id: rug.id, target }),
    rug.prop,
  );
  if (command.kind !== 'move') throw Error('Missing rug move');
  await select.selectOption(rug.id);
  await position(page, command.target);
  await page.getByRole('button', { name: 'Place object', exact: true }).click();
  expect(
    dungeonInstances(await snapshot(page, 'Rug moved independently')).find(
      (item) => item.id === 'added-1',
    )?.prop,
  ).toMatchObject({ x: rug.prop.x, y: rug.prop.y });
  await page.getByRole('button', { name: 'Undo map change', exact: true }).click();
  await ready(page);
  expect(await png(page)).toEqual(image);
  await page.reload();
  await page
    .locator('.saved-item')
    .filter({ has: page.locator('.saved-name').getByText('Barrel on rug', { exact: true }) })
    .getByRole('button', { name: 'Open', exact: true })
    .click();
  await ready(page);
  expect(await png(page)).toEqual(image);
});

test('a barrel can occupy empty ritual floor, refuses physical components, and remains independent when the site moves', async ({
  page,
}) => {
  const generated = generateDungeon({
    seed: 'mosslit-sanctum',
    roomCount: 6,
    density: 'Balanced',
    preset: 'Mosslit',
    ritual: true,
  });
  if (!generated.ok) throw Error(generated.error);
  const base = generated.map,
    group = dungeonGroups(base).find((g) => g.id === 'ritual');
  if (!group) throw Error('Missing ritual');
  let prepared: DungeonDocument = base;
  for (const item of dungeonInstances(base))
    if (!individualObjectLock(base, item.id, item.prop)) {
      const result = applyObjectCommand(prepared, { kind: 'remove', id: item.id });
      if (!result.ok) throw Error(result.error);
      prepared = result.document;
    }
  const target: Point = { x: group.area.x + 2, y: group.area.y + 2 };
  const candle = dungeonInstances(base).find((item) => item.prop.kind === 'ritual_candles');
  if (!candle) throw Error('Missing ritual candle');
  await openDocument(page, prepared);
  await page.getByRole('button', { name: 'Add object', exact: true }).click();
  await page.getByRole('button', { name: 'Add Barrel', exact: true }).click();
  await position(page, candle.prop);
  await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeDisabled();
  await expect(page.locator('.placement-status')).toContainText('cannot overlap');
  await position(page, target);
  await page.getByRole('button', { name: 'Place object', exact: true }).click();
  const layered = await snapshot(page, 'Barrel inside ritual'),
    image = await png(page);
  const point = await screenPoint(page, { x: target.x + 0.5, y: target.y + 0.5 });
  await page.mouse.click(point.x, point.y);
  const select = page.getByRole('combobox', { name: 'Objects on this map', exact: true });
  await expect(select).toHaveValue('added-1');
  await page
    .locator('forge-object-editor')
    .screenshot({ path: 'artifacts/editor-movement/barrel-in-ritual.png' });
  const command = validCommand(
    layered,
    (destination) => ({ kind: 'move-group', id: 'ritual', target: destination }),
    group.area,
  );
  if (command.kind !== 'move-group') throw Error('Missing group move');
  await select.selectOption('group-ritual');
  await position(page, command.target);
  await page.getByRole('button', { name: 'Place object', exact: true }).click();
  expect(
    dungeonInstances(await snapshot(page, 'Ritual moved independently')).find(
      (item) => item.id === 'added-1',
    )?.prop,
  ).toMatchObject({ x: target.x, y: target.y });
  await page.getByRole('button', { name: 'Undo map change', exact: true }).click();
  await ready(page);
  expect(await png(page)).toEqual(image);
});

test('the screenshot-style barrel can move into open passage floor and another wall; refusals explain actual obstacles', async ({
  page,
}) => {
  await page.goto('/');
  const base = await snapshot(page, 'Passage base');
  const source = dungeonInstances(base).find(
    (i) => i.prop.kind === 'barrel' && i.prop.x === 21 && i.prop.y === 5,
  );
  if (!source) throw Error('Missing barrel');
  await page.getByRole('button', { name: 'Edit objects', exact: true }).click();
  const select = page.getByRole('combobox', { name: 'Objects on this map', exact: true });
  await select.selectOption(source.id);
  await position(page, { x: 21, y: 7 });
  await page.getByRole('button', { name: 'Place object', exact: true }).click();
  const start = await snapshot(page, 'Barrel before passage');
  const from = await screenPoint(page, { x: 21.5, y: 7.5 }),
    to = await screenPoint(page, { x: 21.5, y: 9.5 });
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await expect(page.locator('.placement-status')).toHaveText('Valid position — release to place');
  await page
    .locator('forge-preview')
    .screenshot({ path: 'artifacts/editor-movement/passage-ghost.png' });
  await page.mouse.up();
  const moved = await snapshot(page, 'Barrel in passage');
  const expected = applyObjectCommand(start, {
    kind: 'move',
    id: source.id,
    target: { x: 21, y: 9 },
  });
  if (!expected.ok) throw Error(expected.error);
  expect(moved).toEqual(expected.document);
  await select.selectOption(source.id);
  await position(page, { x: 0, y: 0 });
  await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeDisabled();
  await expect(page.locator('.placement-status')).toContainText('solid walls');
  await page.getByRole('button', { name: 'Cancel placement', exact: true }).click();
  const wall = dungeonInstances(moved).find(
    (i) => i.prop.kind === 'barrel' && i.prop.x === 16 && i.prop.y === 24,
  );
  if (!wall) throw Error('Missing wall barrel');
  await select.selectOption(wall.id);
  await position(page, { x: 20, y: 26 });
  await page.getByRole('button', { name: 'Place object', exact: true }).click();
  expect(
    dungeonInstances(await snapshot(page, 'Barrel at opposite wall')).find((i) => i.id === wall.id)
      ?.prop,
  ).toMatchObject({ x: 20, y: 26 });
  await page
    .locator('forge-preview')
    .screenshot({ path: 'artifacts/editor-movement/opposite-wall.png' });
});

for (const kind of ['crate', 'barrel'] as const)
  test(`${kind} keeps generated grid anchoring between opposite walls with stable saved PNGs`, async ({
    page,
  }) => {
    await page.goto('/');
    const base = await snapshot(page, 'Size base'),
      source = dungeonInstances(base).find((item) => item.prop.kind === kind);
    if (!source) throw Error('Missing wall-size object');
    await page.getByRole('button', { name: 'Edit objects', exact: true }).click();
    const select = page.getByRole('combobox', { name: 'Objects on this map', exact: true });
    for (const target of [
      { x: 16, y: 26 },
      { x: 20, y: 26 },
    ]) {
      await select.selectOption(source.id);
      await position(page, target);
      await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: 'Place object', exact: true }).click();
    }
    await snapshot(page, 'Size preserved');
    const image = await png(page);
    await page.getByRole('button', { name: 'Undo map change', exact: true }).click();
    await ready(page);
    await page.getByRole('button', { name: 'Redo map change', exact: true }).click();
    await ready(page);
    expect(await png(page)).toEqual(image);
    const point = await screenPoint(page, { x: 20.5, y: 26.5 });
    await page.mouse.move(point.x, point.y);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -650);
    await page.keyboard.up('Control');
    await expect(page.getByRole('status', { name: 'Zoom level' })).not.toHaveText('100%');
    await page
      .locator('forge-preview')
      .screenshot({ path: `artifacts/editor-movement/${kind}-wall-size.png` });
    await page.reload();
    await page
      .locator('.saved-item')
      .filter({ has: page.locator('.saved-name').getByText('Size preserved', { exact: true }) })
      .getByRole('button', { name: 'Open', exact: true })
      .click();
    await ready(page);
    expect(await png(page)).toEqual(image);
  });

for (const id of ['study', 'statue', 'table', 'ritual'] as const)
  test(`${id} is selected and moved as one complete addition, with exact undo, reopen and exports`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    const options = {
      study: { scene: 'Forgotten study' as const },
      statue: { landmark: 'weathered-statue' as const },
      table: { furniture: 'dining-table' as const },
      ritual: { ritual: true },
    }[id];
    const generated = generateDungeon({
      seed: 'mosslit-sanctum',
      roomCount: 6,
      density: 'Balanced',
      preset: 'Mosslit',
      ...options,
    });
    if (!generated.ok) throw Error(generated.error);
    let prepared: DungeonDocument = generated.map;
    for (const item of dungeonInstances(prepared))
      if (!individualObjectLock(generated.map, item.id, item.prop)) {
        const result = applyObjectCommand(prepared, { kind: 'remove', id: item.id });
        if (!result.ok) throw Error(result.error);
        prepared = result.document;
      }
    const group = dungeonGroups(generated.map).find((g) => g.id === id);
    if (!group) throw Error('Missing addition');
    const command = validCommand(
      prepared,
      (target) => ({ kind: 'move-group', id, target }),
      group.area,
    );
    if (command.kind !== 'move-group') throw Error('Missing move');
    await openDocument(page, prepared);
    const first = dungeonInstances(prepared).find((item) => group.members.includes(item.id));
    if (!first) throw Error('Missing group member');
    const point = await screenPoint(page, { x: first.prop.x + 0.5, y: first.prop.y + 0.5 });
    await page.mouse.click(point.x, point.y);
    const select = page.getByRole('combobox', { name: 'Objects on this map', exact: true });
    await expect(select).toHaveValue(`group-${id}`);
    await expect(page.locator('.selection-label')).toContainText('Move the complete addition');
    await expect(page.getByRole('button', { name: 'Remove object', exact: true })).toHaveCount(0);
    for (const member of group.members)
      await expect(select.locator(`option[value="${member}"]`)).toHaveCount(0);
    await position(page, { x: 0, y: 0 });
    await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeDisabled();
    await expect(page.locator('.placement-status')).toContainText('complete addition');
    await page.getByRole('button', { name: 'Cancel placement', exact: true }).click();
    const dragStart = await screenPoint(page, { x: first.prop.x + 0.5, y: first.prop.y + 0.5 });
    const destination = await screenPoint(page, {
      x: first.prop.x + 0.5 + command.target.x - group.area.x,
      y: first.prop.y + 0.5 + command.target.y - group.area.y,
    });
    await page.mouse.move(dragStart.x, dragStart.y);
    await page.mouse.down();
    await page.mouse.move(destination.x, destination.y, { steps: 6 });
    await expect(page.locator('.placement-status')).toHaveText('Valid position — release to place');
    await page.mouse.up();
    const moved = await snapshot(page, 'Moved addition'),
      expected = applyObjectCommand(prepared, command);
    if (!expected.ok) throw Error(expected.error);
    expect(moved).toEqual(expected.document);
    const image = await png(page);
    await page.getByRole('button', { name: 'Undo map change', exact: true }).click();
    await ready(page);
    expect(await snapshot(page, 'Undone addition')).toEqual(prepared);
    await page.getByRole('button', { name: 'Redo map change', exact: true }).click();
    await ready(page);
    expect(await png(page)).toEqual(image);
    await page.reload();
    await page
      .locator('.saved-item')
      .filter({ has: page.locator('.saved-name').getByText('Moved addition', { exact: true }) })
      .getByRole('button', { name: 'Open', exact: true })
      .click();
    await ready(page);
    expect(await png(page)).toEqual(image);
    await page.getByRole('button', { name: 'Edit objects', exact: true }).click();
    await select.selectOption(`group-${id}`);
    await page
      .locator('forge-object-editor')
      .screenshot({ path: `artifacts/editor-movement/${id}-moved.png` });
    if (id === 'study') {
      await page.setViewportSize({ width: 375, height: 812 });
      await select.focus();
      await expect(select).toBeFocused();
      await position(page, { x: 0, y: 0 });
      await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeDisabled();
      await page
        .locator('forge-object-editor')
        .screenshot({ path: 'artifacts/editor-movement/study-mobile.png' });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
  });

test('a standalone rug can move as a complete three-square visual object and is available from the catalog', async ({
  page,
}) => {
  const generated = generateDungeon({
    seed: 'mosslit-sanctum',
    roomCount: 6,
    density: 'Balanced',
    preset: 'Mosslit',
  });
  if (!generated.ok) throw Error(generated.error);
  const rug = dungeonInstances(generated.map).find((item) => item.prop.kind === 'rug');
  if (!rug) throw Error('Missing rug');
  let prepared: DungeonDocument = generated.map;
  for (const item of dungeonInstances(prepared))
    if (item.id !== rug.id && !individualObjectLock(generated.map, item.id, item.prop)) {
      const result = applyObjectCommand(prepared, { kind: 'remove', id: item.id });
      if (!result.ok) throw Error(result.error);
      prepared = result.document;
    }
  const command = validCommand(
    prepared,
    (target) => ({ kind: 'move', id: rug.id, target }),
    rug.prop,
  );
  if (command.kind !== 'move') throw Error('Missing rug move');
  await openDocument(page, prepared);
  const select = page.getByRole('combobox', { name: 'Objects on this map', exact: true });
  await select.selectOption(rug.id);
  await position(page, command.target);
  await page.getByRole('button', { name: 'Place object', exact: true }).click();
  expect(
    dungeonInstances(await snapshot(page, 'Moved rug')).find((item) => item.id === rug.id)?.prop,
  ).toMatchObject({ x: command.target.x, y: command.target.y });
  await page.getByRole('button', { name: 'Add object', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add Rug', exact: true })).toBeVisible();
  await page
    .locator('forge-object-editor')
    .screenshot({ path: 'artifacts/editor-movement/rug-catalog.png' });
  expect(dungeonBase(prepared)).toEqual(generated.map);
});
