/**
 * ============================================================================
 * settings.js — الإعدادات
 * ============================================================================
 * مسؤولية واحدة: عرض والتحكم في تفضيلات المستخدم (المظهر، حجم الخط، تقليل
 * الحركة)، وأدوات إدارة البيانات (تصدير/استيراد/إعادة ضبط). لا يحتوي على
 * أي منطق عرض لبيانات تطبيقية أخرى (كيماويات، تعليم..).
 *
 * تطبيق التفضيلات فعلياً يتم عبر سمات data-* على <html>، والتي تقرأها
 * tokens.css مباشرة ([data-theme], [data-font-size]) — لا حاجة لأي تلاعب
 * مباشر بخصائص CSS من JS، مما يُبقي كل قرار تصميمي داخل طبقة الـ CSS.
 * ============================================================================
 */

import { getState, setState, resetAllData, exportStateAsJSON, importStateFromJSON } from './state.js';
import { createElement, showToast } from './utils.js';
import { registerView } from './router.js';

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

/**
 * يُهيّئ عرض الإعدادات: يبني كل المجموعات ويُطبّق التفضيلات المحفوظة فوراً.
 * @returns {void}
 */
function init() {
  rootEl = document.querySelector('[data-view="settings"]');
  if (!rootEl || rootEl.dataset.initialized === 'true') return;
  rootEl.dataset.initialized = 'true';

  rootEl.innerHTML = '';
  rootEl.appendChild(buildAppearanceGroup());
  rootEl.appendChild(buildDataManagementGroup());
  rootEl.appendChild(buildAboutGroup());

  bindDelegatedEvents();
}

/** يبني مجموعة إعدادات المظهر (الثيم، حجم الخط، تقليل الحركة). */
function buildAppearanceGroup() {
  const currentTheme = getState('theme');
  const currentFontSize = getState('fontSize');
  const reducedMotion = getState('reducedMotion');

  return createElement('div', { class: 'settings-group' }, [
    createElement('div', { class: 'view-header' }, [
      createElement('div', { class: 'view-header__eyebrow' }, ['المظهر'])
    ]),
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
    createElement('div', { class: 'view-header' }, [
      createElement('div', { class: 'view-header__eyebrow' }, ['البيانات'])
    ]),
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
        createElement('div', { class: 'settings-row__desc' }, ['استعادة نسخة محفوظة سابقاً'])
      ]),
      createElement('button', { class: 'btn btn--sm', type: 'button', id: 'importDataBtn' }, ['⬆️ استيراد']),
      createElement('input', { type: 'file', accept: 'application/json', id: 'importFileInput', class: 'u-visually-hidden' })
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

/** يبني مجموعة "حول التطبيق" مع معلومات المطوّر. */
function buildAboutGroup() {
  return createElement('div', { class: 'settings-group' }, [
    createElement('div', { class: 'view-header' }, [
      createElement('div', { class: 'view-header__eyebrow' }, ['حول التطبيق'])
    ]),
    createElement('div', { class: 'settings-row' }, [
      createElement('div', { class: 'settings-row__meta' }, [
        createElement('div', { class: 'settings-row__label' }, ['دليل الاستيوارد']),
        createElement('div', { class: 'settings-row__desc' }, ['تطبيق ويب تقدّمي (PWA) — يعمل بالكامل بدون إنترنت'])
      ])
    ])
  ]);
}

/**
 * يُطبّق تفضيل المظهر الحالي فعلياً على وسم <html> عبر data-theme.
 * @param {string} theme
 * @returns {void}
 */
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * يُطبّق تفضيل حجم الخط الحالي فعلياً على وسم <html> عبر data-font-size.
 * @param {string} fontSize
 * @returns {void}
 */
export function applyFontSize(fontSize) {
  document.documentElement.setAttribute('data-font-size', fontSize);
}

/**
 * يُسجّل مستمع الأحداث المفوَّض لكل عناصر التحكم في الإعدادات.
 * @returns {void}
 */
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
    setState({ reducedMotion: e.target.checked });
    document.documentElement.style.setProperty(
      '--duration-base',
      e.target.checked ? '0.01ms' : ''
    );
  });

  rootEl.querySelector('#importFileInput').addEventListener('change', handleImportFileSelected);
}

/**
 * يُصدّر بيانات المستخدم كملف JSON قابل للتنزيل.
 * @returns {void}
 */
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

/**
 * يعالج اختيار ملف استيراد: يقرأه، يتحقق منه، ويستبدل الحالة عند النجاح.
 * @param {Event} e
 * @returns {void}
 */
function handleImportFileSelected(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const result = importStateFromJSON(String(reader.result));
    if (result.success) {
      showToast('تم استيراد البيانات بنجاح', 'success');
      applyTheme(getState('theme'));
      applyFontSize(getState('fontSize'));
      rootEl.dataset.initialized = 'false';
      init();
    } else {
      showToast(result.error, 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

/**
 * يعالج طلب إعادة ضبط كل البيانات، بعد تأكيد صريح من المستخدم (إجراء
 * تدميري لا يمكن التراجع عنه).
 * @returns {void}
 */
function handleReset() {
  const confirmed = window.confirm('هل أنت متأكد؟ سيتم حذف كل المفضلة والتقدّم والمحادثات نهائياً.');
  if (!confirmed) return;

  resetAllData();
  applyTheme(getState('theme'));
  applyFontSize(getState('fontSize'));
  rootEl.dataset.initialized = 'false';
  init();
  showToast('تمت إعادة ضبط كل البيانات', 'success');
}

registerView('settings', {
  onEnter: () => init()
});
