/**
 * ============================================================================
 * settings.js — الإعدادات
 * ============================================================================
 * مسؤولية واحدة: تفضيلات المستخدم (المظهر، حجم الخط، تقليل الحركة)، وأدوات
 * إدارة البيانات (تصدير/استيراد/إعادة ضبط). التطبيق الفعلي للتفضيلات يتم عبر
 * سمات data-* على <html> تقرؤها tokens.css / extras.css.
 *
 * v2.2: تأكيد قبل الاستيراد (يستبدل بياناتك كلها)، وعنوان <h1> لا يُمحى،
 * ورقم الإصدار من APP_VERSION.
 * ============================================================================
 */

import { getState, setState, resetAllData, exportStateAsJSON, importStateFromJSON } from './state.js';
import { createElement, showToast } from './utils.js';
import { registerView } from './router.js';

/** رقم الإصدار المعروض في «حول التطبيق». */
export const APP_VERSION = 'v2.2';

let rootEl = null;

const THEME_OPTIONS = [
  { value: 'dark', label: '🌙 داكن' },
  { value: 'light', label: '☀️ فاتح' }
];

const FONT_SIZE_OPTIONS = [
  { value: 'small', label: 'صغير' },
  { value: 'medium', label: 'متوسط' },
  { value: 'large', label: 'كبير' },
  { value: 'xlarge', label: 'كبير جداً' }
];

/** يُهيّئ عرض الإعدادات: يبني كل المجموعات. */
function init() {
  rootEl = document.querySelector('[data-view="settings"]');
  if (!rootEl || rootEl.dataset.initialized === 'true') return;
  rootEl.dataset.initialized = 'true';

  rootEl.innerHTML = '';
  rootEl.appendChild(
    createElement('div', { class: 'view-header' }, [
      createElement('div', { class: 'view-header__eyebrow' }, ['الإعدادات']),
      createElement('h1', { class: 'view-header__title' }, ['تفضيلات التطبيق'])
    ])
  );
  rootEl.appendChild(buildAppearanceGroup());
  rootEl.appendChild(buildDataManagementGroup());
  rootEl.appendChild(buildAboutGroup());

  bindDelegatedEvents();
}

/** يبني مجموعة إعدادات المظهر. */
function buildAppearanceGroup() {
  const currentTheme = getState('theme');
  const currentFontSize = getState('fontSize');
  const reducedMotion = getState('reducedMotion');

  return createElement('div', { class: 'settings-group' }, [
    createElement('div', { class: 'view-header' }, [createElement('h2', { class: 'view-header__eyebrow' }, ['المظهر'])]),
    createElement('div', { class: 'settings-row' }, [
      createElement('div', { class: 'settings-row__meta' }, [
        createElement('div', { class: 'settings-row__label' }, ['المظهر العام']),
        createElement('div', { class: 'settings-row__desc' }, ['اختر بين الوضع الداكن والفاتح'])
      ]),
      createElement(
        'div',
        { class: 'theme-picker', role: 'group', 'aria-label': 'اختيار المظهر' },
        THEME_OPTIONS.map((opt) =>
          createElement(
            'button',
            {
              class: 'theme-picker__option',
              type: 'button',
              'data-theme-option': opt.value,
              'aria-pressed': opt.value === currentTheme ? 'true' : 'false'
            },
            [opt.label]
          )
        )
      )
    ]),
    createElement('div', { class: 'settings-row' }, [
      createElement('div', { class: 'settings-row__meta' }, [
        createElement('div', { class: 'settings-row__label' }, ['حجم الخط']),
        createElement('div', { class: 'settings-row__desc' }, ['يؤثر على كل نصوص التطبيق'])
      ])
    ]),
    createElement(
      'div',
      { class: 'font-size-picker', role: 'group', 'aria-label': 'اختيار حجم الخط' },
      FONT_SIZE_OPTIONS.map((opt) =>
        createElement(
          'button',
          {
            class: 'font-size-picker__option',
            type: 'button',
            'data-font-size-option': opt.value,
            'aria-pressed': opt.value === currentFontSize ? 'true' : 'false'
          },
          [opt.label]
        )
      )
    ),
    createElement('div', { class: 'settings-row' }, [
      createElement('div', { class: 'settings-row__meta' }, [
        createElement('div', { class: 'settings-row__label' }, ['تقليل الحركة']),
        createElement('div', { class: 'settings-row__desc' }, ['إيقاف الانتقالات والحركات الزخرفية'])
      ]),
      createElement('label', { class: 'switch' }, [
        createElement('input', {
          type: 'checkbox',
          class: 'switch__input',
          id: 'reducedMotionToggle',
          'aria-label': 'تقليل الحركة',
          ...(reducedMotion ? { checked: 'true' } : {})
        }),
        createElement('span', { class: 'switch__track' }),
        createElement('span', { class: 'switch__thumb' })
      ])
    ])
  ]);
}

