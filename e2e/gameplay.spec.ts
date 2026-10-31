import { expect, test } from '@playwright/test';

test('simulation advances and building changes the economy', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Simple map' }).click();

  // Find the player's capital: the known system that offers construction.
  const known = page.getByRole('group', { name: 'Simple galaxy map' }).getByRole('button');
  const total = await known.count();
  const mine = page.getByRole('button', { name: /^Mining Complex/ });
  let found = false;
  for (let i = 0; i < total && !found; i++) {
    const label = await known.nth(i).getAttribute('aria-label');
    if (label?.startsWith('Unknown system')) continue;
    await known.nth(i).click();
    found = (await mine.count()) > 0;
  }
  expect(found).toBe(true);

  const minerals = page.getByTestId('res-minerals');
  const before = Number(await minerals.textContent());
  await mine.click();
  await expect(minerals).toHaveText(String(before - 30));

  await expect(page.getByTestId('game-day')).toHaveText('Day 0');
  await page.getByRole('button', { name: 'Speed 4x' }).click();
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByTestId('game-day')).not.toHaveText('Day 0', { timeout: 3000 });
  await page.getByRole('button', { name: 'Pause' }).click();

  // Paused: the day must stop changing.
  const frozen = await page.getByTestId('game-day').textContent();
  await page.waitForTimeout(1200);
  await expect(page.getByTestId('game-day')).toHaveText(frozen ?? '');
});
