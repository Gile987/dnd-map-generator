import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  courtyardEditorFixture,
  courtyardGroupFixture,
  clearCourtyard,
  acceptCourtyard,
} from '../scripts/courtyard-editor-test-support';
import {
  courtyardInstances,
  courtyardBase,
} from '../src/app/engine/object-editor/courtyard-document';
import type { CourtyardDocument } from '../src/app/engine/object-editor/courtyard-document';
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
async function openMap(page: Page, map: CourtyardDocument) {
  await page.goto('/');
  const saved = makeSavedMap(
    map,
    'Prepared courtyard',
    'data:image/png;base64,AAAA',
    'court-editor',
    '2026-11-03T12:00:00Z',
  );
  await page.locator('input[type=file]').setInputFiles({
    name: 'courtyard.json',
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
  if (saved?.map.type !== 'courtyard') throw Error('Missing saved courtyard');
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

for (const cover of ['fern', 'vine'] as const) {
  test(`the fountain can be dragged onto ${cover} ground cover, names it underneath, and reopens exactly`, async ({
    page,
  }) => {
    const base = courtyardEditorFixture(),
      prepared = clearCourtyard(base);
    const source =
      cover === 'fern'
        ? acceptCourtyard(prepared, { kind: 'add', propKind: 'fern', target: { x: 2, y: 2 } })
        : prepared;
    const target = cover === 'fern' ? { x: 0, y: 0 } : { x: 12, y: 8 };
    const fountain = courtyardInstances(source).find((item) => item.prop.kind === 'dry_fountain');
    if (!fountain) throw Error('Missing fountain');
    await openMap(page, source);
    await edit(page);
    const start = await point(page, { x: fountain.prop.x + 1.5, y: fountain.prop.y + 1.5 });
    const end = await point(page, { x: target.x + 2.5, y: target.y + 2.5 });
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 6 });
    await expect(page.locator('.placement-status')).toContainText('Valid position');
    await page.mouse.up();
    const name = `Fountain over ${cover}`;
    const expected = acceptCourtyard(source, {
      kind: 'move-group',
      id: 'fountain',
      target,
      rotation: 0,
    });
    expect(await snapshot(page, name)).toEqual(expected);
    await expect(
      page
        .locator('.layer-badge')
        .filter({ hasText: `${cover === 'fern' ? 'Fern' : 'Vine'} underneath` }),
    ).toBeVisible();
    await page
      .locator('forge-object-editor')
      .screenshot({ path: `artifacts/courtyard-editor/fountain-over-${cover}.png` });
    const exported = await png(page);
    await page.reload();
    await page
      .locator('.saved-item')
      .filter({ has: page.getByText(name, { exact: true }) })
      .getByRole('button', { name: 'Open', exact: true })
      .click();
    await ready(page);
    expect((await png(page)).hash).toBe(exported.hash);
  });
}

for (const id of ['fountain', 'wagon'] as const) {
  test(`${id} can move into the gathering space and retain exact artwork after reopening`, async ({
    page,
  }) => {
    const base = courtyardEditorFixture(),
      prepared = clearCourtyard(base);
    const target =
      id === 'fountain'
        ? { x: base.layout.encounter.x - 1, y: base.layout.encounter.y - 1 }
        : { x: base.layout.encounter.x, y: base.layout.encounter.y };
    await openMap(page, prepared);
    await edit(page);
    await objects(page).selectOption(`group-${id}`);
    await position(page, target);
    await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Place object', exact: true }).click();
    const name = `${id} in gathering space`;
    expect(await snapshot(page, name)).toEqual(
      acceptCourtyard(prepared, {
        kind: 'move-group',
        id,
        target,
        rotation: 0,
      }),
    );
    await page.locator('forge-object-editor').screenshot({
      path: `artifacts/courtyard-editor/${id}-gathering-space.png`,
    });
    const exported = await png(page);
    await page.reload();
    await page
      .locator('.saved-item')
      .filter({ has: page.getByText(name, { exact: true }) })
      .getByRole('button', { name: 'Open', exact: true })
      .click();
    await ready(page);
    expect((await png(page)).hash).toBe(exported.hash);
  });
}

test('the well moves as one complete addition and its sidecar reopens unchanged', async ({
  page,
}) => {
  const { base, prepared } = courtyardGroupFixture('well');
  expect(base.decoration.well).toBe(true);
  const target = { x: base.layout.encounter.x - 1, y: base.layout.encounter.y - 1 };
  await openMap(page, prepared);
  await edit(page);
  await objects(page).selectOption('group-well');
  await position(page, target);
  await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Place object', exact: true }).click();
  const name = 'well in gathering space';
  expect(await snapshot(page, name)).toEqual(
    acceptCourtyard(prepared, { kind: 'move-group', id: 'well', target, rotation: 0 }),
  );
  await expect(page.getByRole('button', { name: 'Rotate object', exact: true })).toHaveCount(0);
  await page.locator('forge-object-editor').screenshot({
    path: 'artifacts/courtyard-editor/well-gathering-space.png',
  });
  const exported = await png(page);
  await page.reload();
  await page
    .locator('.saved-item')
    .filter({ has: page.getByText(name, { exact: true }) })
    .getByRole('button', { name: 'Open', exact: true })
    .click();
  await ready(page);
  expect((await png(page)).hash).toBe(exported.hash);
});

test('Courtyard catalog, outdoor movement, pending settings, pins, undo and recoverable Generate use accepted maps', async ({
  page,
}) => {
  const base = courtyardEditorFixture(),
    column = courtyardInstances(base).find((item) => item.prop.kind === 'broken_column');
  if (!column) throw Error('Missing column');
  await openMap(page, base);
  await page.getByRole('button', { name: 'Pin this map', exact: true }).click();
  await page.getByLabel('World seed').fill('unapplied-courtyard-editor');
  await edit(page);
  await page.getByRole('button', { name: 'Add object', exact: true }).click();
  const catalog = page.getByRole('region', { name: 'Courtyard object catalog', exact: true });
  await expect(catalog.locator('.object-cards button')).toHaveCount(4);
  for (const name of ['Broken column', 'Low rubble', 'Moss', 'Fern'])
    await expect(catalog.getByRole('button', { name: `Add ${name}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add object', exact: true }).click();
  await objects(page).selectOption(column.id);
  await position(page, { x: 1, y: 1 });
  await page.getByRole('button', { name: 'Place object', exact: true }).click();
  const expected = acceptCourtyard(base, { kind: 'move', id: column.id, target: { x: 1, y: 1 } });
  expect(await snapshot(page, 'Column outdoors')).toEqual(expected);
  await expect(page.getByLabel('World seed')).toHaveValue('unapplied-courtyard-editor');
  await expect(page.getByRole('button', { name: 'Shuffle details', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Pinned', exact: true }).click();
  expect(await snapshot(page, 'Original pin')).toEqual(base);
  await expect(page.getByRole('button', { name: 'Edit objects', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Current', exact: true }).click();
  await edit(page);
  await page.getByRole('button', { name: 'Undo map change', exact: true }).click();
  expect(await snapshot(page, 'Column undo')).toEqual(base);
  await page.getByRole('button', { name: 'Redo map change', exact: true }).click();
  expect(await snapshot(page, 'Column redo')).toEqual(expected);
  await page
    .getByRole('button', { name: 'Replace customizations and generate', exact: true })
    .click();
  await ready(page);
  expect((await snapshot(page, 'Generated replacement')).objectEdits).toBeUndefined();
  await page.getByRole('button', { name: 'Undo change', exact: true }).click();
  await ready(page);
  expect(await snapshot(page, 'Recovered customization')).toEqual(expected);
});

test('the fountain moves as a whole with previews, refusal, exact undo/reset/save and PNG reopen', async ({
  page,
}) => {
  const { base, prepared, target } = courtyardGroupFixture('fountain');
  await openMap(page, prepared);
  const before = await png(page);
  await edit(page);
  await objects(page).selectOption('group-fountain');
  await expect(
    page.getByRole('button', { name: 'Rotate addition right', exact: true }),
  ).toHaveCount(0);
  await position(page, { x: 39, y: 29 });
  await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeDisabled();
  expect(await snapshot(page, 'Refused fountain')).toEqual(prepared);
  await position(page, target);
  await expect(page.getByRole('button', { name: 'Place object', exact: true })).toBeEnabled();
  expect((await png(page)).hash).toBe(before.hash);
  await position(page, target);
  await page.getByRole('button', { name: 'Place object', exact: true }).click();
  const expected = acceptCourtyard(prepared, {
    kind: 'move-group',
    id: 'fountain',
    target,
    rotation: 0,
  });
  expect(await snapshot(page, 'Fountain moved')).toEqual(expected);
  const after = await png(page);
  expect(after.hash).not.toBe(before.hash);
  expect(after.name).toContain('-customized-');
  await page
    .locator('forge-object-editor')
    .screenshot({ path: 'artifacts/courtyard-editor/fountain-moved.png' });
  await page.getByRole('button', { name: 'Undo map change', exact: true }).click();
  expect((await png(page)).hash).toBe(before.hash);
  await page.getByRole('button', { name: 'Redo map change', exact: true }).click();
  expect((await png(page)).hash).toBe(after.hash);
  await page.reload();
  await page
    .locator('.saved-item')
    .filter({ has: page.getByText('Fountain moved', { exact: true }) })
    .getByRole('button', { name: 'Open', exact: true })
    .click();
  await ready(page);
  expect((await png(page)).hash).toBe(after.hash);
  await edit(page);
  await page.getByRole('button', { name: 'Reset customizations', exact: true }).click();
  expect(await snapshot(page, 'Fountain reset')).toEqual(base);
});

test('the wagon retains all four turns, source artwork and a drag through a zoomed/panned viewport', async ({
  page,
}) => {
  const { prepared, target, group } = courtyardGroupFixture('wagon');
  await openMap(page, prepared);
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  const canvas = page.locator('forge-preview canvas');
  await canvas.focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await edit(page);
  const body = courtyardInstances(prepared).find((item) => item.prop.kind === 'collapsed_wagon');
  if (!body) throw Error('Missing wagon');
  const b = propBounds(body.prop),
    center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const start = await point(page, center, 1.25, { x: 40, y: 80 });
  const finish = await point(
    page,
    { x: center.x + target.x - group.area.x, y: center.y + target.y - group.area.y },
    1.25,
    { x: 40, y: 80 },
  );
  const viewport = await canvas.boundingBox();
  if (!viewport) throw Error('Missing viewport');
  expect(finish.x).toBeGreaterThan(viewport.x);
  expect(finish.y).toBeGreaterThan(viewport.y);
  expect(finish.x).toBeLessThan(viewport.x + viewport.width);
  expect(finish.y).toBeLessThan(viewport.y + viewport.height);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(finish.x, finish.y, { steps: 6 });
  await page.mouse.up();
  let expected = acceptCourtyard(prepared, { kind: 'move-group', id: 'wagon', target });
  expect(await snapshot(page, 'Dragged wagon')).toEqual(expected);
  for (let turn = 1; turn <= 4; turn++) {
    await objects(page).selectOption('group-wagon');
    await page.getByRole('button', { name: 'Rotate addition right', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Valid position' })).toBeVisible();
    await page.getByRole('button', { name: 'Place object', exact: true }).click();
    expected = acceptCourtyard(expected, {
      kind: 'move-group',
      id: 'wagon',
      target,
      rotation: (turn % 4) as 0 | 1 | 2 | 3,
    });
    expect(await snapshot(page, `Wagon turn ${turn}`)).toEqual(expected);
  }
  await objects(page).selectOption('group-wagon');
  await page.getByRole('button', { name: 'Rotate addition right', exact: true }).click();
  await canvas.focus();
  await page.keyboard.press('Escape');
  expect(await snapshot(page, 'Canceled rotation')).toEqual(expected);
  await page
    .locator('forge-object-editor')
    .screenshot({ path: 'artifacts/courtyard-editor/wagon-controls.png' });
});

test('Courtyard layering names hidden objects and annotated previews match downloaded PNGs without changing JSON', async ({
  page,
}) => {
  const prepared = clearCourtyard(courtyardEditorFixture());
  await openMap(page, prepared);
  await edit(page);
  for (const name of ['Moss', 'Broken column']) {
    await page.getByRole('button', { name: 'Add object', exact: true }).click();
    await page.getByRole('button', { name: `Add ${name}`, exact: true }).click();
    await position(page, { x: 1, y: 1 });
    await page.getByRole('button', { name: 'Place object', exact: true }).click();
  }
  await objects(page).selectOption('added-1');
  await page.getByRole('button', { name: 'Bring forward', exact: true }).click();
  const badge = page.getByRole('button', { name: /^Moss: Broken column underneath/ });
  await expect(badge).toHaveText('Broken column underneath');
  await badge.click();
  await page
    .getByRole('region', { name: 'Overlapping objects' })
    .getByRole('button', { name: /^Broken column · column/ })
    .click();
  await expect(objects(page)).toHaveValue('added-2');
  const before = await snapshot(page, 'Covered column');
  await page.getByRole('button', { name: 'Export options', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export options', exact: true }),
    toggle = dialog.getByRole('checkbox', { name: 'Show layer indicators', exact: true });
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await expect(dialog.getByRole('button', { name: 'Download PNG', exact: true })).toBeEnabled({
    timeout: 10000,
  });
  const image = dialog.getByRole('img', { name: 'Full map PNG preview', exact: true });
  const bytes = await image.evaluate(async (img: HTMLImageElement) =>
    Array.from(new Uint8Array(await (await fetch(img.src)).arrayBuffer())),
  );
  const pending = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download PNG', exact: true }).click();
  const file = await pending;
  expect(
    createHash('sha256')
      .update(await readFile(await file.path()))
      .digest('hex'),
  ).toBe(createHash('sha256').update(Buffer.from(bytes)).digest('hex'));
  expect(file.suggestedFilename()).toMatch(/-layers.png$/);
  await dialog.screenshot({ path: 'artifacts/courtyard-editor/annotated-export.png' });
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  expect(await snapshot(page, 'Export preserved')).toEqual(before);
  expect(courtyardBase(before)).toEqual(courtyardBase(prepared));
});

test.describe('mobile touch workspace', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, deviceScaleFactor: 2 });
  test('catalog taps, keyboard placement, hidden-object controls, pinned guards and failed exports recover', async ({
    page,
  }) => {
    const prepared = clearCourtyard(courtyardEditorFixture());
    const moss = acceptCourtyard(prepared, {
        kind: 'add',
        propKind: 'moss',
        target: { x: 1, y: 1 },
      }),
      column = acceptCourtyard(moss, {
        kind: 'add',
        propKind: 'broken_column',
        target: { x: 1, y: 1 },
      });
    const covered = acceptCourtyard(column, { kind: 'order', id: 'added-1', direction: 'forward' });
    await openMap(page, covered);
    await edit(page);
    await objects(page).selectOption('added-1');
    const back = page.getByRole('button', { name: 'Send backward', exact: true });
    await back.focus();
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
    await position(page, { x: 2, y: 1 });
    const place = page.getByRole('button', { name: 'Place object', exact: true });
    await place.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Pin this map', exact: true }).click();
    await page.getByRole('button', { name: 'Pinned', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit objects', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: /^Moss: Broken column underneath/ }).tap();
    await expect(page.getByRole('region', { name: 'Overlapping objects' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page
      .locator('forge-object-editor')
      .screenshot({ path: 'artifacts/courtyard-editor/mobile-pinned.png' });
  });
});
