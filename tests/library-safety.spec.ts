import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { SAVE_STORAGE_KEY } from '../src/app/save/save-format';

function item(page: Page, name: string) {
  return page.locator('.saved-item').filter({ has: page.getByText(name, { exact: true }) });
}

async function save(page: Page, name: string): Promise<void> {
  await page.locator('#save-name').fill(name);
  await page.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(item(page, name)).toBeVisible();
}

function fixtureRecord(): Record<string, unknown> {
  const fixture: unknown = JSON.parse(readFileSync('src/app/save/fixtures/forest-v3.json', 'utf8'));
  if (
    typeof fixture !== 'object' ||
    fixture === null ||
    !('maps' in fixture) ||
    !Array.isArray(fixture.maps)
  )
    throw new Error('Expected legacy fixture');
  const record: unknown = fixture.maps[0];
  if (typeof record !== 'object' || record === null) throw new Error('Expected saved record');
  return { ...record };
}

async function seedStorage(page: Page, raw: string): Promise<void> {
  await page.addInitScript(
    ({ key, raw }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, raw);
    },
    { key: SAVE_STORAGE_KEY, raw },
  );
}

test('queued saves from two tabs commit under one lock and survive refresh', async ({
  context,
}) => {
  const first = await context.newPage();
  const second = await context.newPage();
  const holder = await context.newPage();
  await Promise.all([first.goto('/'), second.goto('/'), holder.goto('/')]);
  await expect(first.getByRole('button', { name: 'Save map', exact: true })).toBeEnabled();
  await expect(second.getByRole('button', { name: 'Save map', exact: true })).toBeEnabled();
  await holder.evaluate(() => {
    void navigator.locks.request(
      'encounter-map-forge.saves.write',
      () =>
        new Promise<void>((resolve) => {
          document.addEventListener('release-library-lock', () => resolve(), { once: true });
          document.documentElement.dataset['libraryLockHeld'] = 'true';
        }),
    );
  });
  await expect(holder.locator('html')).toHaveAttribute('data-library-lock-held', 'true');
  await first.locator('#save-name').fill('First tab');
  await second.locator('#save-name').fill('Second tab');
  await Promise.all([
    first.getByRole('button', { name: 'Save map', exact: true }).click(),
    second.getByRole('button', { name: 'Save map', exact: true }).click(),
  ]);
  await expect(first.getByRole('button', { name: 'Save map', exact: true })).toBeDisabled();
  await expect(second.getByRole('button', { name: 'Save map', exact: true })).toBeDisabled();
  await expect
    .poll(() =>
      holder.evaluate(async () => {
        const locks = await navigator.locks.query();
        return locks.pending?.filter((lock) => lock.name === 'encounter-map-forge.saves.write')
          .length;
      }),
    )
    .toBe(2);
  await expect(first.locator('.saved-item')).toHaveCount(0);
  await holder.evaluate(() => document.dispatchEvent(new Event('release-library-lock')));
  for (const page of [first, second]) {
    await expect(item(page, 'First tab')).toBeVisible();
    await expect(item(page, 'Second tab')).toBeVisible();
    await page.reload();
    await expect(page.locator('.saved-item')).toHaveCount(2);
    await expect(item(page, 'First tab')).toBeVisible();
    await expect(item(page, 'Second tab')).toBeVisible();
  }
});

test('tabs synchronize rename, favorite, duplicate, import, and delete without replacing other records', async ({
  page,
  context,
}) => {
  const other = await context.newPage();
  await Promise.all([page.goto('/'), other.goto('/')]);
  await save(page, 'Shared map');
  await expect(item(other, 'Shared map')).toBeVisible();
  await save(other, 'Keep this map');
  await expect(item(page, 'Keep this map')).toBeVisible();
  await item(page, 'Shared map').getByRole('button', { name: 'Rename', exact: true }).click();
  await page.locator('.rename-form input').fill('Renamed across tabs');
  await Promise.all([
    page.locator('.rename-form button[type=submit]').click(),
    item(other, 'Shared map').getByRole('button', { name: 'Mark as favorite' }).click(),
  ]);
  for (const tab of [page, other]) {
    await expect(item(tab, 'Renamed across tabs')).toHaveClass(/favorite/);
    await expect(item(tab, 'Keep this map')).toBeVisible();
  }
  await item(other, 'Renamed across tabs')
    .getByRole('button', { name: 'Duplicate', exact: true })
    .click();
  await expect(item(page, 'Renamed across tabs (copy)')).toBeVisible();
  await item(page, 'Renamed across tabs')
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await expect(item(other, 'Renamed across tabs')).toHaveCount(0);
  await other.setInputFiles('.import-label input', 'src/app/save/fixtures/forest-v3.json');
  await expect(page.locator('.saved-item')).toHaveCount(5);
  await page.reload();
  await expect(page.locator('.saved-item')).toHaveCount(5);
  await expect(item(page, 'Keep this map')).toBeVisible();
  await expect(item(page, 'Renamed across tabs (copy)')).toBeVisible();
  await expect(item(page, 'Renamed across tabs')).toHaveCount(0);
});

