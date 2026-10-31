import { expect, test } from '@playwright/test';

test('app shell loads and simulation controls work', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('FRONTIER PROTOCOL')).toBeVisible();
  await expect(page.getByTestId('sim-status')).toHaveText('Paused');
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByTestId('sim-status')).toHaveText('Running');
});
