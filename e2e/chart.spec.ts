import { expect, test } from '@playwright/test';
import { runUntil, startMatch } from './helpers';

test('objectives tab charts standings over time', async ({ page }) => {
  await startMatch(page);
  await page.getByRole('button', { name: '4× speed' }).click();
  await runUntil(page, async () => {
    const day = Number(
      ((await page.getByTestId('game-day').textContent()) ?? '').replace(/\D/g, ''),
    );
    return day >= 35;
  });
  await page
    .getByRole('button', { name: 'Pause' })
    .click()
    .catch(() => undefined);
  await page.getByRole('tab', { name: 'Objectives' }).click();
  const chart = page.getByRole('img', { name: /Score over time/ });
  await expect(chart).toBeVisible();
  await expect(chart.locator('canvas')).toBeVisible(); // ECharts rendered
  await page.screenshot({
    path: '/private/tmp/claude-501/-Users-spyrospantopoulos-Desktop-frontier-protocol/249f639b-b318-4081-9070-3d235a341599/scratchpad/objectives2.png',
  });
});
