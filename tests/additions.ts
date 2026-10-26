import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export async function openAdditions(page: Page) {
  await page.getByRole('button', { name: 'Choose additions', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Choose additions', exact: true });
  await expect(picker).toBeVisible();
  return picker;
}

export async function setAddition(page: Page, name: string, checked = true): Promise<void> {
  const picker = await openAdditions(page);
  await picker.getByRole('checkbox', { name, exact: true }).setChecked(checked);
  await picker.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(picker).not.toBeVisible();
}

export function selectedAddition(page: Page, name: string) {
  return page.getByRole('button', { name: `Remove ${name}`, exact: true });
}
