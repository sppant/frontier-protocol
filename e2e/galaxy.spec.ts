import { expect, test } from '@playwright/test';
import { startMatch } from './helpers';

test('3D galaxy renders without errors and systems can be inspected via simple map', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await startMatch(page);
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: process.env.SHOT ?? 'test-results/galaxy.png' });
  expect(errors).toEqual([]);

  // Switch to the accessible 2D map and inspect a system.
  await page.getByRole('button', { name: 'Simple map' }).click();
  await expect(page.getByRole('group', { name: 'Simple galaxy map' })).toBeVisible();
  await expect(page.getByText(/select a star system/i)).toBeVisible();
  await page.getByRole('button', { name: 'Unknown system' }).first().click();
  await expect(page.getByText(/beyond sensor range/)).toBeVisible();
});
