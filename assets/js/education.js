/**
 * ============================================================================
 * education.js — أكاديمية التعليم
 * ============================================================================
 * مسؤولية واحدة: عرض الوحدات التعليمية التسع كأكورديون، ببناء كل نوع محتوى
 * فرعي (شبكة معلومات، مقياس pH، خطوات، بطاقات معدات، جداول، قواعد ذهبية،
 * HACCP، حساسية، ترتيب ثلاجة، ألواح تقطيع) من بيانات data.js فقط — لا يوجد
 * أي HTML ثابت لهذا المحتوى، كل شيء يُبنى ديناميكياً بدالة مخصصة لكل شكل.
 *
 * يتتبع أيضاً تقدّم المستخدم (وحدات مكتملة، إنجازات) عبر state.js.
 * ============================================================================
 */

import { educationModules } from './data.js';
import { getState, markModuleCompleted, unlockAchievement } from './state.js';
import { createElement, showToast, toggleExpandable } from './utils.js';
import { registerView } from './router.js';

let rootEl = null;

/**
 * يُهيّئ عرض التعليم: يبني كل وحدات الأكورديون من educationModules.
 * @returns {void}
 */
function init() {
  rootEl = document.querySelector('[data-view="education"]');
  if (!rootEl || rootEl.dataset.initialized === 'true') return;
  rootEl.dataset.initialized = 'true';

  rootEl.innerHTML = '';
  const accordion = createElement('div', { class: 'accordion' });
  educationModules.forEach((mod) => accordion.appendChild(buildAccordionItem(mod)));
  rootEl.appendChild(accordion);

  bindDelegatedEvents();
}

/**
 * يبني عنصر أكورديون واحد كاملاً (رأس + جسم) لوحدة تعليمية معيّنة.
 * @param {Object} mod - وحدة تعليمية من educationModules.
 * @returns {HTMLElement}
 */
function buildAccordionItem(mod) {
  const bodyId = `edu-body-${mod.id}`;
  const isOpen = Boolean(mod.defaultOpen);
  const isCompleted = getState('completedModuleIds').includes(mod.id);

  const titleChildren = [mod.title];
  if (mod.isNew) {
    titleChildren.push(createElement('span', { class: 'accordion__badge-new' }, ['جديد']));
  }
  if (isCompleted) {
    titleChildren.push(createElement('span', { class: 'badge badge--brand', style: 'margin-inline-start:auto' }, ['✅ مكتمل']));
  }

  const header = createElement(
    'button',
    {
      class: 'accordion__header',
      type: 'button',
      'aria-expanded': isOpen ? 'true' : 'false',
      'aria-controls': bodyId,
      'data-module-id': mod.id
    },
    [
      createElement('span', { class: 'accordion__icon', 'aria-hidden': 'true' }, [mod.icon]),
      createElement('span', { class: 'accordion__title' }, titleChildren),
      createElement('span', { class: 'accordion__chevron', 'aria-hidden': 'true' }, ['▾'])
    ]
  );

  const bodyInner = createElement('div', { class: 'accordion__body-inner' }, buildModuleContent(mod));

  const body = createElement(
    'div',
    { class: 'accordion__body', id: bodyId, 'data-open': isOpen ? 'true' : 'false' },
    [bodyInner]
  );

  return createElement('div', { class: 'accordion__item', 'data-module-id': mod.id }, [
    createElement('h2', { style: 'font-size:inherit' }, [header]),
    body
  ]);
}

/**
 * يوجّه لبناء محتوى الوحدة الصحيح بناءً على معرّفها — كل وحدة لها شكل
 * محتوى مختلف تماماً عن الأخرى، لذا كل واحدة لها دالة بناء منفصلة.
 * @param {Object} mod
 * @returns {HTMLElement[]}
 */
function buildModuleContent(mod) {
  switch (mod.id) {
    case 'science': return buildScienceModule(mod);
    case 'stages': return buildStagesModule(mod);
    case 'cleaning-types': return buildCleaningTypesModule(mod);
    case 'dishwasher': return buildDishwasherModule(mod);
    case 'equipment': return buildEquipmentModule(mod);
    case 'hygiene': return buildHygieneModule(mod);
    case 'conservation': return buildConservationModule(mod);
    case 'golden-rules': return buildGoldenRulesModule(mod);
    case 'haccp': return buildHaccpModule(mod);
    default: return [];
  }
}

