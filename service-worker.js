/**
 * ============================================================================
 * service-worker.js — عامل الخدمة (الدعم الكامل لوضع عدم الاتصال)
 * ============================================================================
 * الاستراتيجية: "الكاش أولاً مع تحديث في الخلفية" لكل ملفات التطبيق الثابتة.
 *
 * تحسينات v2.1:
 *  - تحميل مسبق مرن: الملفات الأساسية إلزامية (فشلها يُفشل التثبيت)، والأيقونات
 *    اختيارية (غياب أيقونة لا يكسر التثبيت كله كما كان يحدث مع addAll).
 *  - خطوط Google تُخزَّن فعلاً (استجابات opaque كانت تُتجاهل سابقاً، فكان
 *    الخط يختفي بدون إنترنت).
 *  - تجاهل أي مخطط غير http(s) (مثل chrome-extension).
 *  - استقبال رسالة SKIP_WAITING لتحديث يتحكم فيه التطبيق مستقبلاً.
 *
 * عند أي نشر جديد: ارفع CACHE_VERSION يدوياً.
 * ============================================================================
 */

const CACHE_VERSION = 'steward-guide-v4';
const CACHE_NAME = `${CACHE_VERSION}-shell`;

/** ملفات أساسية: لا يعمل التطبيق بدونها. */
const CORE_FILES = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/tokens.css',
  './assets/css/base.css',
  './assets/css/components.css',
  './assets/css/views.css',
  './assets/css/extras.css',
  './assets/js/app.js',
  './assets/js/router.js',
  './assets/js/state.js',
  './assets/js/utils.js',
  './assets/js/data.js',
  './assets/js/quizzes.js',
  './assets/js/quiz.js',
  './assets/js/a11y.js',
  './assets/js/pwa-update.js',
  './assets/js/assistant-engine.js',
  './assets/js/dashboard.js',
  './assets/js/chemicals.js',
  './assets/js/education.js',
  './assets/js/safety.js',
  './assets/js/ai.js',
  './assets/js/settings.js'
];

/** ملفات اختيارية: تُحمَّل إن وُجدت ويُتجاهل غيابها. */
const OPTIONAL_FILES = [
  './assets/icons/icon-32.png',
  './assets/icons/icon-72.png',
  './assets/icons/icon-96.png',
  './assets/icons/icon-128.png',
  './assets/icons/icon-144.png',
  './assets/icons/icon-152.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-192-maskable.png',
  './assets/icons/icon-384.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-512-maskable.png'
];

/** مضيفو الخطوط المسموح بتخزين استجاباتهم (قد تكون opaque). */
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(CORE_FILES);
      await Promise.allSettled(OPTIONAL_FILES.map((url) => cache.add(url)));
      await self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((n) => n.startsWith('steward-guide-') && n !== CACHE_NAME).map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/**
 * هل نُخزّن هذه الاستجابة؟
 *  - ناجحة (200) من أي مصدر http(s)
 *  - أو opaque (status 0) لكن من مضيفي الخطوط فقط
 */
function isCacheable(request, response) {
  if (!response) return false;
  if (response.status === 200) return true;
  const { hostname } = new URL(request.url);
  return response.type === 'opaque' && FONT_HOSTS.includes(hostname);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);

      const networkPromise = fetch(request)
        .then((response) => {
          if (isCacheable(request, response)) cache.put(request, response.clone());
          return response;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(networkPromise);
        return cached;
      }

      const response = await networkPromise;
      if (response) return response;

      if (request.mode === 'navigate') {
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
