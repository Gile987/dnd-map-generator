import { createCanvas } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { generateDungeon } from '../src/app/engine/generate';
import { generateCourtyard } from '../src/app/engine/courtyard-generate';
import type { GeneratedMap } from '../src/app/engine/model';
import {
  makeSavedMap,
  parseBundle,
  parseSavedMap,
  SAVE_STORAGE_KEY,
} from '../src/app/save/save-format';
import type { SavedMap } from '../src/app/save/save-format';
import { renderMap } from '../src/app/rendering/render-map';

const dungeon = generateDungeon({
  seed: 'shared-vault',
  roomCount: 4,
  density: 'Sparse',
  preset: 'Crypt',
  scene: 'Forgotten study',
});
const courtyard = generateCourtyard({ seed: 'ivy-court', density: 'Balanced', fountain: true });
const legacy = parseBundle(readFileSync('src/app/save/fixtures/forest-v3.json', 'utf8'));
if (!dungeon.ok || !courtyard.ok || !legacy.ok || !legacy.maps[0])
  throw new Error('Missing share fixtures');

function saved(map: GeneratedMap, name: string, id: string): SavedMap {
  const canvas = createCanvas(320, 240);
  renderMap(canvas.getContext('2d'), map, { grid: false, pixelsPerTile: 8 });
  return {
    ...makeSavedMap(map, name, canvas.toDataURL(), id, '2026-10-28T10:00:00Z'),
    favorite: true,
  };
}
const records = [
  saved(dungeon.map, 'Forgotten study', 'study'),
  { ...legacy.maps[0], name: 'Historical clearing' },
  saved(courtyard.map, 'Ivy court', 'court'),
];
if (records.some((record) => !parseSavedMap(record))) throw new Error('Invalid share fixture');
const item = (page: Page, name: string) =>
  page
    .locator('.saved-item')
    .filter({ has: page.locator('.saved-name').getByText(name, { exact: true }) });
const share = (card: Locator) => card.getByRole('button', { name: 'Export this map', exact: true });

async function seed(page: Page, data: unknown = records) {
  await page.addInitScript(
    ({ key, raw }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, raw);
    },
    { key: SAVE_STORAGE_KEY, raw: JSON.stringify(data) },
  );
  await page.goto('/');
}
async function file(page: Page, button: Locator) {
  const pending = page.waitForEvent('download');
  await button.click();
  const result = await pending;
  const path = await result.path();
  if (!path) throw new Error('Missing downloaded map');
  return { name: result.suggestedFilename(), bytes: await readFile(path) };
}
const disk = (page: Page) => page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY);

for (const record of records) {
  test(`${record.map.type} shared snapshot round-trips into a fresh library with identical PNG artwork`, async ({
    page,
    browser,
  }) => {
    await seed(page);
    await page.getByLabel('World seed').fill('unapplied-sharing-draft');
    await page.locator('#save-name').fill('Unfinished name');
    await page.getByRole('searchbox', { name: 'Search saved maps' }).fill(record.name);
    const stored = await disk(page);
    const displayed = await page.locator('#map-summary').textContent();
    const exported = await file(page, share(item(page, record.name)));
    expect(exported.name).toMatch(/^encounter-map-[a-zA-Z0-9_-]+\.json$/);
    expect(parseBundle(exported.bytes.toString())).toEqual({
      ok: true,
      maps: [record],
      skipped: 0,
    });
    expect(await disk(page)).toBe(stored);
    await expect(page.locator('#map-summary')).toHaveText(displayed ?? '');
    await expect(page.getByLabel('World seed')).toHaveValue('unapplied-sharing-draft');
    await expect(page.locator('#save-name')).toHaveValue('Unfinished name');
    await expect(page.getByRole('searchbox', { name: 'Search saved maps' })).toHaveValue(
      record.name,
    );
    const context = await browser.newContext();
    try {
      const receiver = await context.newPage();
      await receiver.goto('http://127.0.0.1:4200');
      await receiver.setInputFiles('.import-label input', {
        name: exported.name,
        mimeType: 'application/json',
        buffer: exported.bytes,
      });
      await expect(receiver.locator('.library-message .notice')).toHaveText('Imported 1 map.');
      const received: unknown = JSON.parse((await disk(receiver)) ?? '[]');
      expect(received).toEqual([record]);
      await receiver.setInputFiles('.import-label input', {
        name: exported.name,
        mimeType: 'application/json',
        buffer: exported.bytes,
      });
      await expect(receiver.locator('.library-message .notice')).toHaveText(
        'Imported 0 maps; 1 entry skipped.',
      );
      await item(receiver, record.name).getByRole('button', { name: 'Open', exact: true }).click();
      const remote = await file(
        receiver,
        receiver.getByRole('button', { name: 'Quick export PNG', exact: true }),
      );
      await item(page, record.name).getByRole('button', { name: 'Open', exact: true }).click();
      expect(
        await file(page, page.getByRole('button', { name: 'Quick export PNG', exact: true })),
      ).toEqual(remote);
    } finally {
      await context.close();
    }
  });
}

