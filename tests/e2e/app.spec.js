import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('[data-view="dashboard"]')).toBeVisible();
});

const goto = (page, view) => page.locator(`.bottom-nav__item[data-nav-target="${view}"]`).click();

test('اللوحة الرئيسية تُحمَّل وشاشة البداية تختفي', async ({ page }) => {
  await expect(page).toHaveTitle(/دليل الاستيوارد/);
  await expect(page.locator('#splashScreen')).toHaveCount(0, { timeout: 5000 });
});

test('البحث عن «انفورس» يجد ENFORCE (تطبيع عربي)', async ({ page }) => {
  await goto(page, 'chemicals');
  await page.locator('#chemSearchInput').fill('انفورس');
  await expect(page.locator('#chemCardsList .card')).toHaveCount(1);
  await expect(page.locator('#chemCardsList .card')).toContainText('ENFORCE');
});

test('المفضلة تبقى بعد إعادة التحميل', async ({ page }) => {
  await goto(page, 'chemicals');
  await page.locator('[data-action="favorite"]').first().click();
  await page.reload();
  await goto(page, 'chemicals');
  await expect(page.locator('[data-action="favorite"][aria-pressed="true"]')).toHaveCount(1);
});

test('المساعد يجيب عن بقع المياه ويذكر SOLID BRILLIANCE', async ({ page }) => {
  await goto(page, 'ai');
  await page.locator('#aiInput').fill('بقع مياه على الأطباق');
  await page.locator('#aiSendBtn').click();
  await expect(page.locator('.ai-message--assistant .ai-message__bubble').last()).toContainText('SOLID BRILLIANCE');
});

test('المساعد يعرض زر فتح بطاقة عند ذكر مادة', async ({ page }) => {
  await goto(page, 'ai');
  await page.locator('#aiInput').fill('تخفيف ENFORCE');
  await page.locator('#aiSendBtn').click();
  await page.locator('[data-action="open-chemical"]').click();
  await expect(page.locator('[data-view="chemicals"]')).toBeVisible();
});

test('اجتياز اختبار وحدة يُعلّمها مكتملة', async ({ page }) => {
  await goto(page, 'education');
  const item = page.locator('.accordion__item[data-module-id="haccp"]');
  await item.locator('.accordion__header').click();
  const quiz = item.locator('.quiz');
  await expect(quiz).toBeVisible();
  for (const q of await quiz.locator('.quiz__question').all()) {
    await q.locator('[data-correct="true"]').click();
  }
  await expect(quiz.locator('.quiz__result')).toContainText('النتيجة: 3/3');
  await expect(item.locator('[data-completed-badge]')).toBeVisible();
});

test('الإجابات الخاطئة لا تُكمل الوحدة', async ({ page }) => {
  await goto(page, 'education');
  const item = page.locator('.accordion__item[data-module-id="haccp"]');
  await item.locator('.accordion__header').click();
  for (const q of await item.locator('.quiz__question').all()) {
    await q.locator('[data-correct="false"]').first().click();
  }
  await expect(item.locator('.quiz__result')).toContainText('النتيجة: 0/3');
  await expect(item.locator('[data-completed-badge]')).toHaveCount(0);
});

test('تبديل المظهر للفاتح', async ({ page }) => {
  await goto(page, 'settings');
  await page.locator('[data-theme-option="light"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('التطبيق يعمل بدون اتصال بعد تفعيل عامل الخدمة', async ({ page, context }) => {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // ضمان أن الصفحة تحت سيطرة عامل الخدمة
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('[data-view="dashboard"]')).toBeVisible();
  await goto(page, 'chemicals');
  await expect(page.locator('#chemCardsList .card').first()).toBeVisible();
});
