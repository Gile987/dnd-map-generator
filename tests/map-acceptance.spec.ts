import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { generateDungeon } from '../src/app/engine/generate';
import { generateForestClearing } from '../src/app/engine/forest-generate';
import {
  BACKUP_FORMAT,
  SAVE_FORMAT_VERSION,
  SAVE_STORAGE_KEY,
  makeSavedMap,
  serializeBundle,
} from '../src/app/save/save-format';
import type { MapType } from '../src/app/engine/model';

function savedMap(type: MapType, revision = 0) {
  const result =
    type === 'dungeon'
      ? generateDungeon({
          seed: 'acceptance-browser',
          roomCount: 6,
          density: 'Balanced',
          preset: 'Mosslit',
        })
      : generateForestClearing({
          seed: 'acceptance-browser',
          density: 'Balanced',
          character: 'Verdant',
        });
  if (!result.ok) throw new Error(result.error);
  const original = result.map;
  const map =
    original.type === 'dungeon'
      ? { ...original, decoration: { ...original.decoration, revision } }
      : { ...original, decoration: { ...original.decoration, revision } };
  return makeSavedMap(
    map,
    `Accepted ${type}`,
    'data:image/png;base64,AAAA',
    `accepted-${type}`,
    '2026-10-22T12:00:00.000Z',
  );
}

function invalidForestRecord() {
  const saved = savedMap('forest');
  const blocker = saved.map.decoration.props.find((prop) => prop.blocking);
  if (!blocker) throw new Error('Expected a forest blocker');
  return {
    ...saved,
    id: 'invalid-forest',
    name: 'Invisible crate forest',
    map: {
      ...saved.map,
      decoration: { ...saved.map.decoration, props: [{ ...blocker, kind: 'crate' }] },
    },
  };
}

test('a mixed backup skips invalid bodies, keeps valid maps and leaves the displayed map intact', async ({
  page,
}) => {
  const valid = savedMap('forest');
  const invalid = invalidForestRecord();
  const raw = JSON.stringify({
    format: BACKUP_FORMAT,
    saveFormatVersion: SAVE_FORMAT_VERSION,
    maps: [invalid, valid],
  });
  await page.goto('/');
  const originalSummary = await page.locator('#map-summary').textContent();
  await page.setInputFiles('.import-label input', {
    name: 'mixed.json',
    mimeType: 'application/json',
    buffer: Buffer.from(raw),
  });
  await expect(page.locator('.library-message .notice')).toContainText(
    'Imported 1 map; 1 entry skipped',
  );
  await expect(page.locator('.saved-item')).toHaveCount(1);
  await expect(page.locator('.saved-item')).toContainText(valid.name);
  expect(await page.locator('#map-summary').textContent()).toBe(originalSummary);
  await page.reload();
  await expect(page.locator('.saved-item')).toHaveCount(1);
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('acceptance-browser');
  await expect(page.getByRole('radio', { name: 'Forest', exact: true })).toBeChecked();
});

test('newly rejected local map bodies remain available as exact recovery data', async ({
  page,
}) => {
  const raw = JSON.stringify([invalidForestRecord(), savedMap('dungeon')]);
  await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), {
    key: SAVE_STORAGE_KEY,
    raw,
  });
  await page.goto('/');
  await expect(page.locator('.library-recovery')).toBeVisible();
  await expect(page.locator('.saved-item')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Save map', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.locator('#map-summary')).toContainText('acceptance-browser');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download recovery data', exact: true }).click();
  const download = await pending;
  expect(readFileSync(await download.path(), 'utf8') === raw).toBe(true);
  expect((await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY)) === raw).toBe(
    true,
  );
});

for (const type of ['dungeon', 'forest'] as const) {
  test(`a ${type} at the revision limit remains exportable and recovers through Generate`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const saved = savedMap(type, Number.MAX_SAFE_INTEGER);
    await page.goto('/');
    await page.setInputFiles('.import-label input', {
      name: 'limit.json',
      mimeType: 'application/json',
      buffer: Buffer.from(serializeBundle([saved])),
    });
    await expect(page.locator('.saved-item')).toHaveCount(1);
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await expect(page.locator('#map-summary')).toContainText('r9007199254740991');
    const summary = await page.locator('#map-summary').textContent();
    await page.getByLabel('World seed').fill('revision-recovered');
    await page.getByRole('button', { name: 'Shuffle details' }).click();
    await expect(page.locator('#settings-error')).toContainText('detail revision limit');
    await expect(page.getByRole('button', { name: 'Shuffle details' })).toBeEnabled();
    expect(await page.locator('#map-summary').textContent()).toBe(summary);
    await expect(page.getByLabel('World seed')).toHaveValue('revision-recovered');
    await expect(page.getByText('Settings changed. Generate to apply.')).toBeVisible();
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Quick export PNG', exact: true }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toContain('-r9007199254740991-');
    expect(await page.locator('#map-summary').textContent()).toBe(summary);
    await page.getByRole('button', { name: `Generate ${type}`, exact: true }).click();
    await expect(page.locator('#map-summary')).toContainText('revision-recovered');
    await expect(page.locator('#map-summary')).toContainText('r0');
    await page.getByRole('button', { name: 'Shuffle details' }).click();
    await expect(page.locator('#map-summary')).toContainText('r1');
    await expect(page.locator('#settings-error')).toBeEmpty();
    expect(errors).toEqual([]);
  });
}
