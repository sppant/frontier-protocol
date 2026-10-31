import type { Page } from '@playwright/test';

/** If a decision dialog is open, pick its first enabled choice. Returns true if one was resolved. */
export async function resolveDialog(page: Page): Promise<boolean> {
  const dialog = page.getByRole('dialog');
  if (!(await dialog.isVisible())) return false;
  const choices = dialog.getByRole('button');
  for (let i = 0; i < (await choices.count()); i++) {
    if (await choices.nth(i).isEnabled()) {
      await choices.nth(i).click();
      return true;
    }
  }
  return false;
}

/** Keep the game running until `done` is true, resolving events and resuming as needed. */
export async function runUntil(
  page: Page,
  done: () => Promise<boolean>,
  timeoutMs = 30_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await done()) return;
    await resolveDialog(page);
    const resume = page.getByRole('button', { name: 'Resume' });
    if ((await resume.isVisible()) && (await resume.isEnabled())) await resume.click();
    await page.waitForTimeout(150);
  }
  throw new Error('runUntil: condition not met before timeout');
}

export interface MatchOptions {
  faction?: RegExp;
  seed?: string;
  /** Leave the first-run tutorial enabled (default: pre-dismissed). */
  tutorial?: boolean;
}

/** Launch the app and start a new match through the real menu. */
export async function startMatch(page: Page, opts: MatchOptions = {}): Promise<void> {
  if (!opts.tutorial) {
    await page.addInitScript(() => localStorage.setItem('fp.tutorialSeen', '1'));
  }
  await page.goto('/');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('radio', { name: opts.faction ?? /Terran/ }).click();
  await page.getByLabel('Galaxy seed').fill(opts.seed ?? '2479');
  await page.getByRole('button', { name: /^Begin as/ }).click();
  await page.getByRole('region', { name: 'Galaxy map' }).waitFor();
}