/** يبني "علم النظافة والتطهير": شبكة الاتساخات + مقياس pH + مستويات التنظيف. */
function buildScienceModule(mod) {
  const soilGrid = createElement(
    'div',
    { class: 'info-grid' },
    mod.soilTypes.map((s) =>
      createElement('div', { class: 'info-card' }, [
        createElement('div', { class: 'info-card__icon', 'aria-hidden': 'true' }, [s.icon]),
        createElement('div', { class: 'info-card__title' }, [s.title]),
        createElement('div', { class: 'info-card__desc' }, [s.desc])
      ])
    )
  );

  const phBar = createElement('div', { class: 'ph-scale' }, [
    createElement('div', { class: 'ph-scale__bar', role: 'img', 'aria-label': 'مقياس pH من 1 إلى 14' }),
    createElement(
      'div',
      { class: 'ph-scale__numbers', 'aria-hidden': 'true' },
      Array.from({ length: 14 }, (_, i) => {
        const n = i + 1;
        return n === 7
          ? createElement('span', { class: 'ph-scale__numbers-neutral' }, [String(n)])
          : createElement('span', {}, [String(n)]);
      })
    ),
    createElement('div', { class: 'ph-scale__labels' }, [
      createElement('span', {}, ['حمضي قوي — يُزيل الأملاح']),
      createElement('span', {}, ['محايد pH 7 — آمن تماماً']),
      createElement('span', {}, ['قلوي قوي — يُزيل الدهون'])
    ])
  ]);

  const phRefList = createElement(
    'div',
    { class: 'ph-ref-list' },
    mod.phReference.map((ref) =>
      createElement('div', { class: 'ph-ref-item' }, [
        createElement('span', { class: `ph-ref-item__badge ph-ref-item__badge--${ref.type}` }, [`pH ${ref.ph}`]),
        createElement('span', { class: 'ph-ref-item__text' }, [ref.text])
      ])
    )
  );

  const levelsGrid = createElement(
    'div',
    { class: 'info-grid' },
    mod.cleaningLevels.map((lvl) =>
      createElement('div', { class: `info-card info-card--${lvl.variant}` }, [
        createElement('div', { class: 'info-card__icon', 'aria-hidden': 'true' }, [lvl.icon]),
        createElement('div', { class: 'info-card__title' }, [lvl.title]),
        createElement('div', { class: 'info-card__desc' }, [lvl.desc])
      ])
    )
  );

  return [
    soilGrid,
    createElement('hr', { class: 'accordion__divider' }),
    createElement('h3', { class: 'accordion__subheading' }, ['مقياس pH — اختر المنظف الصحيح']),
    phBar,
    phRefList,
    createElement('hr', { class: 'accordion__divider' }),
    createElement('h3', { class: 'accordion__subheading' }, ['الفرق بين التنظيف والتطهير والتعقيم']),
    levelsGrid
  ];
}

/** يبني "مراحل التنظيف الخمس": تدفّق خطوات مرقّمة. */
function buildStagesModule(mod) {
  return [buildStepsFlow(mod.steps)];
}

/**
 * يبني قائمة خطوات مرقّمة عامة (يُعاد استخدامها لأكثر من وحدة).
 * @param {Array<{title:string, desc:string, variant?:string}>} steps
 * @returns {HTMLElement}
 */
function buildStepsFlow(steps) {
  return createElement(
    'ol',
    { class: 'steps-flow' },
    steps.map((step, i) =>
      createElement('li', { class: 'step-item' }, [
        createElement(
          'div',
          { class: `step-item__number${step.variant ? ` step-item__number--${step.variant}` : ''}`, 'aria-hidden': 'true' },
          [step.label ?? String(i + 1)]
        ),
        createElement('div', { class: 'step-item__content' }, [
          createElement('div', { class: 'step-item__title' }, [step.title]),
          createElement('div', { class: 'step-item__desc' }, [step.desc])
        ])
      ])
    )
  );
}

/** يبني "أنواع النظافة الثلاثة": بطاقات معدّات-نمط لكل نوع. */
function buildCleaningTypesModule(mod) {
  return mod.types.map((type) =>
    createElement('div', { class: 'equip-card' }, [
      createElement('div', { class: 'equip-card__title' }, [type.title]),
      createElement(
        'ul',
        { class: 'equip-card__steps' },
        type.items.map((item) => createElement('li', {}, [item]))
      )
    ])
  );
}