for (const operation of ['Rename', 'Duplicate'] as const) {
  test(`a stale ${operation.toLowerCase()} cannot restore a deleted map`, async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await save(page, 'Delete from first tab');
    const stale = await context.newPage();
    await stale.addInitScript(() =>
      window.addEventListener('storage', (event) => event.stopImmediatePropagation()),
    );
    await stale.goto('/');
    await expect(item(stale, 'Delete from first tab')).toBeVisible();
    if (operation === 'Rename') {
      await item(stale, 'Delete from first tab')
        .getByRole('button', { name: 'Rename', exact: true })
        .click();
      await stale.locator('.rename-form input').fill('Stale rename');
    }
    await item(page, 'Delete from first tab')
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await expect(page.locator('.saved-item')).toHaveCount(0);
    if (operation === 'Rename') await stale.locator('.rename-form button[type=submit]').click();
    else
      await item(stale, 'Delete from first tab')
        .getByRole('button', { name: 'Duplicate', exact: true })
        .click();
    await expect(stale.locator('.library-message .error')).toContainText(
      'no longer in the library',
    );
    await expect(stale.locator('.saved-item')).toHaveCount(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)).toBe('[]');
    await page.reload();
    await expect(page.locator('.saved-item')).toHaveCount(0);
  });
}

for (const kind of ['unreadable', 'duplicate', 'malformed'] as const) {
  test(`${kind} local data remains recoverable while writes are paused`, async ({ page }) => {
    const record = fixtureRecord();
    const raw =
      kind === 'malformed'
        ? '{ damaged library'
        : JSON.stringify([
            record,
            kind === 'duplicate'
              ? { ...record, name: 'Repeated ID' }
              : { ...record, id: 'future', saveFormatVersion: '99.0.0' },
          ]);
    await seedStorage(page, raw);
    await page.goto('/');
    await expect(page.locator('.library-recovery')).toContainText('Changes are paused');
    await expect(page.getByRole('button', { name: 'Save map', exact: true })).toBeDisabled();
    await expect(page.locator('.import-label input')).toBeDisabled();
    if (kind !== 'malformed') {
      await expect(page.locator('.saved-item')).toHaveCount(1);
      await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeDisabled();
      await page.getByRole('button', { name: 'Open', exact: true }).click();
      await expect(
        page.getByRole('heading', { name: 'Forest Clearing', exact: true }),
      ).toBeVisible();
      const pendingBackup = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download backup', exact: true }).click();
      const download = await pendingBackup;
      const parsed: unknown = JSON.parse(readFileSync(await download.path(), 'utf8'));
      expect(parsed).toMatchObject({
        saveFormatVersion: '7.0.0',
        maps: [expect.objectContaining({ id: record['id'] })],
      });
    } else {
      await expect(page.locator('.library-empty')).toContainText('No readable saved maps');
    }
    if (kind === 'unreadable') {
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 1100 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
          false,
        );
        await page
          .locator('.library')
          .screenshot({ path: `artifacts/qr01-qr02/recovery-${width}.png` });
      }
    }
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download recovery data', exact: true }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe('encounter-map-forge-recovery.txt');
    expect(readFileSync(await download.path(), 'utf8') === raw).toBe(true);
    expect(
      (await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)) === raw,
    ).toBe(true);
    await page.getByRole('button', { name: 'Retry library', exact: true }).click();
    await expect(page.locator('.library-recovery')).toBeVisible();
    await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
      key: SAVE_STORAGE_KEY,
      raw: JSON.stringify([record]),
    });
    await page.getByRole('button', { name: 'Retry library', exact: true }).click();
    await expect(page.locator('.library-recovery')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save map', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Rename', exact: true }).click();
    await page.locator('.rename-form input').fill('Recovered map');
    await page.locator('.rename-form button[type=submit]').click();
    await expect(item(page, 'Recovered map')).toBeVisible();
    if (kind === 'unreadable')
      await page
        .locator('.library')
        .screenshot({ path: 'artifacts/qr01-qr02/recovered-mobile.png' });
    await page.reload();
    await expect(item(page, 'Recovered map')).toBeVisible();
  });
}

