import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { PNG } from './png';

test('initial preview, draft settings, detail revision and full-map PNG', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await expect(page.locator('#map-summary')).toContainText('mosslit-sanctum');
  await expect(page.locator('p[role="status"]')).toContainText('ready');
  await expect(canvas).toHaveJSProperty(
    'width',
    await canvas.evaluate((element) =>
      Math.round(element.getBoundingClientRect().width * devicePixelRatio),
    ),
  );
  mkdirSync('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/desktop.png', fullPage: true });

  await page.getByLabel('World seed').fill('unapplied-seed');
  await expect(page.getByText('Layout edits ready. Generate to apply.')).toBeVisible();
  await page.getByRole('button', { name: 'Shuffle details' }).click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  await expect(page.locator('#map-summary')).toContainText('mosslit-sanctum');
  await expect(page.locator('#map-summary')).not.toContainText('unapplied-seed');
  await page.getByRole('radio', { name: 'Cluttered' }).check();
  await expect(page.locator('#map-summary')).toContainText('Cluttered');
  await expect(page.locator('#map-summary')).toContainText('r1');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.getByLabel('Zoom level')).toHaveText('125%');
  await canvas.focus();
  await page.keyboard.press('ArrowRight');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    'encounter-mosslit-sanctum-mosslit-cluttered-r1-v2.0.0.png',
  );
  await download.saveAs('artifacts/browser-export.png');
  const png = await PNG.read('artifacts/browser-export.png');
  expect(png).toEqual({ width: 2560, height: 1920 });
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await expect(page.getByLabel('Zoom level')).toHaveText('100%');
  const fittedDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG' }).click();
  await (await fittedDownload).saveAs('artifacts/browser-export-fit.png');
  expect(await readFile('artifacts/browser-export-fit.png')).toEqual(
    await readFile('artifacts/browser-export.png'),
  );
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  await expect(page.locator('#map-summary')).toContainText('unapplied-seed');
  await expect(page.locator('#map-summary')).toContainText('r0');
  await expect(page.getByText('Layout edits ready. Generate to apply.')).not.toBeVisible();
  expect(errors).toEqual([]);
});

