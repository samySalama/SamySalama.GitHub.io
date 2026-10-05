/**
 * ============================================================================
 * app.js — نقطة الدخول الرئيسية للتطبيق
 * ============================================================================
 * مسؤولية واحدة: تسلسل الإقلاع (bootstrap) فقط. لا يحتوي هذا الملف على أي
 * منطق عرض — فقط: استيراد وحدات العروض (لتشغيل تسجيلها الذاتي عبر
 * registerView)، تطبيق تفضيلات المظهر المحفوظة، تهيئة الموجّه، ربط شريط
 * التنقل السفلي، مؤشر الاتصال بالإنترنت، وتسجيل عامل الخدمة (Service Worker).
 *
 * هذا هو الملف الوحيد المُحمَّل مباشرة من index.html عبر
 * <script type="module" src="assets/js/app.js">، وكل الوحدات الأخرى تُحمَّل
 * تلقائياً عبر سلسلة الاستيراد (import) — لا حاجة لإضافة أي <script> إضافي.
 * ============================================================================
 */

import { getState } from './state.js';
import { initRouter } from './router.js';
import { applyTheme, applyFontSize } from './settings.js';
import { showToast, isOffline } from './utils.js';

// -- استيراد وحدات كل العروض حتى تُسجّل نفسها تلقائياً لدى router.js. --
// ترتيب الاستيراد هنا لا يهم وظيفياً (كل وحدة تستدعي registerView من جانبها)
// لكنه مرتّب هنا حسب ترتيب ظهور العروض في شريط التنقل لسهولة القراءة.
import './dashboard.js';
import './chemicals.js';
import './education.js';
import './safety.js';
import './ai.js';
// settings.js مستورد بالفعل أعلاه صراحة لأننا نحتاج applyTheme/applyFontSize منه.

/**
 * يُطبّق تفضيلات المظهر المحفوظة (الثيم، حجم الخط) فور بدء التشغيل، قبل أي
 * رسم للواجهة، لتفادي "وميض" لون افتراضي خاطئ (Flash of Unstyled Theme).
 * @returns {void}
 */
function applyStoredPreferences() {
  applyTheme(getState('theme'));
  applyFontSize(getState('fontSize'));

  if (getState('reducedMotion')) {
    document.documentElement.style.setProperty('--duration-base', '0.01ms');
  }
}

/**
 * يربط أزرار شريط التنقل السفلي بالموجّه عبر تحديث location.hash مباشرة —
 * هذا يُبقي شريط التنقل عنصر HTML بسيطاً (روابط hash عادية من الناحية
 * الوظيفية) بدلاً من إضافة معالج نقر منفصل لكل زر.
 * @returns {void}
 */
function bindBottomNav() {
  document.querySelectorAll('.bottom-nav__item').forEach((btn) => {
    btn.addEventListener('click', () => {
      location.hash = btn.dataset.navTarget;
    });
  });
}

/**
 * يُظهر/يُخفي شريط تنبيه "وضع عدم الاتصال" استجابةً لأحداث online/offline
 * من المتصفح، ويضبط الحالة الأولية فور التحميل.
 * @returns {void}
 */
function bindOfflineIndicator() {
  const banner = document.getElementById('offlineBanner');
  if (!banner) return;

  const updateBannerVisibility = () => {
    banner.classList.toggle('offline-banner--visible', isOffline());
  };

  window.addEventListener('online', updateBannerVisibility);
  window.addEventListener('offline', updateBannerVisibility);
  updateBannerVisibility();
}

/**
 * يُخفي شاشة البداية (Splash Screen) بانتقال سلس بعد اكتمال تهيئة التطبيق،
 * مع حد أدنى بسيط للمدة حتى لا "تومض" الشاشة بسرعة مزعجة على الأجهزة القوية.
 * @returns {void}
 */
function hideSplashScreen() {
  const splash = document.getElementById('splashScreen');
  if (!splash) return;

  const MIN_SPLASH_DURATION_MS = 500;
  setTimeout(() => {
    splash.classList.add('splash-screen--hidden');
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
  }, MIN_SPLASH_DURATION_MS);
}

/**
 * يُسجّل عامل الخدمة (Service Worker) لتفعيل العمل بدون إنترنت والتثبيت
 * كتطبيق PWA. يُنفَّذ فقط إن كان المتصفح يدعم الميزة، ويتعامل بهدوء مع أي
 * فشل (مثال: التشغيل من file:// محلياً حيث لا تعمل عمال الخدمة إطلاقاً).
 * @returns {void}
 */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return; // عمال الخدمة لا يعملون على file:// بتصميم المتصفحات

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((err) => {
      console.warn('[app] تعذّر تسجيل عامل الخدمة — سيعمل التطبيق بدون دعم عدم الاتصال.', err);
    });
  });
}

/**
 * يستمع لحدث beforeinstallprompt ليعرض دعوة تثبيت مخصصة (بدلاً من الاعتماد
 * فقط على بانر المتصفح التلقائي)، ويُخزّن الحدث المؤجَّل لاستخدامه لاحقاً
 * عند نقر المستخدم على أي زر تثبيت مخصص قد تتم إضافته مستقبلاً.
 * @returns {void}
 */
function bindInstallPrompt() {
  let deferredInstallPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;

    if (getState('installPromptDismissed')) return;

    showToast('يمكنك تثبيت التطبيق على شاشتك الرئيسية من قائمة المتصفح 📲', 'default', 4000);
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    showToast('تم تثبيت التطبيق بنجاح 🎉', 'success');
  });
}

/**
 * تسلسل الإقلاع الكامل للتطبيق. يُستدعى مرة واحدة فور تحميل الوثيقة.
 * @returns {void}
 */
function bootstrap() {
  applyStoredPreferences();
  bindBottomNav();
  bindOfflineIndicator();
  bindInstallPrompt();
  initRouter();
  registerServiceWorker();
  hideSplashScreen();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
