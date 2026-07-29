/**
 * ============================================================================
 * dashboard.js — لوحة التحكم الرئيسية
 * ============================================================================
 * مسؤولية واحدة: تجميع وعرض ملخص سريع للتطبيق كصفحة هبوط داخلية — إحصائيات،
 * إجراءات سريعة، آخر ما تمت مشاهدته، المفضلة، وتقدّم الأكاديمية. لا يمتلك
 * أي بيانات أو حالة خاصة به؛ فقط يقرأ من state.js و data.js ويُصيّرها.
 * ============================================================================
 */

import { chemicals, educationModules } from './data.js';
import { getState, subscribe } from './state.js';
import { createElement } from './utils.js';
import { registerView, navigateTo } from './router.js';
import { openChemicalById } from './chemicals.js';

let rootEl = null;
let unsubscribeFromState = null;

/**
 * يُهيّئ لوحة التحكم: يبني الهيكل مرة واحدة، ثم يشترك في تغييرات الحالة
 * لإعادة العرض تلقائياً كلما تغيّرت المفضلة أو السجل أو التقدّم التعليمي.
 * @returns {void}
 */
function init() {
  rootEl = document.querySelector('[data-view="dashboard"]');
  if (!rootEl) return;

  if (rootEl.dataset.initialized !== 'true') {
    rootEl.dataset.initialized = 'true';
    bindDelegatedEvents();
    unsubscribeFromState = subscribe(() => renderDynamicSections());
  }

  render();
}

/**
 * يبني كامل لوحة التحكم من الصفر (تُستدعى عند أول دخول فقط لأن الأجزاء
 * الديناميكية تُحدَّث لاحقاً عبر renderDynamicSections بدلاً من إعادة البناء
 * الكامل، تفادياً لإعادة رسم غير ضرورية لعناصر ثابتة مثل البطل والإجراءات).
 * @returns {void}
 */
function render() {
  rootEl.innerHTML = '';
  // عنوان مخفي بصرياً فقط — لوحة التحكم بها عنوان مرئي داخل hero-panel،
  // لكن قارئ الشاشة يحتاج <h1> صريحاً للتنقل بالعناوين (لا يُعتبر
  // hero-panel__title عنواناً دلالياً لأنه <div> وليس <h1>).
  rootEl.appendChild(createElement('h1', { class: 'u-visually-hidden' }, ['لوحة التحكم الرئيسية']));
  rootEl.appendChild(buildHeroPanel());
  rootEl.appendChild(buildQuickActions());
  rootEl.appendChild(createElement('div', { id: 'dashDynamicSections' }));
  renderDynamicSections();
}

/** يبني لوحة البطل الترحيبية أعلى الصفحة. */
function buildHeroPanel() {
  return createElement('div', { class: 'hero-panel' }, [
    createElement('div', { class: 'hero-panel__kicker' }, ['قسم الاستيوارد — Marriott']),
    createElement('div', { class: 'hero-panel__title' }, ['دليلك الشامل للتشغيل الآمن']),
    createElement('div', { class: 'hero-panel__desc' }, [
      'مرجع فوري للمواد الكيميائية، إجراءات السلامة، ومساعد ذكي يجيب على أسئلتك التشغيلية — كل ذلك يعمل بدون إنترنت.'
    ]),
    createElement('div', { class: 'hero-panel__actions' }, [
      createElement('button', { class: 'btn btn--primary', type: 'button', 'data-goto': 'chemicals' }, ['🧪 تصفح المواد']),
      createElement('button', { class: 'btn btn--ghost', type: 'button', 'data-goto': 'ai' }, ['🤖 اسأل المساعد'])
    ])
  ]);
}