test('invalid drafts keep the last map, corrected input succeeds, and new seed generates immediately', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('World seed').fill('   ');
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  await expect(page.getByRole('alert')).toContainText('seed between 1 and 64');
  await expect(page.locator('#map-summary')).toContainText('mosslit-sanctum');
  await page.getByLabel('World seed').fill('  recovery-test  ');
  await page.getByRole('spinbutton', { name: 'Rooms' }).fill('4.5');
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  await expect(page.getByRole('alert')).toContainText('whole number');
  await page.getByRole('spinbutton', { name: 'Rooms' }).fill('');
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  await expect(page.getByRole('alert')).toContainText('whole number');
  await page.getByRole('spinbutton', { name: 'Rooms' }).fill('4');
  await page.getByRole('button', { name: 'Generate dungeon' }).click();
  await expect(page.locator('#settings-error')).toBeEmpty();
  await expect(page.locator('#map-summary')).toContainText('recovery-test');
  await expect(page.locator('#map-summary')).toContainText('4 connected');
  await expect(page.getByLabel('World seed')).toHaveValue('recovery-test');
  await page.getByRole('button', { name: 'New seed', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('dungeon-');
  await expect(page.locator('#map-summary')).not.toContainText('recovery-test');
});

test('room stepper normalizes drafts so its buttons agree with the value they set', async ({
  page,
}) => {
  await page.goto('/');
  const rooms = page.getByRole('spinbutton', { name: 'Rooms' });
  const fewer = page.getByRole('button', { name: 'Fewer rooms' });
  const more = page.getByRole('button', { name: 'More rooms' });

  await rooms.fill('');
  await expect(fewer).toBeEnabled();
  await expect(more).toBeEnabled();
  await more.click();
  await expect(rooms).toHaveValue('7');
  await fewer.click();
  await expect(rooms).toHaveValue('6');

  await rooms.fill('');
  await fewer.click();
  await expect(rooms).toHaveValue('5');

  await rooms.fill('4.5');
  await expect(fewer).toBeDisabled();
  await expect(more).toBeEnabled();
  await more.click();
  await expect(rooms).toHaveValue('5');

  await rooms.fill('4');
  await expect(fewer).toBeDisabled();
  await expect(more).toBeEnabled();
  await rooms.fill('8');
  await expect(more).toBeDisabled();
  await expect(fewer).toBeEnabled();
  await fewer.click();
  await expect(rooms).toHaveValue('7');
});

test('grid, pointer pan, keyboard zoom, ordinary scrolling and responsive resize', async ({
  page,
}) => {
  await page.goto('/');
  const canvas = page.locator('canvas');
  const initial = await canvas.evaluate((el) =>
    el instanceof HTMLCanvasElement ? el.toDataURL() : '',
  );
  await page.getByRole('checkbox', { name: 'Grid', exact: true }).uncheck();
  await expect
    .poll(() => canvas.evaluate((el) => (el instanceof HTMLCanvasElement ? el.toDataURL() : '')))
    .not.toBe(initial);
  await page.getByRole('checkbox', { name: 'Grid', exact: true }).check();
  await expect
    .poll(() => canvas.evaluate((el) => (el instanceof HTMLCanvasElement ? el.toDataURL() : '')))
    .toBe(initial);
  await canvas.focus();
  await page.keyboard.press('+');
  await expect(page.getByLabel('Zoom level')).toHaveText('125%');
  const beforePan = await canvas.evaluate((el) =>
    el instanceof HTMLCanvasElement ? el.toDataURL() : '',
  );
  const rect = await canvas.boundingBox();
  if (!rect) throw new Error('Canvas is not visible.');
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 + 60, rect.y + rect.height / 2 + 40, { steps: 5 });
  await page.mouse.up();
  expect(
    await canvas.evaluate((el) => (el instanceof HTMLCanvasElement ? el.toDataURL() : '')),
  ).not.toBe(beforePan);
  await canvas.focus();
  await page.keyboard.press('Home');
  await expect(page.getByLabel('Zoom level')).toHaveText('100%');
  await page.mouse.wheel(0, 100);
  await expect(page.getByLabel('Zoom level')).toHaveText('100%');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Generate dungeon' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/mobile.png', fullPage: true });
  await expect(page.locator('#map-summary')).toContainText('mosslit-sanctum');
  for (const width of [320, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${width}px viewport`,
    ).toBe(true);
  }
});

test('preset selection applies immediately, interacts with pending drafts, and appears in export filename', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#map-summary')).toContainText('Mosslit');
  await page.getByRole('radio', { name: 'Crypt', exact: true }).check();
  await expect(page.locator('#map-summary')).toContainText('Crypt');
  await expect(page.locator('#map-summary')).toContainText('mosslit-sanctum');
  await expect(page.getByText('Layout edits ready.')).not.toBeVisible();

  await page.getByLabel('World seed').fill('draft-seed');
  await expect(page.getByText('Layout edits ready. Generate to apply.')).toBeVisible();
  await expect(page.locator('#map-summary')).toContainText('Crypt');
  await expect(page.locator('#map-summary')).not.toContainText('draft-seed');

  await page.getByRole('radio', { name: 'Sanctuary', exact: true }).check();
  await expect(page.locator('#map-summary')).toContainText('Sanctuary');
  await expect(page.locator('#map-summary')).not.toContainText('draft-seed');

  await page.getByRole('button', { name: 'Shuffle details' }).click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  await page.getByRole('radio', { name: 'Storehouse', exact: true }).check();
  await expect(page.locator('#map-summary')).toContainText('Storehouse');
  await expect(page.locator('#map-summary')).toContainText('r1');

  await page.getByRole('radio', { name: 'Cluttered' }).check();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    'encounter-mosslit-sanctum-storehouse-cluttered-r1-v2.0.0.png',
  );
});

test('export failure is reported and controls recover', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      setTimeout(() => callback(null), 300);
    };
  });
  await page.getByRole('button', { name: 'Export PNG' }).click();
  await expect(page.getByRole('button', { name: 'Generate dungeon' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Shuffle details' })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('could not create a PNG');
  await expect(page.getByRole('button', { name: 'Generate dungeon' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Export PNG' })).toBeEnabled();
  await expect(page.locator('#map-summary')).toContainText('mosslit-sanctum');
  await page.getByRole('button', { name: 'Shuffle details' }).click();
  await expect(page.locator('#map-summary')).toContainText('r1');
  await expect(page.locator('#settings-error')).toBeEmpty();
});
