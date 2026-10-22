import { expect, test } from '@playwright/test';

for (const width of [1440, 320]) {
  test(`Import backup has visible keyboard focus and permits an empty chooser followed by import at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1100 });
    await page.goto('/');
    await page.locator('#save-name').fill('Keyboard backup');
    await page.getByRole('button', { name: 'Save map', exact: true }).click();
    await expect(page.locator('.saved-item')).toHaveCount(1);

    const backup = page.getByRole('button', { name: 'Download backup', exact: true });
    const input = page.getByLabel('Import backup', { exact: true });
    const label = page.locator('.import-label');
    await backup.focus();
    await page.keyboard.press('Tab');
    await expect(input).toBeFocused();
    expect(await input.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
    await expect(label).toHaveCSS('outline-style', 'solid');
    await expect(label).toHaveCSS('outline-width', '2px');
    await page.locator('.library').screenshot({ path: `artifacts/qr04/focused-${width}.png` });

    const beforeSummary = await page.locator('#map-summary').textContent();
    const beforeNotice = await page.locator('.library-message .notice').textContent();
    const emptyChooser = page.waitForEvent('filechooser');
    await page.keyboard.press('Enter');
    await (await emptyChooser).setFiles([]);
    await expect(input).toHaveValue('');
    await expect(page.locator('.saved-item')).toHaveCount(1);
    await expect(page.locator('.library-message .error')).toBeEmpty();
    expect(await page.locator('.library-message .notice').textContent()).toBe(beforeNotice);
    expect(await page.locator('#map-summary').textContent()).toBe(beforeSummary);
    await expect(input).toBeFocused();
    await expect(label).toHaveCSS('outline-style', 'solid');

    const retryChooser = page.waitForEvent('filechooser');
    await page.keyboard.press('Space');
    await (await retryChooser).setFiles('src/app/save/fixtures/forest-v3.json');
    await expect(page.locator('.library-message .notice')).toContainText('Imported 3 maps');
    await expect(page.locator('.saved-item')).toHaveCount(4);
    await expect(input).toHaveValue('');
    await expect(input).toBeEnabled();
    expect(await page.locator('#map-summary').textContent()).toBe(beforeSummary);
    await page.reload();
    await expect(page.locator('.saved-item')).toHaveCount(4);
  });
}
