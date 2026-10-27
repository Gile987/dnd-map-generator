import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { openAdditions } from './additions';

interface Reading {
  readonly state: string;
  readonly text: string;
  readonly foreground: string;
  readonly background: readonly number[];
  readonly ratio: number;
}

async function selectMapType(page: Page, type: 'Dungeon' | 'Forest' | 'Courtyard'): Promise<void> {
  await page.getByRole('radio', { name: type, exact: true }).check();
  await expect(
    page.getByRole('heading', {
      name:
        type === 'Courtyard'
          ? 'Shape your courtyard'
          : type === 'Forest'
            ? 'Shape your clearing'
            : 'Shape your dungeon',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('button', { name: 'Shuffle details' })).toBeEnabled();
}

async function checkContrast(
  locator: Locator,
  state: string,
  readings: Reading[],
  placeholder = false,
): Promise<void> {
  await expect(locator.first(), state).toBeVisible();
  const measured = await locator.evaluateAll((elements, placeholder) => {
    type Color = readonly [number, number, number, number];
    function color(value: string): Color {
      if (!/^rgba?\(/.test(value)) throw new Error(`Unsupported computed color: ${value}`);
      const [r, g, b, a = 1] = value.match(/[\d.]+/g)?.map(Number) ?? [];
      if (r === undefined || g === undefined || b === undefined)
        throw new Error(`Invalid computed color: ${value}`);
      return [r, g, b, a];
    }
    function over(top: Color, bottom: Color): Color {
      return [
        top[0] * top[3] + bottom[0] * (1 - top[3]),
        top[1] * top[3] + bottom[1] * (1 - top[3]),
        top[2] * top[3] + bottom[2] * (1 - top[3]),
        1,
      ];
    }
    function luminance(value: Color): number {
      const linear = (channel: number) => {
        const s = channel / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * linear(value[0]) + 0.7152 * linear(value[1]) + 0.0722 * linear(value[2]);
    }
    return elements.map((element) => {
      if (!element.isConnected)
        throw new Error(`Detached contrast sample: ${element.tagName.toLowerCase()}#${element.id}`);
      const ancestors: Element[] = [];
      for (let current: Element | null = element; current; current = current.parentElement)
        ancestors.push(current);
      let background: Color | undefined;
      for (const ancestor of ancestors.reverse()) {
        const style = getComputedStyle(ancestor);
        if (style.backgroundImage !== 'none' || Number(style.opacity) !== 1)
          throw new Error(
            `Cannot measure ${element.tagName.toLowerCase()}#${element.id}.${element.className}: ` +
              `${ancestor.tagName.toLowerCase()}#${ancestor.id}.${ancestor.className} has ` +
              `background-image ${style.backgroundImage} and opacity ${style.opacity}. ` +
              `Text: ${element.textContent?.trim()}`,
          );
        const layer = color(style.backgroundColor);
        if (background) background = over(layer, background);
        else if (layer[3] === 1) background = layer;
      }
      if (!background) throw new Error('A sample has no opaque background.');
      const style = getComputedStyle(element, placeholder ? '::placeholder' : null);
      const foreground = color(style.color);
      const painted = over(
        [foreground[0], foreground[1], foreground[2], foreground[3] * Number(style.opacity)],
        background,
      );
      const a = luminance(painted);
      const b = luminance(background);
      return {
        text: placeholder
          ? (element.getAttribute('placeholder') ?? '')
          : element instanceof HTMLInputElement
            ? element.value
            : (element.textContent?.trim() ?? ''),
        foreground: style.color,
        background: background.slice(0, 3),
        ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      };
    });
  }, placeholder);
  expect(measured.length, state).toBeGreaterThan(0);
  for (const reading of measured) {
    const row = { ...reading, state };
    readings.push(row);
    expect.soft(reading.text.length, state).toBeGreaterThan(0);
    expect.soft(reading.ratio, JSON.stringify(row)).toBeGreaterThanOrEqual(4.5);
  }
}

for (const width of [1440, 768, 320]) {
  test(`enabled interface text meets 4.5:1 contrast at ${width}px`, async ({ page }, testInfo) => {
    const readings: Reading[] = [];
    await page.setViewportSize({ width, height: 1100 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    if (width <= 800) {
      const shortcuts = page.getByRole('navigation', { name: 'Workbench sections' });
      await checkContrast(shortcuts.getByRole('link'), 'section shortcuts', readings);
      const settings = shortcuts.getByRole('link', { name: 'Settings' });
      await settings.hover();
      await checkContrast(settings, 'section shortcut hover', readings);
      await page.keyboard.press('Tab');
      await settings.focus();
      await checkContrast(settings, 'section shortcut keyboard focus', readings);
      await page.getByLabel('World seed').fill('pending-navigation-contrast');
      await checkContrast(settings, 'section shortcut pending changes', readings);
      await page.getByRole('button', { name: 'Reset changes', exact: true }).click();
    }
    await checkContrast(
      page.locator(
        [
          '.brand-subtitle',
          '.header-note',
          '.local-badge',
          '.eyebrow',
          '.intro-copy',
          '.edition > span',
          '.edition small',
          '.legend > span:not(.legend-divider)',
          '.export-action > span',
          '.export-action small',
          '.status',
          'footer > span',
          '.library-note',
          '.library-empty',
          '.save-name-label',
          '.section-number',
          '.map-heading > div > span',
          '.map-meta > div > span',
          '.map-meta strong',
          '.grid-toggle',
          '.pan-hint',
          '.wheel-hint',
          '.zoom-controls output',
          '.fit',
          '.export-options-button',
          '.export-button',
        ]
          .map((selector) => `${selector}:visible`)
          .join(','),
      ),
      'page and empty library',
      readings,
    );
    const saveName = page.locator('#save-name');
    await checkContrast(saveName, 'save placeholder', readings, true);
    await saveName.hover();
    await checkContrast(saveName, 'save placeholder hover', readings, true);
    await saveName.focus();
    await checkContrast(saveName, 'save placeholder focus', readings, true);
    for (const type of ['Dungeon', 'Forest', 'Courtyard'] as const) {
      await selectMapType(page, type);
      await page.getByRole('button', { name: 'Export options', exact: true }).click();
      const exportDialog = page.getByRole('dialog', { name: 'Export options', exact: true });
      await expect(exportDialog.getByRole('img')).toHaveJSProperty('naturalWidth', 2560);
      await checkContrast(
        exportDialog.locator(
          'h2, .eyebrow, #export-hint, legend, .grid-option, .opacity-field label, output, #export-grid-hint, .map-source strong, .map-source span, figcaption, .actions button',
        ),
        `${type} export options`,
        readings,
      );
      await exportDialog.getByRole('button', { name: 'Done', exact: true }).click();
      await checkContrast(
        page.locator(
          [
            '.field label > span',
            '.preset-field legend > span',
            '.density-field legend > span',
            '.additions-field legend',
            '.field-bottom > span',
            '.field-hint',
            '.generate-note',
            '.details-section > p',
            '.preserve-note',
            '.style-note p',
            '.style-note strong',
            '#seed',
            '#rooms',
            '.map-type-options label > span',
          ]
            .map((selector) => `${selector}:visible`)
            .join(','),
        ),
        `${type} settings`,
        readings,
      );
      for (const label of await page
        .locator('.preset-options label, .density-options label')
        .all()) {
        const input = label.locator('input');
        const text = label.locator('span');
        await checkContrast(text, `${type} option normal`, readings);
        await label.hover();
        await checkContrast(text, `${type} option hover`, readings);
        await page.keyboard.press('Tab');
        await input.focus();
        expect(await input.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
        await checkContrast(text, `${type} option keyboard focus`, readings);
        await input.check();
        await checkContrast(text, `${type} option selected`, readings);
      }
      const picker = await openAdditions(page);
      await checkContrast(
        picker.locator(
          'h2, .eyebrow, #picker-hint, .search-field label, footer > span, .done-button',
        ),
        `${type} picker text`,
        readings,
      );
      await checkContrast(
        picker.getByRole('searchbox'),
        `${type} picker search placeholder`,
        readings,
        true,
      );
      for (const label of await picker.locator('.addition-option').all()) {
        const input = label.getByRole('checkbox');
        const text = label.locator('.addition-copy > *');
        await checkContrast(text, `${type} addition normal`, readings);
        await label.hover();
        await checkContrast(text, `${type} addition hover`, readings);
        await page.keyboard.press('Tab');
        await input.focus();
        expect(await input.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
        await checkContrast(text, `${type} addition keyboard focus`, readings);
        await input.check();
        await checkContrast(text, `${type} addition selected`, readings);
        await input.uncheck();
      }
      await picker.getByRole('button', { name: 'Done', exact: true }).click();
      await checkContrast(page.locator('.pending'), `${type} pending notice`, readings);
      const generate = page.getByRole('button', {
        name: `Generate ${type.toLowerCase()}`,
        exact: true,
      });
      for (const button of [
        generate,
        page.getByRole('button', { name: 'Shuffle details' }),
        page.getByRole('button', { name: 'Quick export PNG', exact: true }),
        page.getByRole('button', { name: 'Randomize seed', exact: true }),
        page.getByRole('button', { name: 'Reset changes', exact: true }),
      ]) {
        await checkContrast(button, `${type} action normal`, readings);
        await button.hover();
        await checkContrast(button, `${type} action hover`, readings);
        await page.keyboard.press('Tab');
        await button.focus();
        await checkContrast(button, `${type} action keyboard focus`, readings);
      }
      await generate.click();
      await expect(page.locator('.pending-settings')).toHaveCount(0);
      await expect(page.locator('.workbench')).toHaveAttribute('aria-busy', 'false');
      await expect(generate).toBeDisabled();
      await checkContrast(
        page.locator('.status, .generate-note, .style-note p, .style-note strong'),
        `${type} applied settings`,
        readings,
      );
      await page.screenshot({
        path: `artifacts/qr05/${type.toLowerCase()}-${width}.png`,
        fullPage: true,
      });
    }
    await page.locator('#save-name').fill('Readable clearing');
    await page.getByRole('button', { name: 'Save map', exact: true }).click();
    await expect(page.locator('.saved-item')).toHaveCount(1);
    await expect(page.locator('.library')).toHaveAttribute('aria-busy', 'false');
    const librarySearch = page.getByRole('searchbox', { name: 'Search saved maps', exact: true });
    await checkContrast(
      page.locator(
        '.filter-field label, #library-type, #library-sort, .favorites-filter, .library-count',
      ),
      'library browsing controls',
      readings,
    );
    await checkContrast(librarySearch, 'library search placeholder', readings, true);
    for (const control of [
      librarySearch,
      page.locator('#library-type'),
      page.locator('#library-sort'),
    ]) {
      await control.hover();
      await checkContrast(control, 'library browsing hover', readings, control === librarySearch);
      await page.keyboard.press('Tab');
      await control.focus();
      await checkContrast(control, 'library browsing focus', readings, control === librarySearch);
    }
    await librarySearch.fill('unmatched-library-search');
    await checkContrast(
      page.locator('.filtered-empty strong, .filtered-empty p, .clear-filters, .library-count'),
      'filtered library empty state',
      readings,
    );
    await page.getByRole('checkbox', { name: 'Favorites only', exact: true }).check();
    await checkContrast(page.locator('.favorites-filter'), 'favorites filter selected', readings);
    const clearFilters = page.getByRole('button', { name: 'Clear filters', exact: true });
    await clearFilters.hover();
    await checkContrast(clearFilters, 'clear filters hover', readings);
    await page.keyboard.press('Tab');
    await clearFilters.focus();
    await checkContrast(clearFilters, 'clear filters focus', readings);
    await clearFilters.click();
    await checkContrast(
      page.locator('.saved-meta > span, .saved-name, .library-message .notice'),
      'populated library',
      readings,
    );
    for (const action of await page
      .locator('.saved-actions button, .library-tools button, .import-label, .save-button')
      .all()) {
      await checkContrast(action, 'library action normal', readings);
      await action.hover();
      await checkContrast(action, 'library action hover', readings);
      await page.keyboard.press('Tab');
      const input = action.locator('input');
      if (await input.count()) await input.focus();
      else await action.focus();
      await checkContrast(action, 'library action keyboard focus', readings);
    }
    await page.getByRole('button', { name: 'Rename', exact: true }).click();
    await checkContrast(
      page.locator('.rename-form input, .rename-form button'),
      'rename controls',
      readings,
    );
    for (const button of await page.locator('.rename-form button').all()) {
      await button.hover();
      await checkContrast(button, 'rename action hover', readings);
      await page.keyboard.press('Tab');
      await button.focus();
      await checkContrast(button, 'rename action keyboard focus', readings);
    }
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.setInputFiles('.import-label input', {
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from('invalid'),
    });
    await expect(page.locator('.library-message .error')).not.toBeEmpty();
    await expect(page.locator('.library')).toHaveAttribute('aria-busy', 'false');
    await checkContrast(page.locator('.library-message .error'), 'library error', readings);
    await page.getByLabel('World seed').fill('');
    await page.getByRole('button', { name: 'Generate courtyard', exact: true }).click();
    await expect(page.locator('#settings-error')).not.toBeEmpty();
    await checkContrast(page.locator('#settings-error, .pending'), 'settings error', readings);
    await page.locator('.library').screenshot({ path: `artifacts/qr05/library-${width}.png` });
    const path = `artifacts/qr05/contrast-${width}.json`;
    await writeFile(path, JSON.stringify(readings, null, 2));
    await testInfo.attach('contrast-readings', {
      path,
      contentType: 'application/json',
    });
  });
}

test('contrast sampling waits for the accepted map type when the change event is delayed', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Shape your dungeon', exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    function holdChange(event: Event): void {
      const input = event.target;
      if (
        !(input instanceof HTMLInputElement) ||
        input.name !== 'mapType' ||
        input.value !== 'forest'
      )
        return;
      document.removeEventListener('change', holdChange, true);
      event.stopImmediatePropagation();
      document.documentElement.dataset['mapChangeHeld'] = 'true';
      document.addEventListener(
        'release-map-change',
        () => input.dispatchEvent(new Event('change', { bubbles: true })),
        { once: true },
      );
    }
    document.addEventListener('change', holdChange, true);
  });
  let ready = false;
  const switching = selectMapType(page, 'Forest').then(() => {
    ready = true;
  });
  try {
    await expect(page.locator('html')).toHaveAttribute('data-map-change-held', 'true');
    await expect(page.getByRole('radio', { name: 'Forest', exact: true })).toBeChecked();
    await expect(
      page.getByRole('heading', { name: 'Shape your dungeon', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Shuffle details' })).toBeEnabled();
    expect(ready).toBe(false);
  } finally {
    await page.evaluate(() => document.dispatchEvent(new Event('release-map-change')));
    await switching;
  }
  expect(ready).toBe(true);
  await expect(
    page.getByRole('heading', { name: 'Shape your clearing', exact: true }),
  ).toBeVisible();
  await expect(page.locator('#rooms')).toHaveCount(0);
  await checkContrast(
    page.locator('#seed, .style-note p'),
    'accepted forest after delayed change',
    [],
  );
});
