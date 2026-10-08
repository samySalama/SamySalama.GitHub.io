/**
 * ============================================================================
 * a11y.js — تحسينات الإتاحة والتجربة الشاملة (v2.1)
 * ============================================================================
 * مسؤولية واحدة: إصلاحات سلوكية مستقلة عن العروض، ناتجة عن تدقيق الواجهة.
 *  1) رابط «تخطي للمحتوى»: كان يغيّر hash فيرميك الموجّه إلى لوحة التحكم.
 *  2) meta theme-color يتبع مظهر التطبيق (لا مظهر النظام فقط).
 *  3) خيار «تقليل الحركة» اليدوي يُطبَّق عبر data-reduced-motion (يقرؤه CSS).
 *  4) أسماء المواد الإنجليزية translate="no" لمنع تشويه الترجمة التلقائية.
 * ============================================================================
 */

import { getState, subscribe } from './state.js';

const THEME_COLORS = { dark: '#0d1117', light: '#f7f8fa' };

function setupSkipLink() {
  document.querySelector('.skip-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    const main = document.getElementById('main-content');
    if (!main) return;
    main.setAttribute('tabindex', '-1');
    main.focus();
  });
}

function syncThemeColor() {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  const metas = [...document.querySelectorAll('meta[name="theme-color"]')];
  if (!metas.length) return;
  metas.slice(1).forEach((m) => m.remove());
  metas[0].removeAttribute('media');
  metas[0].setAttribute('content', THEME_COLORS[theme] ?? THEME_COLORS.dark);
}

function syncReducedMotion() {
  document.documentElement.setAttribute('data-reduced-motion', String(Boolean(getState('reducedMotion'))));
}

function markBrandNamesUntranslatable() {
  document.querySelectorAll('.card__title:not([translate])').forEach((el) => el.setAttribute('translate', 'no'));
}

function enhanceDynamicContent() {
  markBrandNamesUntranslatable();
}

function init() {
  setupSkipLink();

  syncThemeColor();
  new MutationObserver(syncThemeColor).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

  syncReducedMotion();
  subscribe(syncReducedMotion);

  let scheduled = false;
  const main = document.getElementById('main-content');
  if (main) {
    new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        enhanceDynamicContent();
      });
    }).observe(main, { childList: true, subtree: true });
  }
  enhanceDynamicContent();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
