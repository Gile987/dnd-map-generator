import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { PRESET_LABELS } from '../src/app/workbench/presentation';

export function characterLabel(name: string): string {
  return Object.hasOwn(PRESET_LABELS, name)
    ? PRESET_LABELS[name as keyof typeof PRESET_LABELS]
    : name;
}

export async function openCharacters(page: Page) {
  await page.getByRole('button', { name: 'Choose character', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Choose character', exact: true });
  await expect(picker).toBeVisible();
  return picker;
}

export async function selectCharacter(page: Page, name: string) {
  const picker = await openCharacters(page);
  await picker.getByRole('radio', { name: characterLabel(name), exact: true }).check();
  await picker.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(picker).not.toBeVisible();
}
