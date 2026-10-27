import { test, expect } from '@playwright/test';

/**
 * لقطات بصرية (داكن/فاتح × كل الشاشات). تُنشأ المرجعيات مرة واحدة:
 *   npm run test:visual:update   (أو workflow «Visual snapshots» في GitHub)
 * ثم يقارن npm run test:visual أي تغيير بصري غير مقصود. الخطوط مستضافة ذاتياً
 * فالنتائج ثابتة بين الأجهزة، لكن يُفضَّل توليد المرجعيات في CI (Linux) لا محلياً.
 */
const VIEWS = ['dashboard', 'chemicals', 'education', 'safety', 'logs', 'print', 'ai', 'settings'];
const STATE_KEY = 'stewardApp:v2:state';

for (const theme of ['dark', 'light']) {
  for (const view of VIEWS) {
    test(`${view} — ${theme}`, async ({ page }) => {
      await page.addInitScript(([key, t]) => localStorage.setItem(key, JSON.stringify({ theme: t, reducedMotion: true })), [STATE_KEY, theme]);
      await page.goto(`/index.html#${view}`);
      await expect(page.locator(`[data-view="${view}"]`)).toBeVisible();
      await expect(page.locator('#splashScreen')).toHaveCount(0, { timeout: 5000 });
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`${view}-${theme}.png`, {
        animations: 'disabled',
        maxDiffPixelRatio: 0.02,
        mask: [page.locator('.logs-hint'), page.locator('.print-sheet--certificate')]
      });
    });
  }
}