test('a blocked library read can be retried without replacing the stored maps', async ({
  page,
}) => {
  const raw = JSON.stringify([fixtureRecord()]);
  await page.addInitScript(
    ({ key, raw }) => {
      localStorage.setItem(key, raw);
      const original = Storage.prototype.getItem;
      let blocked = true;
      Storage.prototype.getItem = function (name) {
        if (name === key && blocked) throw new DOMException('Read blocked', 'SecurityError');
        return original.call(this, name);
      };
      document.addEventListener('allow-library-read', () => {
        blocked = false;
      });
    },
    { key: SAVE_STORAGE_KEY, raw },
  );
  await page.goto('/');
  await expect(page.locator('.library-recovery')).toContainText('could not read');
  await expect(page.getByRole('button', { name: 'Save map', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Download recovery data' })).toHaveCount(0);
  await page.evaluate(() => document.dispatchEvent(new Event('allow-library-read')));
  expect((await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)) === raw).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Retry library', exact: true }).click();
  await expect(page.locator('.saved-item')).toHaveCount(1);
  await expect(page.locator('.library-recovery')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save map', exact: true })).toBeEnabled();
});

for (const failure of [
  { kind: 'unreadable file', message: 'That backup file could not be read.' },
  { kind: 'malformed JSON', message: 'That backup is not valid JSON.' },
  { kind: 'foreign backup', message: 'That file is not an Encounter Map Forge backup.' },
  {
    kind: 'future format',
    message: 'That backup uses a save format this version of Encounter Map Forge cannot read.',
  },
] as const) {
  test(`import reports ${failure.kind} and recovers without changing existing maps`, async ({
    page,
  }) => {
    await page.goto('/');
    await save(page, 'Keep before import');
    const before = await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY);
    const fixture = readFileSync('src/app/save/fixtures/forest-v3.json');
    let buffer = fixture;
    if (failure.kind === 'unreadable file') {
      await page.evaluate(() => {
        const original = File.prototype.text;
        File.prototype.text = function () {
          File.prototype.text = original;
          return Promise.reject(new DOMException('Read failed', 'NotReadableError'));
        };
      });
    } else if (failure.kind === 'malformed JSON') {
      buffer = Buffer.from('{ damaged backup');
    } else {
      const bundle: Record<string, unknown> = JSON.parse(fixture.toString('utf8'));
      if (failure.kind === 'foreign backup') bundle['format'] = 'other';
      else bundle['saveFormatVersion'] = '99.0.0';
      buffer = Buffer.from(JSON.stringify(bundle));
    }
    const input = page.locator('.import-label input');
    await input.setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer });
    await expect(page.locator('.library-message .error')).toHaveText(failure.message);
    await expect(page.locator('.library-message .notice')).toBeEmpty();
    await expect(page.locator('.saved-item')).toHaveCount(1);
    await expect(item(page, 'Keep before import')).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)).toBe(before);
    await expect(input).toHaveValue('');
    await expect(input).toBeEnabled();
    await input.setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: fixture,
    });
    await expect(page.locator('.library-message .notice')).toHaveText('Imported 3 maps.');
    await expect(page.locator('.library-message .error')).toBeEmpty();
    await expect(page.locator('.saved-item')).toHaveCount(4);
    await page.reload();
    await expect(page.locator('.saved-item')).toHaveCount(4);
    await expect(item(page, 'Keep before import')).toBeVisible();
  });
}

