/**
 * ============================================================================
 * app.js — نقطة الدخول الرئيسية للتطبيق
 * ============================================================================
 * مسؤولية واحدة: تسلسل الإقلاع (bootstrap) فقط — استيراد وحدات العروض لتسجّل
 * نفسها، تطبيق التفضيلات، تهيئة الموجّه، مؤشر الاتصال، تسجيل عامل الخدمة.
 *
 * v2.2: شريط التنقل صار روابط <a href="#..."> حقيقية، فحُذف مستمع النقر القديم
 * (كان يغيّر الـ hash حتى مع Ctrl+click لفتح تبويب جديد).
 * ============================================================================
 */

import { getState } from './state.js';
import { initRouter } from './router.js';
import { applyTheme, applyFontSize } from './settings.js';
import { showToast, isOffline } from './utils.js';

import './dashboard.js';
import './chemicals.js';
import './education.js';
import './safety.js';
import './logs.js';
import './print.js';
import './ai.js';

/** يُطبّق المظهر وحجم الخط المحفوظين قبل أي رسم، لتفادي وميض مظهر خاطئ. */
function applyStoredPreferences() {
  applyTheme(getState('theme'));
  applyFontSize(getState('fontSize'));

  if (getState('reducedMotion')) {
    document.documentElement.style.setProperty('--duration-base', '0.01ms');
  }
}

/** يُظهر/يُخفي شريط «وضع عدم الاتصال» حسب أحداث online/offline. */
function bindOfflineIndicator() {
  const banner = document.getElementById('offlineBanner');
  if (!banner) return;

  const updateBannerVisibility = () => {
    const offline = isOffline();
    banner.classList.toggle('offline-banner--visible', offline);
    banner.setAttribute('aria-hidden', String(!offline));
  };

  window.addEventListener('online', updateBannerVisibility);
  window.addEventListener('offline', updateBannerVisibility);
  updateBannerVisibility();
}

/** يُخفي شاشة البداية بعد التهيئة مع حد أدنى بسيط للمدة. */
function hideSplashScreen() {
  const splash = document.getElementById('splashScreen');
  if (!splash) return;

  const MIN_SPLASH_DURATION_MS = 500;
  setTimeout(() => {
    splash.classList.add('splash-screen--hidden');
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
    // احتياط: مع «تقليل الحركة» قد لا يقع transitionend
    setTimeout(() => splash.remove(), 1000);
  }, MIN_SPLASH_DURATION_MS);
}

/** يسجّل عامل الخدمة (لا يعمل على file://). */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((err) => {
      console.warn('[app] تعذّر تسجيل عامل الخدمة — سيعمل التطبيق بدون دعم عدم الاتصال.', err);
    });
  });
}

/** يعرض تلميح تثبيت التطبيق عند توفّر beforeinstallprompt، وتأكيداً بعد التثبيت. */
function bindInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    if (getState('installPromptDismissed')) return;
    showToast('يمكنك تثبيت التطبيق على شاشتك الرئيسية من قائمة المتصفح 📲', 'default', 4000);
  });

  window.addEventListener('appinstalled', () => {
    showToast('تم تثبيت التطبيق بنجاح 🎉', 'success');
  });
}

/** تسلسل الإقلاع الكامل — يُستدعى مرة واحدة. */
function bootstrap() {
  applyStoredPreferences();
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