/** يبني "ماكينة غسيل الأطباق": جدول حرارة + تحذيرات + خطوات الحوض الثلاثي. */
function buildDishwasherModule(mod) {
  const table = createElement('table', { class: 'data-table' }, [
    createElement('caption', { class: 'u-visually-hidden' }, ['درجات حرارة ماكينة غسيل الأطباق حسب المرحلة']),
    createElement('tr', {}, [
      createElement('th', { scope: 'col' }, ['المرحلة']),
      createElement('th', { scope: 'col' }, ['الحرارة']),
      createElement('th', { scope: 'col' }, ['الهدف'])
    ]),
    ...mod.tempTable.map((row) =>
      createElement('tr', {}, [
        createElement('th', { scope: 'row' }, [row.stage]),
        createElement('td', { 'data-temp': row.level }, [row.temp]),
        createElement('td', { style: 'font-size:11px' }, [row.note])
      ])
    )
  ]);

  const warnings = mod.warnings.map((w) =>
    createElement('div', { class: 'alert-box alert-box--warning' }, [
      createElement('span', { 'aria-hidden': 'true' }, ['⚠️']),
      createElement('div', {}, [w])
    ])
  );

  return [
    table,
    ...warnings,
    createElement('hr', { class: 'accordion__divider' }),
    createElement('h3', { class: 'accordion__subheading' }, ['الحوض الثلاثي — الغسيل اليدوي']),
    buildStepsFlow(mod.manualWashSteps.map((s) => ({ ...s, label: s.label })))
  ];
}

/** يبني "نظافة المعدات": تنبيه القاعدة الذهبية + بطاقة لكل جهاز. */
function buildEquipmentModule(mod) {
  const alertBox = createElement('div', { class: 'alert-box alert-box--danger' }, [
    createElement('span', { 'aria-hidden': 'true' }, ['🔴']),
    createElement('div', {}, [createElement('strong', {}, ['قاعدة ذهبية: ']), mod.goldenRuleAlert.replace('قاعدة ذهبية: ', '')])
  ]);

  const equipmentCards = mod.equipment.map((eq) => {
    const children = [createElement('div', { class: 'equip-card__title' }, [eq.title])];
    if (eq.alert) {
      children.push(
        createElement('div', { class: 'alert-box alert-box--danger', style: 'margin:8px 0' }, [
          createElement('span', { 'aria-hidden': 'true' }, ['⛔']),
          createElement('div', {}, [eq.alert])
        ])
      );
    }
    children.push(
      createElement('ul', { class: 'equip-card__steps' }, eq.steps.map((s) => createElement('li', {}, [s])))
    );
    if (eq.tags.length > 0) {
      children.push(
        createElement('div', { class: 'equip-card__tags' }, eq.tags.map((t) => createElement('span', { class: 'badge badge--neutral' }, [t])))
      );
    }
    return createElement('div', { class: 'equip-card' }, children);
  });

  return [alertBox, ...equipmentCards];
}

/** يبني "النظافة الشخصية": تنبيه معلوماتي + شبكة معلومات. */
function buildHygieneModule(mod) {
  return [
    createElement('div', { class: 'alert-box alert-box--info' }, [
      createElement('span', { 'aria-hidden': 'true' }, ['💡']),
      createElement('div', {}, [mod.infoNote])
    ]),
    createElement(
      'div',
      { class: 'info-grid' },
      mod.items.map((item) =>
        createElement('div', { class: 'info-card' }, [
          createElement('div', { class: 'info-card__icon', 'aria-hidden': 'true' }, [item.icon]),
          createElement('div', { class: 'info-card__title' }, [item.title]),
          createElement('div', { class: 'info-card__desc' }, [item.desc])
        ])
      )
    )
  ];
}

/** يبني "توفير الكيماويات والطاقة والمياه": قائمة سلامة بسيطة. */
function buildConservationModule(mod) {
  return [
    createElement(
      'ul',
      { class: 'safety-list' },
      mod.items.map((item) =>
        createElement('li', {}, [
          createElement('span', { class: 'safety-list__icon', 'aria-hidden': 'true' }, [item.icon]),
          createElement('span', {}, [item.text])
        ])
      )
    )
  ];
}