test('unsupported backup headers reject valid records without changing the library', async ({
  page,
}) => {
  await page.goto('/');
  await save(page, 'Keep before version rejection');
  const before = await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY);
  const fixture = readFileSync('src/app/save/fixtures/forest-v3.json', 'utf8');
  const bundle: Record<string, unknown> = JSON.parse(fixture);
  const input = page.locator('.import-label input');
  for (const saveFormatVersion of ['1', '1.0.0.99', '1.9.0', '0.0.0', '2.0.0.0', '01.0.0']) {
    await input.setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ ...bundle, saveFormatVersion })),
    });
    await expect(page.locator('.library-message .error')).toHaveText(
      'That backup uses a save format this version of Encounter Map Forge cannot read.',
    );
    await expect(input).toHaveValue('');
    await expect(input).toBeEnabled();
    await expect(page.locator('.saved-item')).toHaveCount(1);
    await expect(item(page, 'Keep before version rejection')).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)).toBe(before);
  }
  await input.setInputFiles('src/app/save/fixtures/forest-v3.json');
  await expect(page.locator('.library-message .notice')).toHaveText('Imported 3 maps.');
  await expect(page.locator('.library-message .error')).toBeEmpty();
  await page.reload();
  await expect(page.locator('.saved-item')).toHaveCount(4);
  await expect(item(page, 'Keep before version rejection')).toBeVisible();
});

for (const failure of ['QuotaExceededError', 'SecurityError'] as const) {
  test(`an import ${failure} keeps the library intact and permits retrying the same file`, async ({
    page,
  }) => {
    await page.goto('/');
    await save(page, 'Keep before import');
    const before = await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY);
    await page.evaluate(
      ({ key, failure }) => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (name, value) {
          if (name === key) throw new DOMException('Write failed', failure);
          original.call(this, name, value);
        };
        document.addEventListener('allow-library-write', () => {
          Storage.prototype.setItem = original;
        });
      },
      { key: SAVE_STORAGE_KEY, failure },
    );
    await page.setInputFiles('.import-label input', 'src/app/save/fixtures/forest-v3.json');
    await expect(page.locator('.library-message .error')).toHaveText(
      'Your browser could not write to local storage. It may be full or blocked.',
    );
    await expect(page.locator('.library-message .notice')).toBeEmpty();
    await expect(page.locator('.saved-item')).toHaveCount(1);
    await expect(item(page, 'Keep before import')).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)).toBe(before);
    await expect(page.locator('.import-label input')).toHaveValue('');
    await expect(page.locator('.import-label input')).toBeEnabled();
    await page.evaluate(() => document.dispatchEvent(new Event('allow-library-write')));
    await page.setInputFiles('.import-label input', 'src/app/save/fixtures/forest-v3.json');
    await expect(page.locator('.saved-item')).toHaveCount(4);
    await expect(page.locator('.library-message .error')).toBeEmpty();
    await expect(page.locator('.library-message .notice')).toContainText('Imported 3 maps');
    await page.reload();
    await expect(page.locator('.saved-item')).toHaveCount(4);
    await expect(item(page, 'Keep before import')).toBeVisible();
  });
}

test('a blank rename in a stale tab keeps the latest saved name', async ({ page, context }) => {
  await page.goto('/');
  await save(page, 'Original name');
  const stale = await context.newPage();
  await stale.addInitScript(() =>
    window.addEventListener('storage', (event) => event.stopImmediatePropagation()),
  );
  await stale.goto('/');
  await item(stale, 'Original name').getByRole('button', { name: 'Rename', exact: true }).click();
  await stale.locator('.rename-form input').fill('   ');
  await item(page, 'Original name').getByRole('button', { name: 'Rename', exact: true }).click();
  await page.locator('.rename-form input').fill('Updated in first tab');
  await page.locator('.rename-form button[type=submit]').click();
  await expect(item(page, 'Updated in first tab')).toBeVisible();
  await stale.locator('.rename-form button[type=submit]').click();
  await expect(item(stale, 'Updated in first tab')).toBeVisible();
  await expect(stale.locator('.library-message .notice')).toHaveText(
    'Renamed to “Updated in first tab”.',
  );
  await page.reload();
  await expect(item(page, 'Updated in first tab')).toBeVisible();
});