/** يبني مجموعة إدارة البيانات (تصدير، استيراد، إعادة ضبط). */
function buildDataManagementGroup() {
  return createElement('div', { class: 'settings-group' }, [
    createElement('div', { class: 'view-header' }, [createElement('h2', { class: 'view-header__eyebrow' }, ['البيانات'])]),
    createElement('div', { class: 'settings-row' }, [
      createElement('div', { class: 'settings-row__meta' }, [
        createElement('div', { class: 'settings-row__label' }, ['تصدير البيانات']),
        createElement('div', { class: 'settings-row__desc' }, ['احفظ نسخة من مفضلاتك وتقدّمك'])
      ]),
      createElement('button', { class: 'btn btn--sm', type: 'button', id: 'exportDataBtn' }, ['⬇️ تصدير'])
    ]),
    createElement('div', { class: 'settings-row' }, [
      createElement('div', { class: 'settings-row__meta' }, [
        createElement('div', { class: 'settings-row__label' }, ['استيراد البيانات']),
        createElement('div', { class: 'settings-row__desc' }, ['استعادة نسخة محفوظة سابقاً (تستبدل بياناتك الحالية)'])
      ]),
      createElement('button', { class: 'btn btn--sm', type: 'button', id: 'importDataBtn' }, ['⬆️ استيراد']),
      createElement('input', {
        type: 'file',
        accept: 'application/json',
        id: 'importFileInput',
        class: 'u-visually-hidden',
        tabindex: '-1',
        'aria-hidden': 'true'
      })
    ]),
    createElement('div', { class: 'settings-row' }, [
      createElement('div', { class: 'settings-row__meta' }, [
        createElement('div', { class: 'settings-row__label' }, ['إعادة ضبط كل البيانات']),
        createElement('div', { class: 'settings-row__desc' }, ['حذف المفضلة والتقدّم والمحادثات نهائياً'])
      ]),
      createElement('button', { class: 'btn btn--sm btn--danger', type: 'button', id: 'resetDataBtn' }, ['🗑️ إعادة ضبط'])
    ])
  ]);
}

/** يبني مجموعة «حول التطبيق». */
function buildAboutGroup() {
  return createElement('div', { class: 'settings-group' }, [
    createElement('div', { class: 'view-header' }, [createElement('h2', { class: 'view-header__eyebrow' }, ['حول التطبيق'])]),
    createElement('div', { class: 'settings-row' }, [
      createElement('div', { class: 'settings-row__meta' }, [
        createElement('div', { class: 'settings-row__label' }, ['دليل الاستيوارد']),
        createElement('div', { class: 'settings-row__desc' }, ['تطبيق ويب تقدّمي (PWA) — يعمل بالكامل بدون إنترنت'])
      ])
    ]),
    createElement('div', { class: 'settings-row' }, [
      createElement('div', { class: 'settings-row__meta' }, [
        createElement('div', { class: 'settings-row__label' }, ['الإصدار']),
        createElement('div', { class: 'settings-row__desc', id: 'appVersionText' }, [
          `${APP_VERSION} — روابط مشاركة المواد، اختبارات الأكاديمية، تحسينات الإتاحة والأمان`
        ])
      ])
    ])
  ]);
}

