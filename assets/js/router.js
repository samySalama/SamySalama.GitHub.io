/**
 * ============================================================================
 * router.js — التوجيه الداخلي القائم على الـ Hash
 * ============================================================================
 * مسؤولية واحدة: تحديد أي عرض ظاهر بناءً على location.hash، وتبديل العروض،
 * وتحديث حالة "النشط" في شريط التنقل.
 *
 * v2.2: تغيّر المعاملات داخل نفس العرض (#chemicals?open=7 ← ?open=8) يستدعي
 * onEnter من جديد بدل أن يُتجاهل — أساس الروابط العميقة والمشاركة.
 * ============================================================================
 */

import { recordRecentView } from './state.js';

const DEFAULT_VIEW = 'dashboard';

/** @type {Map<string, {onEnter?: Function, onLeave?: Function}>} */
const registeredViews = new Map();

let currentViewName = null;
let currentParamsKey = null;

/**
 * يُسجّل وحدة عرض في الموجّه.
 * @param {string} viewName
 * @param {{onEnter?: (params: URLSearchParams) => void, onLeave?: () => void}} lifecycle
 * @returns {void}
 */
export function registerView(viewName, lifecycle) {
  registeredViews.set(viewName, lifecycle);
}

/**
 * يقرأ اسم العرض وأي معاملات من location.hash (#viewName أو #viewName?key=value).
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

/** يطبّق الانتقال الفعلي بين عرضين (أو تغيّر معاملات داخل نفس العرض). */
function applyRoute() {
  const { viewName, params } = parseHash();
  const paramsKey = params.toString();

  if (viewName === currentViewName) {
    if (paramsKey !== currentParamsKey) {
      currentParamsKey = paramsKey;
      registeredViews.get(viewName)?.onEnter?.(params);
    }
    return;
  }

  const previousViewName = currentViewName;
  currentViewName = viewName;
  currentParamsKey = paramsKey;

  if (previousViewName && registeredViews.has(previousViewName)) {
    registeredViews.get(previousViewName).onLeave?.();
  }

  document.querySelectorAll('.view').forEach((section) => {
    section.hidden = section.dataset.view !== viewName;
  });

  document.querySelectorAll('.bottom-nav__item').forEach((navBtn) => {
    navBtn.setAttribute('aria-current', navBtn.dataset.navTarget === viewName ? 'page' : 'false');
  });

  window.scrollTo({ top: 0, behavior: 'instant' });

  if (registeredViews.has(viewName)) {
    registeredViews.get(viewName).onEnter?.(params);
  }

  recordRecentView(viewName);
  updateDocumentTitle(viewName);
}

const VIEW_TITLES = {
  dashboard: 'لوحة التحكم',
  chemicals: 'المواد الكيميائية',
  education: 'أكاديمية التعليم',
  safety: 'السلامة والطوارئ',
  logs: 'السجلات التشغيلية',
  print: 'المطبوعات',
  ai: 'المساعد الذكي',
  settings: 'الإعدادات'
};

function updateDocumentTitle(viewName) {
  const label = VIEW_TITLES[viewName] ?? '';
  document.title = label ? `${label} — دليل الاستيوارد` : 'دليل الاستيوارد';
}

/**
 * ينتقل برمجياً لعرض معيّن مع معاملات اختيارية.
 * @param {string} viewName
 * @param {Record<string, string>} [params]
 * @returns {void}
 */
export function navigateTo(viewName, params = {}) {
  const query = new URLSearchParams(params).toString();
  location.hash = query ? `${viewName}?${query}` : viewName;
}

/** يُهيّئ الموجّه ويُنفّذ أول توجيه. يُستدعى مرة واحدة من app.js. */
export function initRouter() {
  window.addEventListener('hashchange', applyRoute);
  applyRoute();
}