/** يبني "13 قاعدة ذهبية": أهم وحدة من ناحية تنوع المحتوى الفرعي. */
function buildGoldenRulesModule(mod) {
  const rulesGrid1 = createElement(
    'div',
    { class: 'rule-grid' },
    mod.rules.slice(0, 6).map(buildRuleCard)
  );
  const rulesGrid2 = createElement(
    'div',
    { class: 'rule-grid' },
    mod.rules.slice(6).map(buildRuleCard)
  );

  const tempQuickGrid = createElement(
    'div',
    { class: 'info-grid' },
    mod.tempQuick.map((t) =>
      createElement('div', { class: 'info-card' }, [
        createElement('div', { class: 'info-card__icon', 'aria-hidden': 'true' }, [t.icon]),
        createElement('div', { class: 'info-card__title' }, [t.label]),
        createElement('div', { class: 'info-card__desc' }, [t.value])
      ])
    )
  );

  const allergenGrid = createElement(
    'div',
    { class: 'allergen-grid' },
    mod.allergens.map((a) => {
      const [icon, ...labelParts] = a.split(' ');
      return createElement('div', { class: 'allergen-badge' }, [
        createElement('span', { class: 'allergen-badge__icon', 'aria-hidden': 'true' }, [icon]),
        createElement('span', { class: 'allergen-badge__label' }, [labelParts.join(' ')])
      ]);
    })
  );

  const fridgeOrder = createElement(
    'div',
    { class: 'fridge-order' },
    mod.fridgeOrder.map((tier) =>
      createElement('div', { class: 'fridge-tier' }, [
        createElement('span', { class: 'fridge-tier__icon', 'aria-hidden': 'true' }, [tier.icon]),
        createElement('div', { style: 'flex:1' }, [
          createElement('div', { class: 'fridge-tier__label' }, [tier.label]),
          createElement('div', { class: 'fridge-tier__note' }, [tier.note])
        ]),
        tier.edge
          ? createElement('span', { class: 'fridge-tier__arrow', 'aria-hidden': 'true' }, [tier.edge === 'top' ? 'الأعلى' : 'الأسفل'])
          : ''
      ].filter(Boolean))
    )
  );

  const boardGrid = createElement(
    'div',
    { class: 'info-grid' },
    mod.cuttingBoards.map((b) =>
      createElement('div', { class: 'info-card' }, [
        createElement('div', {
          'aria-hidden': 'true',
          style: `width:28px;height:28px;border-radius:var(--radius-sm);background:${b.color};margin-bottom:6px`
        }),
        createElement('div', { class: 'info-card__title' }, [b.name]),
        createElement('div', { class: 'info-card__desc' }, [b.use])
      ])
    )
  );

  return [
    createElement('div', { class: 'alert-box alert-box--info' }, [
      createElement('span', { 'aria-hidden': 'true' }, ['📌']),
      createElement('div', {}, [mod.infoNote])
    ]),
    createElement('h3', { class: 'accordion__subheading' }, ['القواعد 1 – 6']),
    rulesGrid1,
    createElement('hr', { class: 'accordion__divider' }),
    createElement('h3', { class: 'accordion__subheading' }, ['القواعد 7 – 13']),
    rulesGrid2,
    createElement('hr', { class: 'accordion__divider' }),
    createElement('h3', { class: 'accordion__subheading' }, ['درجات الحرارة الآمنة (القاعدة 2)']),
    tempQuickGrid,
    createElement('hr', { class: 'accordion__divider' }),
    createElement('h3', { class: 'accordion__subheading' }, ['مسببات الحساسية التسعة (القاعدة 3)']),
    allergenGrid,
    createElement('div', { class: 'alert-box alert-box--warning' }, [
      createElement('span', { 'aria-hidden': 'true' }, ['🟣']),
      createElement('div', {}, [mod.allergyAlert])
    ]),
    createElement('hr', { class: 'accordion__divider' }),
    createElement('h3', { class: 'accordion__subheading' }, ['ترتيب الثلاجة من الأعلى للأسفل (القاعدة 11)']),
    fridgeOrder,
    createElement('div', { style: 'font-size:12px;color:var(--content-muted)' }, [mod.fridgeNote]),
    createElement('hr', { class: 'accordion__divider' }),
    createElement('h3', { class: 'accordion__subheading' }, ['الألواح والسكاكين الملونة (القاعدة 13)']),
    boardGrid
  ];
}

