import { expect, test } from '@playwright/test';
import { startMatch } from './helpers';

const SIZES = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'small laptop', width: 1024, height: 640 },
  { name: 'desktop', width: 1440, height: 900 },
];

for (const { name, width, height } of SIZES) {
  test(`no horizontal overflow and core controls reachable on ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.getByRole('button', { name: 'New game' }).click();
    await expect(page.getByRole('button', { name: /^Begin as/ })).toBeVisible();
    await startMatch(page);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    for (const control of [
      page.getByRole('button', { name: 'Resume' }),
      page.getByRole('button', { name: '4× speed' }),
      page.getByRole('button', { name: 'Settings' }),
      page.getByRole('tab', { name: 'Research' }),
    ]) {
      await control.scrollIntoViewIfNeeded();
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= width).toBe(true);
    }
  });
}
