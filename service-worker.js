/**
 * ============================================================================
 * service-worker.js — عامل الخدمة (الدعم الكامل لوضع عدم الاتصال)
 * ============================================================================
 * الاستراتيجية: "الكاش أولاً" (Cache First) لكل ملفات التطبيق الثابتة —
 * مناسبة تماماً هنا لأن التطبيق بالكامل ثابت (static)، لا توجد بيانات حية
 * من خادم يجب أن تكون دائماً "الأحدث". كل تحديث فعلي للتطبيق يأتي فقط عند
 * نشر نسخة جديدة على GitHub Pages، وعندها نرفع رقم إصدار الكاش (CACHE_VERSION)
 * أدناه يدوياً، مما يجبر كل الأجهزة على تنزيل النسخة الجديدة بالكامل.
 *
 * ملاحظة توافق: عمال الخدمة (Service Workers) لا يعملون على الإطلاق عند
 * فتح الملف مباشرة عبر file:// (قيد أمني من تصميم كل المتصفحات، وليس خللاً
 * في هذا الكود) — لذا app.js يتحقق من ذلك قبل محاولة التسجيل، ويعمل
 * التطبيق بشكل طبيعي بدونه في ذلك السياق، فقط بدون تخزين مؤقت للعمل بدون
 * إنترنت. على GitHub Pages (https://) يعمل هذا الملف بكامل طاقته.
 * ============================================================================
 */

/**
 * رقم إصدار الكاش — ارفع هذا الرقم يدوياً مع كل نشر جديد للتطبيق على
 * GitHub Pages حتى يُجبر المتصفح على استبدال كل الملفات المخزَّنة مؤقتاً
 * بدلاً من الاستمرار في تقديم نسخة قديمة من الكاش للأبد.
 * @type {string}
 */
const CACHE_VERSION = 'steward-guide-v1';

/** أسماء الكاش المشتقة من رقم الإصدار — كاش واحد لكل شيء لتبسيط الإدارة. */
const CACHE_NAME = `${CACHE_VERSION}-shell`;

/**
 * قائمة كل الملفات التي يجب تخزينها مؤقتاً فور تثبيت عامل الخدمة (Precache).
 * هذه القائمة تشمل الصدفة (index.html) وكل ملفات CSS/JS — أي ملف مفقود من
 * هذه القائمة سيُطلب عبر الشبكة أول مرة ثم يُخزَّن تلقائياً (انظر fetch أدناه).
 * @type {string[]}
 */
const APP_SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/tokens.css',
  './assets/css/base.css',
  './assets/css/components.css',
  './assets/css/views.css',
  './assets/js/app.js',
  './assets/js/router.js',
  './assets/js/state.js',
  './assets/js/utils.js',
  './assets/js/data.js',
  './assets/js/dashboard.js',
  './assets/js/chemicals.js',
  './assets/js/education.js',
  './assets/js/safety.js',
  './assets/js/ai.js',
  './assets/js/settings.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

/**
 * عند التثبيت: تخزين كل ملفات الصدفة مؤقتاً فوراً، ثم تخطي مرحلة الانتظار
 * (skipWaiting) حتى يُصبح عامل الخدمة الجديد نشطاً بأسرع وقت ممكن بدل
 * انتظار إغلاق كل تبويبات التطبيق المفتوحة.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

/**
 * عند التفعيل: حذف أي كاش قديم من إصدارات سابقة للتطبيق (أي كاش لا يطابق
 * CACHE_NAME الحالي)، ثم الاستيلاء الفوري على كل التبويبات المفتوحة
 * (clients.claim) حتى يبدأ عامل الخدمة الجديد بخدمة الطلبات فوراً.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name.startsWith('steward-guide-') && name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

/**
 * عند كل طلب شبكة: استراتيجية "الكاش أولاً مع تحديث في الخلفية" —
 * 1) إن وُجد الملف في الكاش، أعده فوراً (سرعة قصوى + يعمل بدون إنترنت).
 * 2) في الخلفية (بدون انتظار)، حاول جلب نسخة أحدث من الشبكة وحدّث الكاش
 *    بها بصمت، حتى تكون الزيارة التالية محدَّثة تلقائياً دون أي تدخل يدوي.
 * 3) إن لم يوجد في الكاش، اطلبه من الشبكة مباشرة وخزّنه لأول مرة.
 * 4) إن فشل كل شيء (لا كاش ولا شبكة)، أعد صفحة index.html كحل احتياطي
 *    أخير للتنقل بين الصفحات (يضمن عمل التوجيه الداخلي حتى في أسوأ الحالات).
 */
self.addEventListener('fetch', (event) => {
  // نتجاهل الطلبات غير GET (مثال: لا يوجد أي POST في هذا التطبيق أصلاً
  // لكن هذا الفحص يحمي من أي سلوك غير متوقع لو أُضيف مستقبلاً).
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);

      const networkFetchPromise = fetch(event.request)
        .then((networkResponse) => {
          // نُخزّن فقط الاستجابات الناجحة (200) من نفس الأصل أو من مصادر
          // موثوقة معروفة (خطوط Google) — لا نُخزّن استجابات الأخطاء.
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => null); // فشل الشبكة متوقع في وضع عدم الاتصال — لا نُفشل الوعد بالكامل

      if (cachedResponse) {
        // نُطلق تحديث الخلفية دون انتظاره، ونُعيد نسخة الكاش فوراً للمستخدم
        event.waitUntil(networkFetchPromise);
        return cachedResponse;
      }

      const networkResponse = await networkFetchPromise;
      if (networkResponse) return networkResponse;

      // لا كاش ولا شبكة — كحل أخير لطلبات التنقل، أعد الصدفة الرئيسية
      // حتى يستمر التوجيه الداخلي (hash router) في العمل بلا كسر كامل للصفحة.
      if (event.request.mode === 'navigate') {
        const fallback = await cache.match('./index.html');
        if (fallback) return fallback;
      }

      return new Response('عذراً، هذا المحتوى غير متاح حالياً بدون اتصال بالإنترنت.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    })
  );
});
