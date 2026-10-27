/**
 * ============================================================================
 * dashboard.js — لوحة التحكم الرئيسية
 * ============================================================================
 * مسؤولية واحدة: ملخص سريع كصفحة هبوط داخلية — إجراءات سريعة، حالة اليوم
 * (قوائم الوردية وسجل الحرارة)، إحصائيات، آخر المشاهدات، المفضلة، تقدّم الأكاديمية.
 * لا يمتلك حالة؛ يقرأ من state.js و data.js ويُصيّرها.
 *
 * v2.3: قسم «اليوم» + إجراءان سريعان جديدان (السجلات، المطبوعات).
 * ============================================================================
 */

import { chemicals, educationModules } from './data.js';
import { getState, subscribe, localDateKey } from './state.js';
import { checklists } from './checklists.js';
import { createElement } from './utils.js';
import { registerView, navigateTo } from './router.js';

let rootEl = null;

/** يُهيّئ اللوحة: هيكل مرة واحدة ثم اشتراك في الحالة لتحديث الأقسام الديناميكية. */
function init() {
  rootEl = document.querySelector('[data-view="dashboard"]');
  if (!rootEl) return;

  if (rootEl.dataset.initialized !== 'true') {
    rootEl.dataset.initialized = 'true';
    bindDelegatedEvents();
    subscribe(() => renderDynamicSections());
  }

  render();
}

function render() {
  rootEl.innerHTML = '';
  rootEl.appendChild(createElement('h1', { class: 'u-visually-hidden' }, ['لوحة التحكم الرئيسية']));
  rootEl.appendChild(buildHeroPanel());
  rootEl.appendChild(buildQuickActions());
  rootEl.appendChild(createElement('div', { id: 'dashDynamicSections' }));
  renderDynamicSections();
}

function buildHeroPanel() {
  return createElement('div', { class: 'hero-panel' }, [
    createElement('div', { class: 'hero-panel__kicker' }, ['قسم الاستيوارد — Marriott']),
    createElement('div', { class: 'hero-panel__title' }, ['دليلك الشامل للتشغيل الآمن']),
    createElement('div', { class: 'hero-panel__desc' }, [
      'مرجع فوري للمواد الكيميائية، إجراءات السلامة، سجلات الوردية، ومساعد ذكي يجيب على أسئلتك التشغيلية — كل ذلك يعمل بدون إنترنت.'
    ]),
    createElement('div', { class: 'hero-panel__actions' }, [
      createElement('button', { class: 'btn btn--primary', type: 'button', 'data-goto': 'chemicals' }, ['🧪 تصفح المواد']),
      createElement('button', { class: 'btn btn--ghost', type: 'button', 'data-goto': 'ai' }, ['🤖 اسأل المساعد'])
    ])
  ]);
}

function buildQuickActions() {
  const actions = [
    { icon: '📝', label: 'السجلات', view: 'logs' },
    { icon: '📚', label: 'الأكاديمية', view: 'education' },
    { icon: '🚨', label: 'الطوارئ', view: 'safety' },
    { icon: '🖨️', label: 'المطبوعات', view: 'print' },
    { icon: '🤖', label: 'المساعد', view: 'ai' },
    { icon: '⚙️', label: 'الإعدادات', view: 'settings' }
  ];

  return createElement('div', {}, [
    createElement('h2', { class: 'section-heading' }, ['إجراءات سريعة']),
    createElement(
      'div',
      { class: 'quick-actions' },
      actions.map((a) =>
        createElement('button', { class: 'quick-action', type: 'button', 'data-goto': a.view }, [
          createElement('span', { class: 'quick-action__icon', 'aria-hidden': 'true' }, [a.icon]),
          createElement('span', {}, [a.label])
        ])
      )
    )
  ]);
}

/** يعيد بناء الأجزاء المعتمدة على الحالة فقط. */
function renderDynamicSections() {
  const container = rootEl?.querySelector('#dashDynamicSections');
  if (!container) return;

  container.innerHTML = '';
  container.appendChild(buildTodaySection());
  container.appendChild(buildStatsGrid());
  container.appendChild(buildRecentSection());
  container.appendChild(buildFavoritesSection());
  container.appendChild(buildProgressSection());
}