/**
 * يُطبّق تفضيل المظهر على <html> عبر data-theme.
 * @param {string} theme
 * @returns {void}
 */
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * يُطبّق تفضيل حجم الخط على <html> عبر data-font-size.
 * @param {string} fontSize
 * @returns {void}
 */
export function applyFontSize(fontSize) {
  document.documentElement.setAttribute('data-font-size', fontSize);
}

/** يسجّل مستمع الأحداث المفوَّض لعناصر التحكم. */
function bindDelegatedEvents() {
  rootEl.addEventListener('click', (e) => {
    const themeOption = e.target.closest('[data-theme-option]');
    if (themeOption) {
      const theme = themeOption.dataset.themeOption;
      setState({ theme });
      applyTheme(theme);
      rootEl.querySelectorAll('[data-theme-option]').forEach((btn) =>
        btn.setAttribute('aria-pressed', btn.dataset.themeOption === theme ? 'true' : 'false')
      );
      return;
    }

    const fontSizeOption = e.target.closest('[data-font-size-option]');
    if (fontSizeOption) {
      const fontSize = fontSizeOption.dataset.fontSizeOption;
      setState({ fontSize });
      applyFontSize(fontSize);
      rootEl.querySelectorAll('[data-font-size-option]').forEach((btn) =>
        btn.setAttribute('aria-pressed', btn.dataset.fontSizeOption === fontSize ? 'true' : 'false')
      );
      return;
    }

    if (e.target.closest('#exportDataBtn')) {
      handleExport();
      return;
    }

    if (e.target.closest('#importDataBtn')) {
      rootEl.querySelector('#importFileInput').click();
      return;
    }

    if (e.target.closest('#resetDataBtn')) {
      handleReset();
    }
  });

  rootEl.querySelector('#reducedMotionToggle').addEventListener('change', (e) => {
    // data-reduced-motion على <html> يُزامَن تلقائياً من a11y.js عبر subscribe
    setState({ reducedMotion: e.target.checked });
    document.documentElement.style.setProperty('--duration-base', e.target.checked ? '0.01ms' : '');
  });

  rootEl.querySelector('#importFileInput').addEventListener('change', handleImportFileSelected);
}

/** يُصدّر بيانات المستخدم كملف JSON قابل للتنزيل. */
function handleExport() {
  const json = exportStateAsJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = createElement('a', { href: url, download: 'steward-app-backup.json' });
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast('تم تصدير البيانات', 'success');
}

/** إعادة بناء العرض بعد تغيّر الحالة بالكامل (استيراد/إعادة ضبط). */
function rebuild() {
  applyTheme(getState('theme'));
  applyFontSize(getState('fontSize'));
  rootEl.dataset.initialized = 'false';
  init();
}

/**
 * يعالج اختيار ملف استيراد: تأكيد صريح، قراءة، تحقق، ثم استبدال الحالة.
 * @param {Event} e
 * @returns {void}
 */
function handleImportFileSelected(e) {
  const input = e.target;
  const file = input.files?.[0];
  if (!file) return;

  const confirmed = window.confirm('سيتم استبدال كل بياناتك الحالية (المفضلة والتقدّم والمحادثات) بمحتوى الملف. متابعة؟');
  if (!confirmed) {
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const result = importStateFromJSON(String(reader.result));
    if (result.success) {
      showToast('تم استيراد البيانات بنجاح', 'success');
      rebuild();
    } else {
      showToast(result.error, 'error');
    }
  };
  reader.onerror = () => showToast('تعذّر قراءة الملف', 'error');
  reader.readAsText(file);
  input.value = '';
}

/** إعادة ضبط كل البيانات بعد تأكيد صريح (إجراء تدميري). */
function handleReset() {
  const confirmed = window.confirm('هل أنت متأكد؟ سيتم حذف كل المفضلة والتقدّم والمحادثات نهائياً.');
  if (!confirmed) return;

  resetAllData();
  rebuild();
  showToast('تمت إعادة ضبط كل البيانات', 'success');
}

registerView('settings', {
  onEnter: () => init()
});