/**
 * يبني بطاقة قاعدة ذهبية واحدة.
 * @param {{n:number, title:string, desc:string}} rule
 * @returns {HTMLElement}
 */
function buildRuleCard(rule) {
  return createElement('div', { class: 'rule-card' }, [
    createElement('div', { class: 'rule-card__number', 'aria-hidden': 'true' }, [String(rule.n)]),
    createElement('div', {}, [
      createElement('div', { class: 'rule-card__title' }, [rule.title]),
      createElement('div', { class: 'rule-card__desc' }, [rule.desc])
    ])
  ]);
}

/** يبني "نظام HACCP": تنبيه تعريفي + شبكة المبادئ السبعة. */
function buildHaccpModule(mod) {
  const grid = createElement(
    'div',
    { class: 'haccp-grid' },
    mod.principles.map((p) =>
      createElement('div', { class: 'haccp-card' }, [
        createElement('div', { class: 'haccp-card__number', 'aria-hidden': 'true' }, [String(p.n)]),
        createElement('div', {}, [
          createElement('div', { class: 'haccp-card__title' }, [p.title]),
          createElement('div', { class: 'haccp-card__desc' }, [p.desc]),
          createElement('div', { class: 'haccp-card__example' }, [createElement('strong', {}, ['مثال: ']), p.example])
        ])
      ])
    )
  );

  return [
    createElement('div', { class: 'alert-box alert-box--info' }, [
      createElement('span', { 'aria-hidden': 'true' }, ['🛡️']),
      createElement('div', {}, [
        createElement('strong', {}, ['HACCP']),
        ` ${mod.infoNote.replace(/^HACCP\s*/, '')}`
      ])
    ]),
    grid,
    createElement('div', { style: 'font-size:12px;color:var(--content-muted);margin-top:12px' }, [mod.closingNote])
  ];
}

/**
 * يُسجّل مستمع أحداث مفوَّض واحد للتعامل مع فتح/طي كل عناصر الأكورديون.
 * @returns {void}
 */
function bindDelegatedEvents() {
  rootEl.addEventListener('click', (e) => {
    const header = e.target.closest('.accordion__header');
    if (!header) return;
    handleAccordionToggle(header);
  });
}

/**
 * يعالج فتح/طي وحدة أكورديون، ويُسجّل الوحدة كمكتملة أول مرة تُفتح فيها
 * (منطق تعليمي بسيط: "المشاهدة تعني الإكمال" لأغراض تتبع التقدّم).
 * @param {HTMLElement} header
 * @returns {void}
 */
function handleAccordionToggle(header) {
  const moduleId = header.dataset.moduleId;
  const item = header.closest('.accordion__item');
  const body = item.querySelector('.accordion__body');
  const nowOpen = toggleExpandable(header, body);

  if (nowOpen) {
    const wasAlreadyCompleted = getState('completedModuleIds').includes(moduleId);
    markModuleCompleted(moduleId);
    if (!wasAlreadyCompleted) {
      checkAndUnlockAchievements();
    }
  }
}

/**
 * يفحص إن كان عدد الوحدات المكتملة قد وصل لعتبة تُفتح عندها إنجازات جديدة،
 * ويعرض توست احتفالياً عند فتح إنجاز لأول مرة.
 * @returns {void}
 */
function checkAndUnlockAchievements() {
  const completedCount = getState('completedModuleIds').length;
  const totalModules = educationModules.length;

  if (completedCount >= 1 && unlockAchievement('first-module')) {
    showToast('🏆 إنجاز جديد: أول وحدة تعليمية مكتملة!', 'success');
  }
  if (completedCount >= Math.ceil(totalModules / 2) && unlockAchievement('halfway-there')) {
    showToast('🏆 إنجاز جديد: أكملت نصف الأكاديمية!', 'success');
  }
  if (completedCount === totalModules && unlockAchievement('academy-master')) {
    showToast('🏆 إنجاز ذهبي: أكملت كل وحدات الأكاديمية!', 'success');
  }
}

registerView('education', {
  onEnter: () => init()
});
