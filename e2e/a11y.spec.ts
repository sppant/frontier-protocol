import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { startMatch } from './helpers';

/** Fail on serious/critical WCAG A/AA issues; print them readably. */
async function audit(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const summary = bad.map(
    (v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
  );
  expect(summary, `${label} accessibility violations`).toEqual([]);
}

test('menu and setup screens', async ({ page }) => {
  await page.goto('/');
  await audit(page, 'menu');
  await page.getByRole('button', { name: 'New game' }).click();
  await audit(page, 'setup');
});

test('game screen: panels, dialogs, simple and 3D map', async ({ page }) => {
  await startMatch(page, { tutorial: true });
  await audit(page, 'game + tutorial');
  await page
    .getByRole('region', { name: 'Tutorial' })
    .getByRole('button', { name: 'Skip' })
    .click();

  for (const tab of ['Research', 'Objectives', 'Inspector']) {
    await page.getByRole('tab', { name: tab }).click();
    await audit(page, `tab ${tab}`);
  }
  await page.getByRole('tab', { name: 'Rival activity' }).click();
  await audit(page, 'rival activity');

  await page.getByRole('button', { name: 'Simple map' }).click();
  await page
    .getByRole('button', { name: 'Elia' })
    .first()
    .click({ trial: true })
    .catch(() => undefined);
  await audit(page, 'simple map');

  await page.getByRole('button', { name: 'Settings' }).click();
  await audit(page, 'settings dialog');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByRole('dialog', { name: 'First Contact' })).toBeVisible();
  await audit(page, 'event dialog');
});