/** قسم «اليوم»: تقدّم قوائم الوردية + قراءات الحرارة الخارجة عن الحد اليوم. */
function buildTodaySection() {
  const dateKey = localDateKey();
  const progress = getState('checklistProgress')[dateKey] ?? {};
  const totalItems = Object.values(checklists).reduce((n, l) => n + l.items.length, 0);
  const doneItems = Object.entries(checklists).reduce((n, [id]) => n + (progress[id]?.length ?? 0), 0);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todays = getState('temperatureLog').filter((r) => r.ts >= startOfDay.getTime());
  const outOfLimit = todays.filter((r) => !r.ok).length;

  return createElement('div', {}, [
    createElement('h2', { class: 'section-heading' }, ['اليوم']),
    createElement('div', { class: 'dashboard-grid' }, [
      createElement('button', { class: 'dashboard-card dashboard-card--link', type: 'button', 'data-goto': 'logs' }, [
        createElement('div', { class: 'dashboard-card__value' }, [`${doneItems}/${totalItems}`]),
        createElement('div', { class: 'dashboard-card__label' }, ['بنود قوائم الوردية']),
        createElement('div', { class: 'dashboard-card__hint' }, ['افتح السجلات'])
      ]),
      createElement('button', { class: 'dashboard-card dashboard-card--link', type: 'button', 'data-goto': 'logs' }, [
        createElement('div', { class: `dashboard-card__value${outOfLimit ? ' dashboard-card__value--alert' : ''}` }, [String(todays.length)]),
        createElement('div', { class: 'dashboard-card__label' }, ['قراءات حرارة اليوم']),
        createElement('div', { class: 'dashboard-card__hint' }, [outOfLimit ? `⚠️ ${outOfLimit} خارج الحد` : 'كلها ضمن الحد'])
      ])
    ])
  ]);
}

function buildStatsGrid() {
  const favoritesCount = getState('favoriteChemicalIds').length;
  const completedCount = getState('completedModuleIds').length;
  const totalModules = educationModules.length;

  const stats = [
    { value: String(chemicals.length), label: 'مادة كيميائية', hint: 'قاعدة بيانات كاملة' },
    { value: String(favoritesCount), label: 'في المفضلة', hint: 'وصول سريع' },
    { value: `${completedCount}/${totalModules}`, label: 'وحدات مكتملة', hint: 'تقدّم الأكاديمية' }
  ];

  return createElement(
    'div',
    { class: 'dashboard-grid' },
    stats.map((s) =>
      createElement('div', { class: 'dashboard-card' }, [
        createElement('div', { class: 'dashboard-card__value' }, [s.value]),
        createElement('div', { class: 'dashboard-card__label' }, [s.label]),
        createElement('div', { class: 'dashboard-card__hint' }, [s.hint])
      ])
    )
  );
}

function chemicalList(heading, icon, ids) {
  const items = ids.map((id) => chemicals.find((c) => c.id === id)).filter(Boolean);
  return createElement('div', {}, [
    createElement('h2', { class: 'section-heading' }, [heading]),
    createElement(
      'div',
      { class: 'recent-list' },
      items.map((chem) =>
        createElement('button', { class: 'recent-item', type: 'button', 'data-open-chem': chem.id }, [
          createElement('span', { 'aria-hidden': 'true' }, [icon]),
          createElement('div', { class: 'recent-item__meta' }, [
            createElement('div', { class: 'recent-item__title', translate: 'no' }, [chem.nameEn]),
            createElement('div', { class: 'recent-item__sub' }, [chem.desc])
          ])
        ])
      )
    )
  ]);
}

function buildRecentSection() {
  const ids = getState('recentChemicalIds').slice(0, 5);
  return ids.length === 0 ? createElement('div') : chemicalList('شوهد مؤخراً', '🧪', ids);
}

function buildFavoritesSection() {
  const ids = getState('favoriteChemicalIds');
  return ids.length === 0 ? createElement('div') : chemicalList('المفضلة', '⭐', ids);
}

function buildProgressSection() {
  const completedCount = getState('completedModuleIds').length;
  const totalModules = educationModules.length;
  const percentage = Math.round((completedCount / totalModules) * 100);
  const certificateReady = completedCount === totalModules;

  const children = [
    createElement('div', { class: 'u-flex u-justify-between u-items-center u-gap-2' }, [
      createElement('span', { class: 'dashboard-card__label' }, [`${completedCount} من ${totalModules} وحدة`]),
      createElement('span', { class: 'dashboard-card__value', style: 'font-size:16px' }, [`${percentage}%`])
    ]),
    createElement('div', { class: 'progress-bar', style: 'margin-top:8px', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(percentage), 'aria-label': 'تقدّم الأكاديمية' }, [
      createElement('div', { class: 'progress-bar__fill', style: `transform:scaleX(${percentage / 100})` })
    ])
  ];
  if (certificateReady) {
    children.push(
      createElement('button', { class: 'btn btn--sm btn--primary', type: 'button', 'data-goto': 'print', style: 'margin-top:12px' }, ['🎓 اطبع شهادة الإكمال'])
    );
  }

  return createElement('div', {}, [
    createElement('h2', { class: 'section-heading' }, ['تقدّم الأكاديمية']),
    createElement('div', { class: 'dashboard-card', style: 'margin:0 var(--space-4) var(--space-4)' }, children)
  ]);
}

function bindDelegatedEvents() {
  rootEl.addEventListener('click', (e) => {
    const gotoBtn = e.target.closest('[data-goto]');
    if (gotoBtn) {
      navigateTo(gotoBtn.dataset.goto);
      return;
    }

    const openChemBtn = e.target.closest('[data-open-chem]');
    if (openChemBtn) {
      navigateTo('chemicals', { open: openChemBtn.dataset.openChem });
    }
  });
}

registerView('dashboard', {
  onEnter: () => init()
});