/** يبني شبكة الإجراءات السريعة. */
function buildQuickActions() {
  const actions = [
    { icon: '📚', label: 'الأكاديمية', view: 'education' },
    { icon: '🚨', label: 'الطوارئ', view: 'safety' },
    { icon: '🤖', label: 'المساعد', view: 'ai' },
    { icon: '⚙️', label: 'الإعدادات', view: 'settings' }
  ];

  return createElement('div', {}, [
    createElement('div', { class: 'section-heading' }, ['إجراءات سريعة']),
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

/**
 * يُعيد بناء الأجزاء المعتمدة على الحالة فقط (إحصائيات، أخيراً، مفضلة، تقدّم)
 * دون لمس البطل أو الإجراءات السريعة الثابتة — يُستدعى عند أي تغيير حالة.
 * @returns {void}
 */
function renderDynamicSections() {
  const container = rootEl?.querySelector('#dashDynamicSections');
  if (!container) return;

  container.innerHTML = '';
  container.appendChild(buildStatsGrid());
  container.appendChild(buildRecentSection());
  container.appendChild(buildFavoritesSection());
  container.appendChild(buildProgressSection());
}

/** يبني شبكة بطاقات الإحصائيات السريعة. */
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

/** يبني قائمة "شوهد مؤخراً" من سجل المواد الكيميائية الأخيرة. */
function buildRecentSection() {
  const recentIds = getState('recentChemicalIds');
  if (recentIds.length === 0) return createElement('div');

  const recentChemicals = recentIds
    .map((id) => chemicals.find((c) => c.id === id))
    .filter(Boolean)
    .slice(0, 5);

  return createElement('div', {}, [
    createElement('div', { class: 'section-heading' }, ['شوهد مؤخراً']),
    createElement(
      'div',
      { class: 'recent-list' },
      recentChemicals.map((chem) =>
        createElement('button', { class: 'recent-item', type: 'button', 'data-open-chem': chem.id }, [
          createElement('span', { 'aria-hidden': 'true' }, ['🧪']),
          createElement('div', { class: 'recent-item__meta' }, [
            createElement('div', { class: 'recent-item__title' }, [chem.nameEn]),
            createElement('div', { class: 'recent-item__sub' }, [chem.desc])
          ])
        ])
      )
    )
  ]);
}

/** يبني قائمة المواد الكيميائية المفضلة. */
function buildFavoritesSection() {
  const favoriteIds = getState('favoriteChemicalIds');
  if (favoriteIds.length === 0) return createElement('div');

  const favoriteChemicals = favoriteIds.map((id) => chemicals.find((c) => c.id === id)).filter(Boolean);

  return createElement('div', {}, [
    createElement('div', { class: 'section-heading' }, ['المفضلة']),
    createElement(
      'div',
      { class: 'recent-list' },
      favoriteChemicals.map((chem) =>
        createElement('button', { class: 'recent-item', type: 'button', 'data-open-chem': chem.id }, [
          createElement('span', { 'aria-hidden': 'true' }, ['⭐']),
          createElement('div', { class: 'recent-item__meta' }, [
            createElement('div', { class: 'recent-item__title' }, [chem.nameEn]),
            createElement('div', { class: 'recent-item__sub' }, [chem.desc])
          ])
        ])
      )
    )
  ]);
}

/** يبني ملخص تقدّم الأكاديمية بشريط تقدّم. */
function buildProgressSection() {
  const completedCount = getState('completedModuleIds').length;
  const totalModules = educationModules.length;
  const percentage = Math.round((completedCount / totalModules) * 100);

  return createElement('div', {}, [
    createElement('div', { class: 'section-heading' }, ['تقدّم الأكاديمية']),
    createElement('div', { class: 'dashboard-card', style: 'margin:0 var(--space-4) var(--space-4)' }, [
      createElement('div', { class: 'u-flex u-justify-between u-items-center u-gap-2' }, [
        createElement('span', { class: 'dashboard-card__label' }, [`${completedCount} من ${totalModules} وحدة`]),
        createElement('span', { class: 'dashboard-card__value', style: 'font-size:16px' }, [`${percentage}%`])
      ]),
      createElement('div', { class: 'progress-bar', style: 'margin-top:8px' }, [
        createElement('div', { class: 'progress-bar__fill', style: `transform:scaleX(${percentage / 100})` })
      ])
    ])
  ]);
}

/**
 * يُسجّل مستمع الأحداث المفوَّض لكل التفاعلات داخل لوحة التحكم.
 * @returns {void}
 */
function bindDelegatedEvents() {
  rootEl.addEventListener('click', (e) => {
    const gotoBtn = e.target.closest('[data-goto]');
    if (gotoBtn) {
      navigateTo(gotoBtn.dataset.goto);
      return;
    }

    const openChemBtn = e.target.closest('[data-open-chem]');
    if (openChemBtn) {
      const chemId = Number(openChemBtn.dataset.openChem);
      navigateTo('chemicals');
      // ننتظر إطاراً واحداً لضمان أن عرض المواد الكيميائية أصبح مُهيَّأً
      // ومرئياً في الـ DOM قبل محاولة فتح البطاقة والتمرير إليها.
      requestAnimationFrame(() => openChemicalById(chemId));
    }
  });
}

registerView('dashboard', {
  onEnter: () => init(),
  onLeave: () => {
    // لا نُلغي الاشتراك عند المغادرة لأن لوحة التحكم يجب أن تبقى محدَّثة
    // في الخلفية (مثال: لو أضاف المستخدم مفضلة من عرض آخر ثم عاد للوحة).
  }
});
