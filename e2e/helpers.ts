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
