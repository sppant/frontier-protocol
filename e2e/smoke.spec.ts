import { expect, test } from '@playwright/test';
import { startMatch } from './helpers';

test('menu shows, a match starts, and simulation controls work', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'FRONTIER PROTOCOL' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeHidden();

  await startMatch(page);
  await expect(page.getByTestId('sim-status')).toHaveText('Paused');
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByTestId('sim-status')).toHaveText('Running');
});
