import { expect, test } from '@playwright/test';
import fixture from '../src/app/save/fixtures/courtyard-v24.json';
import { SAVE_STORAGE_KEY } from '../src/app/save/save-format';

test('the deferred library reports loading, then accepts keyboard navigation and saves', async ({
  page,
}) => {
  let release: () => void = () => {
    throw Error('Library was not held');
  };
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  let intercepted = false;
  await page.route(/\.js(?:\?.*)?$/, async (route) => {
    const response = await route.fetch(),
      body = await response.text();
    if (/selectors:\s*\[\[\s*[`"']forge-library[`"']/.test(body)) {
      intercepted = true;
      await hold;
    }
    await route.fulfill({ response, body });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.library-deferred')).toHaveAttribute('aria-busy', 'true');
  await expect.poll(() => intercepted).toBe(true);
  await expect(page.locator('.library-deferred')).toContainText('Loading your library');
  release();
  await expect(page.locator('.library')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#save-name').focus();
  await page.keyboard.type('Library ready');
  await page.getByRole('button', { name: 'Save map', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.library-message .notice')).toHaveText('Saved “Library ready”.');
});

test('a failed library chunk preserves stored maps and can recover on refresh', async ({
  page,
}) => {
  const raw = JSON.stringify(fixture.maps);
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: SAVE_STORAGE_KEY,
    value: raw,
  });
  let failed = false;
  await page.route(/\.js(?:\?.*)?$/, async (route) => {
    const response = await route.fetch(),
      body = await response.text();
    if (!failed && /selectors:\s*\[\[\s*[`"']forge-library[`"']/.test(body)) {
      failed = true;
      await route.abort();
      return;
    }
    await route.fulfill({ response, body });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.library-deferred')).toContainText('The library could not load');
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)).toBe(raw);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
  await page.reload();
  await expect(page.locator('.saved-item')).toHaveCount(2);
  await expect(page.locator('.library-deferred')).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)).toBe(raw);
});
