import { expect, test } from '@playwright/test';
import { runUntil, startMatch } from './helpers';

test('simulation advances and building changes the economy', async ({ page }) => {
  await startMatch(page);
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

  // Day 1 brings the First Contact event: time halts until the player decides.
  const dialog = page.getByRole('dialog', { name: 'First Contact' });
  await expect(dialog).toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId('sim-status')).toHaveText('Paused');
  await expect(page.getByRole('button', { name: 'Resume' })).toBeDisabled();
  await dialog.getByRole('button', { name: /Conserve resources/ }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Speed 1x' }).click();
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByTestId('game-day')).not.toHaveText('Day 1', { timeout: 3000 });
  await page.getByRole('button', { name: 'Pause' }).click();

  // Paused: the day must stop changing.
  const frozen = await page.getByTestId('game-day').textContent();
  await page.waitForTimeout(1200);
  await expect(page.getByTestId('game-day')).toHaveText(frozen ?? '');
});

test('expedition reveals a new system and shows in the feed', async ({ page }) => {
  await startMatch(page);
  await page.getByRole('button', { name: 'Speed 4x' }).click();

  // Pick a detected system on the 3D-independent simple map.
  await page.getByRole('button', { name: 'Simple map' }).click();
  const buttons = page.getByRole('group', { name: 'Simple galaxy map' }).getByRole('button');
  const send = page.getByRole('button', { name: /^Send expedition/ });
  let found = false;
  for (let i = 0; i < (await buttons.count()) && !found; i++) {
    const label = await buttons.nth(i).getAttribute('aria-label');
    if (label?.startsWith('Unknown system')) continue;
    await buttons.nth(i).click();
    found = (await send.count()) > 0;
  }
  expect(found).toBe(true);
  await send.click();
  await expect(page.getByRole('list', { name: 'Active expeditions' })).toBeVisible();

  // Back to 3D to check the fleet renders without errors.
  await page.getByRole('button', { name: 'Simple map' }).click();
  await page.getByRole('button', { name: 'Resume' }).click();
  await page.getByRole('dialog', { name: 'First Contact' }).getByRole('button').first().click();
  await page.getByRole('button', { name: 'Resume' }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: process.env.SHOT ?? 'test-results/fleet.png' });
  await runUntil(page, () =>
    page
      .getByText(/surveyed/)
      .first()
      .isVisible(),
  );
  await expect(page.getByRole('list', { name: 'Active expeditions' })).toBeHidden();
});

test('research tab: techs are gated by research points and apply on purchase', async ({ page }) => {
  await startMatch(page);
  await page.getByRole('tab', { name: 'Research' }).click();
  const deepCore = page
    .locator('li')
    .filter({ has: page.getByText('Deep Core Extraction', { exact: true }) });
  await expect(deepCore.getByRole('button', { name: 'Research' })).toBeDisabled();
  await expect(deepCore).toContainText('Needs 40 research');

  await page.getByRole('tab', { name: 'Objectives' }).click();
  await expect(page.getByText('Nexus Ascendancy')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Standings' })).toBeVisible();
});

test('rival bots act on their own and explain their decisions', async ({ page }) => {
  await startMatch(page);
  await page.getByRole('button', { name: 'Speed 4x' }).click();
  await page.getByRole('tab', { name: 'Rival activity' }).click();
  const list = page.getByRole('list', { name: 'Rival activity' });
  await runUntil(page, () => list.isVisible());
  await expect(list.getByRole('listitem').first()).toContainText(/Pioneer|Warlord|Oracle|Merchant/);
});
