import { expect, test } from '@playwright/test';
import { resolveDialog, startMatch } from './helpers';

test('essential journey: new match → inspect → act → advance → save → reload → continue', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // 1–4. Launch, start a new match, pick a faction, enter the galaxy (tutorial left on).
  await startMatch(page, { faction: /Helion/, tutorial: true });
  await expect(page.getByTestId('save-status')).toHaveText('✓ Saved'); // new matches save at once
  const tutorial = page.getByRole('region', { name: 'Tutorial' });
  await expect(tutorial).toContainText('Welcome, Commander');
  await tutorial.getByRole('button', { name: 'Skip' }).click();
  await expect(tutorial).toBeHidden();

  // 5. Inspect a system (simple map = real DOM targets).
  await page.getByRole('button', { name: 'Simple map' }).click();
  const systems = page.getByRole('group', { name: 'Simple galaxy map' }).getByRole('button');
  const build = page.getByRole('button', { name: /^Mining Complex/ });
  let found = false;
  for (let i = 0; i < (await systems.count()) && !found; i++) {
    const label = await systems.nth(i).getAttribute('aria-label');
    if (label?.startsWith('Unknown system')) continue;
    await systems.nth(i).click();
    found = (await build.count()) > 0;
  }
  expect(found).toBe(true);
  await expect(page.getByRole('heading', { level: 3 })).toBeVisible();

  // 6. Perform an action: queue a Mining Complex (spends minerals).
  const minerals = page.getByTestId('res-minerals');
  const before = Number(await minerals.textContent());
  await build.click();
  await expect(minerals).toHaveText(String(before - 30));
  await expect(page.getByText(/Building Mining Complex/)).toBeVisible();

  // 7–8. Advance time and verify the game state changes.
  await page.getByRole('button', { name: '4× speed' }).click();
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByTestId('game-day')).toHaveText(/Day [1-9]/, { timeout: 5000 });
  while (await resolveDialog(page)) await page.waitForTimeout(100);
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByTestId('game-day')).toHaveText(/Day (?!0$|1$)\d+/, { timeout: 8000 });
  await page.getByRole('button', { name: 'Pause' }).click(); // pausing is a save checkpoint
  await expect(page.getByTestId('save-status')).toHaveText('✓ Saved');
  const day = (await page.getByTestId('game-day').textContent()) ?? '';
  const mineralsAtSave = await minerals.textContent();
  expect(day).not.toBe('Day 0');

  // 9. Reload: the match is restored from IndexedDB.
  await page.reload();
  const cont = page.getByRole('button', { name: 'Continue' });
  await expect(cont).toContainText('Helion Collective');
  await cont.click();
  await page.getByRole('region', { name: 'Galaxy map' }).waitFor();
  await expect(page.getByTestId('game-day')).toHaveText(day);
  await expect(minerals).toHaveText(mineralsAtSave ?? '');
  await expect(page.getByTestId('sim-status')).toHaveText('Paused');
  expect(errors).toEqual([]);
});

test('a corrupted save is reported and does not block a new game', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('frontier-protocol', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('saves');
        open.onsuccess = () => {
          const tx = open.result.transaction('saves', 'readwrite');
          tx.objectStore('saves').put(
            {
              format: 'frontier-protocol-save',
              version: 1,
              savedAt: new Date().toISOString(),
              game: { oops: 1 },
            },
            'autosave',
          );
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('could not be loaded');
  await expect(page.getByRole('button', { name: 'Continue' })).toBeHidden();
  await startMatch(page);
  await expect(page.getByTestId('game-day')).toHaveText('Day 0');
});
