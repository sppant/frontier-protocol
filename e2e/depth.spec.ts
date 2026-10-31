import { expect, test } from '@playwright/test';
import type { GameState } from '../src/domain/game';
import { newGame } from '../src/engine/step';
import { encodeSave } from '../src/persistence/save';
import { installSave } from './helpers';

/** A built-out capital with the upgrade/terraform techs and plenty of resources. */
function lateGame(): GameState {
  const g = newGame(2479, 'terran', 'normal');
  const capital = Object.values(g.colonies).find((c) => c.ownerId === 'terran')!;
  return {
    ...g,
    tick: 200,
    storyStage: 6,
    colonies: {
      ...g.colonies,
      [capital.id]: { ...capital, buildings: ['mine', 'lab', 'tradeHub'], population: 10 },
    },
    factions: {
      ...g.factions,
      terran: {
        ...g.factions.terran,
        techs: ['bioHabitats', 'hostileHabitats', 'deepCore', 'fusionGrid', 'terraforming'],
        resources: { credits: 3000, minerals: 3000, research: 50 },
      },
    },
  };
}

test('a built-out colony still has things to do: upgrade, terraform, and guidance', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('fp.tutorialSeen', '1'));
  await installSave(page, JSON.parse(JSON.stringify(encodeSave(lateGame()))));
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Simple map' }).click();

  // Next-steps advisor speaks plainly.
  await page.getByRole('tab', { name: 'Objectives' }).click();
  const steps = page.getByRole('list', { name: 'Suggested next steps' });
  await expect(steps).toContainText(/Upgrade the .* for \+50% output|Terraform/);

  // Find the capital through the map.
  const upgrade = page.getByRole('button', { name: /^Upgrade Mining Complex → Lv2/ });
  const systems = page.getByRole('group', { name: 'Simple galaxy map' }).getByRole('button');
  for (let i = 0; i < (await systems.count()); i++) {
    const label = await systems.nth(i).getAttribute('aria-label');
    if (label?.startsWith('Unknown system')) continue;
    await systems.nth(i).click();
    if ((await upgrade.count()) > 0) break;
  }
  await expect(page.getByText(/Mining Complex Lv1, Research Lab Lv1, Trade Hub Lv1/)).toBeVisible();

  const minerals = page.getByTestId('res-minerals');
  const before = Number(await minerals.textContent());
  await upgrade.click();
  await expect(page.getByText(/Upgrading Mining Complex/)).toBeVisible();
  expect(Number(await minerals.textContent())).toBeLessThan(before);
  await expect(page.getByRole('button', { name: /^Upgrade Mining Complex/ })).toBeDisabled();

  await page.getByRole('button', { name: /^Terraform \+10/ }).click();
  await expect(page.getByText(/Terraforming — \d+d left/)).toBeVisible();
});

test('researching the new techs is possible and explains prerequisites', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fp.tutorialSeen', '1'));
  const g = lateGame();
  const early = {
    ...g,
    factions: { ...g.factions, terran: { ...g.factions.terran, techs: [] } },
  };
  await installSave(page, JSON.parse(JSON.stringify(encodeSave(early))));
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('tab', { name: 'Research' }).click();
  const habitats = page
    .locator('li')
    .filter({ has: page.getByText('Hostile-Environment Habitats', { exact: true }) });
  await expect(habitats).toContainText(/Requires/);
  await expect(habitats.getByRole('button', { name: 'Research' })).toBeDisabled();
});
