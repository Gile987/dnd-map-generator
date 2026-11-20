import { expect, test } from '@playwright/test';

for (const [width, height, type] of [
  [1440, 1000, 'Dungeon'],
  [800, 420, 'Forest'],
  [768, 900, 'Courtyard'],
  [320, 700, 'Tower'],
] as const) {
  test.describe(`${type} controls`, () => {
    test.use({ hasTouch: width === 320 });
    test(`${width}px map controls stay compact, aligned and keyboard accessible`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await page.getByRole('radio', { name: type, exact: true }).check();
      await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
      await page.getByRole('button', { name: 'Focus map', exact: true }).click();
      const pin = page.getByRole('button', { name: 'Pin this map', exact: true });
      await expect(
        page.locator('.map-toolbar').getByRole('button', { name: 'Pin this map', exact: true }),
      ).toBeVisible();
      await expect(page.getByRole('group', { name: 'Map comparison', exact: true })).toHaveCount(0);
      if (width >= 800) {
        const head = await page.locator('.map-toolbar').boundingBox();
        expect(head?.height).toBeLessThanOrEqual(74);
      }
      await pin.hover();
      await expect(page.getByRole('tooltip')).toBeVisible();
      await page.mouse.move(0, 0);
      await expect(page.getByRole('tooltip')).toBeHidden();
      await pin.focus();
      await expect(page.getByRole('tooltip')).toContainText('Pins last until refresh');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('tooltip')).toBeHidden();
      await expect(
        page.getByRole('button', { name: 'Back to workbench', exact: true }),
      ).toBeVisible();
      await pin.click();
      await expect(
        page.getByRole('group', { name: 'Displayed candidate', exact: true }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Pinned', exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Replace pinned map', exact: true }),
      ).toHaveAttribute('aria-disabled', 'true');
      await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
      await expect(page.getByLabel('Zoom level')).toHaveText('125%');
      await page.getByRole('button', { name: 'Fit', exact: true }).click();
      await expect(page.getByLabel('Zoom level')).toHaveText('100%');
      await page.screenshot({
        path: `artifacts/compact-map-controls/${width}-pinned.png`,
        fullPage: true,
      });
      await page.getByRole('button', { name: 'Clear pin', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Pin this map', exact: true })).toBeFocused();
      await page.getByRole('button', { name: 'Edit objects', exact: true }).click();
      const actions = page.locator('.editor-actions');
      const controls = [
        actions.getByRole('button', { name: 'Add object', exact: true }),
        page.getByRole('combobox', { name: 'Objects on this map', exact: true }),
        actions.getByRole('button', { name: 'Reset customizations', exact: true }),
      ];
      const boxes = await Promise.all(controls.map((control) => control.boundingBox()));
      if (boxes.some((box) => !box)) throw Error('Missing editor control');
      const first = boxes[0];
      if (!first) throw Error('Missing add button');
      for (const box of boxes) {
        if (!box) continue;
        expect(Math.abs(box.y - first.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(box.height - first.height)).toBeLessThanOrEqual(1);
        expect(box.height).toBeGreaterThanOrEqual(width === 320 ? 44 : 36);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `artifacts/compact-map-controls/${width}.png`,
        fullPage: true,
      });
    });
  });
}
