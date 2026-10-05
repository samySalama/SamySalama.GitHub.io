/**
 * ============================================================================
 * router.js — التوجيه الداخلي القائم على الـ Hash
 * ============================================================================
 * مسؤولية واحدة: تحديد أي عرض (view) ظاهر حالياً بناءً على location.hash،
 * وتبديل العروض عبر تبديل السمة hidden، وتحديث حالة "النشط" في شريط التنقل.
 *
 * هذا الملف لا يعرف شيئاً عن محتوى أي صفحة — فقط يستدعي دورة حياة (lifecycle)
 * كل وحدة عرض مسجَّلة: onEnter عند الدخول، onLeave عند المغادرة. هذا الفصل
 * يسمح بإضافة/حذف عروض دون تعديل منطق التوجيه نفسه (مبدأ الفتح للتوسعة،
 * الإغلاق للتعديل — Open/Closed Principle).
 * ============================================================================
 */

import { recordRecentView } from './state.js';

/** الاسم الافتراضي للعرض عند عدم وجود hash صالح في الرابط. */
const DEFAULT_VIEW = 'dashboard';

/**
 * سجل كل العروض المسجَّلة، بمفتاح اسم العرض.
 * @type {Map<string, {onEnter?: Function, onLeave?: Function}>}
 */
const registeredViews = new Map();

/** اسم العرض الظاهر حالياً، لتفادي استدعاء onEnter/onLeave بشكل متكرر لنفس العرض. */
let currentViewName = null;

/**
 * يُسجّل وحدة عرض في الموجّه. تُستدعى هذه الدالة مرة واحدة من كل ملف عرض
 * (dashboard.js, chemicals.js, ...) عند تحميل التطبيق.
 * @param {string} viewName - يجب أن يطابق قيمة data-view في HTML وقيمة الـ hash.
 * @param {{onEnter?: (params: URLSearchParams) => void, onLeave?: () => void}} lifecycle
 * @returns {void}
 */
export function registerView(viewName, lifecycle) {
  registeredViews.set(viewName, lifecycle);
}

/**
 * يقرأ اسم العرض الحالي وأي معاملات إضافية من location.hash.
 * الصيغة المدعومة: #viewName أو #viewName?key=value
 * @returns {{viewName: string, params: URLSearchParams}}
 */
function parseHash() {
  const raw = location.hash.replace(/^#/, '');
  const [viewName, queryString] = raw.split('?');
  return {
    viewName: viewName && registeredViews.has(viewName) ? viewName : DEFAULT_VIEW,
    params: new URLSearchParams(queryString ?? '')
  };
}

/**
 * ينفّذ الانتقال الفعلي بين عرضين: يُخفي كل العروض، يُظهر العرض الهدف فقط،
 * يُحدّث aria-current في شريط التنقل، ويستدعي onLeave/onEnter بالترتيب الصحيح.
 * @returns {void}
 */
function applyRoute() {
  const { viewName, params } = parseHash();
  if (viewName === currentViewName) return; // لا تكرار غير ضروري لنفس العرض

  const previousViewName = currentViewName;
  currentViewName = viewName;

  // -- استدعاء onLeave للعرض السابق --
  if (previousViewName && registeredViews.has(previousViewName)) {
    registeredViews.get(previousViewName).onLeave?.();
  }

  // -- تبديل الظهور الفعلي في الـ DOM --
  document.querySelectorAll('.view').forEach((section) => {
    const isTarget = section.dataset.view === viewName;
    section.hidden = !isTarget;
  });

  // -- تحديث شريط التنقل السفلي (aria-current لأغراض الإتاحة والتصميم) --
  document.querySelectorAll('.bottom-nav__item').forEach((navBtn) => {
    const isActive = navBtn.dataset.navTarget === viewName;
    navBtn.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  // -- إعادة تمرير الصفحة لأعلى عند كل تنقل، لتجربة استخدام متوقعة --
  window.scrollTo({ top: 0, behavior: 'instant' });

  // -- استدعاء onEnter للعرض الجديد --
  if (registeredViews.has(viewName)) {
    registeredViews.get(viewName).onEnter?.(params);
  }

  recordRecentView(viewName);
  updateDocumentTitle(viewName);
}

/** أسماء العروض وعناوينها المعروضة في <title> للمتصفح ولمحركات البحث. */
const VIEW_TITLES = {
  dashboard: 'لوحة التحكم',
  chemicals: 'المواد الكيميائية',
  education: 'أكاديمية التعليم',
  safety: 'السلامة والطوارئ',
  ai: 'المساعد الذكي',
  settings: 'الإعدادات'
};

/**
 * يُحدّث عنوان مستند الصفحة ليعكس العرض الحالي (مفيد للـ SEO ولتبويبات المتصفح).
 * @param {string} viewName
 * @returns {void}
 */
function updateDocumentTitle(viewName) {
  const label = VIEW_TITLES[viewName] ?? '';
  document.title = label ? `${label} — دليل الاستيوارد` : 'دليل الاستيوارد';
}

/**
 * ينتقل برمجياً لعرض معيّن (تُستخدم من أزرار "الإجراءات السريعة" وغيرها
 * بدلاً من ربط <a href="#..."> مباشرة، لإتاحة تمرير معاملات إضافية).
 * @param {string} viewName
 * @param {Record<string, string>} [params]
 * @returns {void}
 */
export function navigateTo(viewName, params = {}) {
  const query = new URLSearchParams(params).toString();
  location.hash = query ? `${viewName}?${query}` : viewName;
}

/**
 * يُهيّئ الموجّه: يستمع لتغييرات الـ hash، وينفّذ أول توجيه فور التحميل.
 * يجب استدعاؤها مرة واحدة فقط من app.js بعد تسجيل كل العروض.
 * @returns {void}
 */
export function initRouter() {
  window.addEventListener('hashchange', applyRoute);
  applyRoute();
}
