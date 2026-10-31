import { expect, test } from '@playwright/test';
import { newGame } from '../src/engine/step';
import { encodeSave } from '../src/persistence/save';
import { TIME_LIMIT } from '../src/sim/victory';
import { runUntil } from './helpers';

/** Seed IndexedDB with a prepared save, bypassing the menu. */
async function installSave(page: import('@playwright/test').Page, envelope: unknown) {
  await page.goto('/');
  await page.evaluate(
    (env) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('frontier-protocol', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('saves');
        open.onsuccess = () => {
          const tx = open.result.transaction('saves', 'readwrite');
          tx.objectStore('saves').put(env, 'autosave');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    envelope,
  );
  await page.reload();
}

test('the match ends at the time limit and offers a rematch or the menu', async ({ page }) => {
  // One day before Hegemony is decided; story finished so no events interrupt.
  const game = { ...newGame(2479, 'terran', 'normal'), tick: TIME_LIMIT - 1, storyStage: 6 };
  await installSave(page, JSON.parse(JSON.stringify(encodeSave(game))));

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByTestId('game-day')).toHaveText(`Day ${TIME_LIMIT - 1}`);
  await page.getByRole('button', { name: '4× speed' }).click();
  await page.getByRole('button', { name: 'Resume' }).click();

  const dialog = page.getByRole('dialog', { name: /Victory|Defeat/ });
  await expect(dialog).toBeVisible({ timeout: 5000 });
  await expect(dialog).toContainText(/Convergence deadline|reached its goal first|prevailed/);
  await expect(page.getByTestId('sim-status')).toHaveText('Paused');
  await expect(page.getByRole('button', { name: 'Resume' })).toBeDisabled();

  // Rematch starts a fresh galaxy at day 0.
  await dialog.getByRole('button', { name: /Play again/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('game-day')).toHaveText('Day 0');
  await runUntil(page, async () => (await page.getByTestId('game-day').textContent()) !== 'Day 0');
});

test('finishing a match then returning to the menu keeps Continue pointing at the result', async ({
  page,
}) => {
  const game = { ...newGame(2479, 'terran', 'normal'), tick: TIME_LIMIT - 1, storyStage: 6 };
  await installSave(page, JSON.parse(JSON.stringify(encodeSave(game))));
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: '4× speed' }).click();
  await page.getByRole('button', { name: 'Resume' }).click();
  const dialog = page.getByRole('dialog', { name: /Victory|Defeat/ });
  await expect(dialog).toBeVisible({ timeout: 5000 });
  await dialog.getByRole('button', { name: 'Main menu' }).click();
  await expect(page.getByRole('button', { name: 'Continue' })).toContainText(`Day ${TIME_LIMIT}`);
});