test('download failure retains the record, focus, and retry opportunity', async ({ page }) => {
  await seed(page);
  const stored = await disk(page);
  await page.evaluate(() => {
    const original = URL.createObjectURL;
    URL.createObjectURL = () => {
      URL.createObjectURL = original;
      throw new Error('blocked');
    };
  });
  const button = share(item(page, 'Forgotten study'));
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.library-message .error')).toContainText(
    'map file could not be downloaded',
  );
  await expect(button).toBeFocused();
  expect(await disk(page)).toBe(stored);
  const exported = await file(page, button);
  expect(parseBundle(exported.bytes.toString())).toMatchObject({ ok: true, maps: [records[0]] });
  await expect(page.locator('.library-message .error')).toBeEmpty();
});

test('sharing reads cross-tab edits and refuses a stale deleted record without exporting it', async ({
  page,
  context,
}) => {
  await page.addInitScript(() =>
    window.addEventListener('storage', (event) => event.stopImmediatePropagation(), true),
  );
  await seed(page);
  const other = await context.newPage();
  await other.goto('/');
  const latest = { ...records[0], name: 'Renamed elsewhere', favorite: false };
  await other.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: SAVE_STORAGE_KEY,
    data: [latest, ...records.slice(1)],
  });
  await expect(item(page, 'Forgotten study')).toBeVisible();
  const exported = await file(page, share(item(page, 'Forgotten study')));
  expect(parseBundle(exported.bytes.toString())).toMatchObject({ ok: true, maps: [latest] });
  expect(exported.name).toBe('encounter-map-Renamed-elsewhere.json');
  await other.evaluate((key) => localStorage.setItem(key, '[]'), SAVE_STORAGE_KEY);
  await share(item(page, 'Renamed elsewhere')).click();
  await expect(page.locator('.library-message .error')).toContainText('no longer in the library');
  await expect(page.getByRole('searchbox', { name: 'Search saved maps' })).toBeFocused();
  expect(await disk(page)).toBe('[]');
});

test('readable maps remain exportable during library recovery', async ({ page }) => {
  await seed(page, [...records, null]);
  const stored = await disk(page);
  await expect(page.getByRole('button', { name: 'Save map', exact: true })).toBeDisabled();
  const exported = await file(page, share(item(page, 'Historical clearing')));
  expect(parseBundle(exported.bytes.toString())).toMatchObject({ ok: true, maps: [records[1]] });
  expect(await disk(page)).toBe(stored);
});

test('a rejected shared file preserves the accepted map, drafts, and stored library', async ({
  page,
}) => {
  await seed(page);
  const stored = await disk(page);
  await page.getByLabel('World seed').fill('keep-after-rejection');
  const accepted = await page.locator('#map-summary').textContent();
  await page.setInputFiles('.import-label input', {
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"format":"unknown","maps":[]}'),
  });
  await expect(page.locator('.library-message .error')).toContainText(
    'not an Encounter Map Forge backup',
  );
  await expect(page.locator('#map-summary')).toHaveText(accepted ?? '');
  await expect(page.getByLabel('World seed')).toHaveValue('keep-after-rejection');
  expect(await disk(page)).toBe(stored);
});

for (const width of [320, 768, 1440]) {
  test(`share actions wrap and retain visible keyboard focus at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await seed(page);
    const card = item(page, 'Forgotten study');
    const open = card.getByRole('button', { name: 'Open', exact: true });
    await open.focus();
    await page.keyboard.press('Tab');
    await expect(share(card)).toBeFocused();
    expect(await share(card).evaluate((el) => el.matches(':focus-visible'))).toBe(true);
    await expect(share(card)).toHaveAccessibleDescription(/one saved map as JSON/);
    const bounds = await card.boundingBox();
    if (!bounds) throw new Error('Missing saved card');
    for (const button of await card.locator('.saved-actions button').all()) {
      const box = await button.boundingBox();
      if (!box) throw new Error('Missing action');
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await card.screenshot({ path: `artifacts/f17/sharing-${width}.png` });
    await page.evaluate(() => {
      const original = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (callback) {
        HTMLCanvasElement.prototype.toBlob = original;
        document.addEventListener('release-sharing-export', () => callback(null), { once: true });
        document.documentElement.dataset['sharingHeld'] = 'true';
      };
    });
    await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-sharing-held', 'true');
    await expect(share(card)).toBeDisabled();
    await page.evaluate(() => document.dispatchEvent(new Event('release-sharing-export')));
    await expect(share(card)).toBeEnabled();
  });
}
