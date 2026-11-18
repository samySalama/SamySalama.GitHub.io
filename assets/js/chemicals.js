/**
 * ============================================================================
 * chemicals.js — عرض المواد الكيميائية
 * ============================================================================
 * مسؤولية واحدة: عرض قاعدة بيانات المواد الكيميائية، البحث والفلترة،
 * وبطاقات قابلة للتوسيع بكامل التفاصيل (استخدام، تخفيف، PPE، إسعافات أولية،
 * تخزين، تحذيرات، مواد ذات صلة). لا يحتوي على منطق حالة عامة (ذلك في state.js)
 * ولا بيانات خام (ذلك في data.js) — فقط منطق العرض والتفاعل لهذا العرض تحديداً.
 *
 * يستخدم تفويض الأحداث (Event Delegation): مستمع واحد فقط على الحاوية
 * الأم بدلاً من مستمع لكل بطاقة/زر، وهو ما يوفر الذاكرة ويبسّط إعادة العرض.
 * ============================================================================
 */

import { chemicals, categoryMeta } from './data.js';
import {
  getState,
  toggleFavoriteChemical,
  recordRecentChemical
} from './state.js';
import {
  normalizeText,
  getDangerLabel,
  getDangerVariant,
  createElement,
  showToast,
  copyToClipboard,
  debounce,
  toggleExpandable
} from './utils.js';
import { registerView } from './router.js';

/** حالة محلية خاصة بهذا العرض فقط (بحث/فلتر حاليين) — لا تُحفظ في localStorage عمداً. */
let searchQuery = '';
let activeCategory = 'all';
/** يتتبع أي البطاقات مفتوحة حالياً لإعادة بنائها بنفس الحالة بعد كل ترشيح. */
const expandedCardIds = new Set();

let rootEl = null;

/**
 * يُهيّئ عرض المواد الكيميائية: يبني الهيكل الثابت (شريط أدوات + حاوية بطاقات)
 * مرة واحدة، ثم يُسجّل مستمعي الأحداث المفوَّضة.
 * @returns {void}
 */
function init() {
  rootEl = document.querySelector('[data-view="chemicals"]');
  if (!rootEl || rootEl.dataset.initialized === 'true') return;
  rootEl.dataset.initialized = 'true';

  rootEl.innerHTML = '';
  rootEl.appendChild(createElement('h1', { class: 'u-visually-hidden' }, ['المواد الكيميائية']));
  rootEl.appendChild(buildToolbar());
  rootEl.appendChild(createElement('div', { class: 'stats-bar', id: 'chemStatsBar' }));
  rootEl.appendChild(createElement('div', { class: 'cards-list', id: 'chemCardsList' }));

  bindDelegatedEvents();
  renderList();
}

/**
 * يبني شريط الأدوات العلوي: مربع البحث وشرائح تصفية الفئات.
 * @returns {HTMLElement}
 */
function buildToolbar() {
  const searchInput = createElement('input', {
    type: 'search',
    class: 'field__input field__input--with-icon',
    id: 'chemSearchInput',
    placeholder: 'ابحث عن مادة، استخدام، أو خطر...',
    'aria-label': 'بحث في المواد الكيميائية'
  });

  const filterChips = Object.entries(categoryMeta).map(([key, meta]) =>
    createElement(
      'button',
      {
        class: 'chip',
        type: 'button',
        'data-category': key,
        'aria-pressed': key === activeCategory ? 'true' : 'false'
      },
      [meta.label]
    )
  );

  return createElement('div', { class: 'toolbar' }, [
    createElement('div', { class: 'field__control-wrap' }, [
      createElement('span', { class: 'field__icon', 'aria-hidden': 'true' }, ['🔍']),
      searchInput
    ]),
    createElement('div', { class: 'toolbar__filters u-scroll-x', role: 'group', 'aria-label': 'تصفية حسب الفئة' }, filterChips)
  ]);
}

/**
 * يُسجّل كل مستمعي الأحداث للعرض عبر تفويض واحد على الجذر (event delegation)،
 * بدلاً من ربط مستمع منفصل بكل بطاقة أو زر يُعاد بناؤه مع كل ترشيح.
 * @returns {void}
 */
function bindDelegatedEvents() {
  const searchInput = rootEl.querySelector('#chemSearchInput');
  searchInput.addEventListener(
    'input',
    debounce((e) => {
      searchQuery = e.target.value;
      renderList();
    }, 180)
  );

  rootEl.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-category]');
    if (chip) {
      activeCategory = chip.dataset.category;
      rootEl.querySelectorAll('[data-category]').forEach((btn) => {
        btn.setAttribute('aria-pressed', btn.dataset.category === activeCategory ? 'true' : 'false');
      });
      renderList();
      return;
    }

    const toggleBtn = e.target.closest('.card__toggle');
    if (toggleBtn) {
      handleCardToggle(toggleBtn);
      return;
    }

    const favoriteBtn = e.target.closest('[data-action="favorite"]');
    if (favoriteBtn) {
      handleFavoriteClick(favoriteBtn);
      return;
    }

    const copyBtn = e.target.closest('[data-action="copy"]');
    if (copyBtn) {
      handleCopyClick(copyBtn);
      return;
    }

    const relatedBtn = e.target.closest('[data-action="open-related"]');
    if (relatedBtn) {
      openChemicalById(Number(relatedBtn.dataset.chemId));
    }
  });
}

/**
 * يُرشّح قائمة المواد الكيميائية حسب نص البحث والفئة النشطة معاً.
 * @returns {import('./data.js').Chemical[]}
 */
function getFilteredChemicals() {
  const normalizedQuery = normalizeText(searchQuery);
  return chemicals.filter((chem) => {
    const matchesCategory = activeCategory === 'all' || chem.category.includes(activeCategory);
    if (!matchesCategory) return false;
    if (!normalizedQuery) return true;

    const haystack = normalizeText(
      [chem.nameAr, chem.nameEn, chem.desc, chem.usage, chem.hazard].join(' ')
    );
    return haystack.includes(normalizedQuery);
  });
}

/**
 * يُعيد بناء قائمة البطاقات بالكامل بناءً على الترشيح الحالي، ويُحدّث شريط
 * الإحصائيات. يُستدعى بعد أي تغيير في البحث أو الفئة.
 * @returns {void}
 */
function renderList() {
  const filtered = getFilteredChemicals();
  const listEl = rootEl.querySelector('#chemCardsList');
  const statsEl = rootEl.querySelector('#chemStatsBar');

  statsEl.textContent = `${filtered.length} من ${chemicals.length} مادة`;

  listEl.innerHTML = '';
  if (filtered.length === 0) {
    listEl.appendChild(buildEmptyState());
    return;
  }

  const favorites = getState('favoriteChemicalIds');
  filtered.forEach((chem) => {
    listEl.appendChild(buildChemicalCard(chem, favorites.includes(chem.id)));
  });
}

/**
 * يبني حالة "لا نتائج" تُعرض عند عدم تطابق أي مادة مع البحث/الفلتر الحالي.
 * @returns {HTMLElement}
 */
function buildEmptyState() {
  return createElement('div', { class: 'empty-state' }, [
    createElement('div', { class: 'empty-state__icon', 'aria-hidden': 'true' }, ['🔍']),
    createElement('div', {}, ['لا توجد نتائج مطابقة']),
    createElement('div', { class: 'u-visually-hidden' }, ['جرّب كلمة بحث أخرى أو غيّر الفئة المختارة'])
  ]);
}

/**
 * يبني بطاقة مادة كيميائية كاملة (رأس قابل للطي + جسم بالتفاصيل).
 * @param {import('./data.js').Chemical} chem
 * @param {boolean} isFavorite
 * @returns {HTMLElement}
 */
function buildChemicalCard(chem, isFavorite) {
  const bodyId = `chem-body-${chem.id}`;
  const isExpanded = expandedCardIds.has(chem.id);
  const dangerVariant = getDangerVariant(chem.danger);

  const card = createElement('article', {
    class: `card${isExpanded ? ' card--expanded' : ''}`,
    'data-chem-id': chem.id
  });

  card.appendChild(createElement('div', { class: `card__accent-strip card__accent-strip--${dangerVariant}` }));

  card.appendChild(
    createElement('div', { class: 'card__header' }, [
      createElement(
        'button',
        {
          class: 'card__toggle',
          type: 'button',
          'aria-expanded': isExpanded ? 'true' : 'false',
          'aria-controls': bodyId,
          'data-chem-id': chem.id
        },
        [
          createElement('div', { class: 'card__title-group' }, [
            createElement('div', { class: 'card__title' }, [chem.nameEn]),
            createElement('div', { class: 'card__description' }, [chem.nameAr]),
            createElement('div', { class: 'card__subtitle' }, [chem.desc])
          ]),
          createElement('span', { class: 'card__chevron', 'aria-hidden': 'true' }, ['▾'])
        ]
      ),
      createElement(
        'button',
        {
          class: `btn btn--icon btn--ghost${isFavorite ? ' btn--primary' : ''}`,
          type: 'button',
          'data-action': 'favorite',
          'data-chem-id': chem.id,
          'aria-pressed': isFavorite ? 'true' : 'false',
          'aria-label': isFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة'
        },
        [isFavorite ? '★' : '☆']
      )
    ])
  );

  card.appendChild(buildCardBody(chem, bodyId, isExpanded, dangerVariant));
  return card;
}

/**
 * يبني الجسم القابل للطي لبطاقة المادة الكيميائية بكل الأقسام التفصيلية.
 * @param {import('./data.js').Chemical} chem
 * @param {string} bodyId
 * @param {boolean} isExpanded
 * @param {string} dangerVariant
 * @returns {HTMLElement}
 */
function buildCardBody(chem, bodyId, isExpanded, dangerVariant) {
  const relatedChemicals = chemicals
    .filter((c) => c.id !== chem.id && c.category.some((cat) => chem.category.includes(cat)))
    .slice(0, 4);

  const bodyInner = createElement('div', { class: 'card__body-inner' }, [
    createElement('div', { class: 'status-pill' }, [
      createElement('span', { class: `status-pill__dot status-pill__dot--${dangerVariant}` }),
      `مستوى الخطورة: ${getDangerLabel(chem.danger)}`
    ]),

    createElement('div', { class: 'card__section' }, [
      createElement('div', { class: 'card__section-label' }, ['الاستخدام']),
      createElement('div', { class: 'card__section-value' }, [chem.usage])
    ]),

    createElement('div', { class: 'card__section card__section--full' }, [
      createElement('div', { class: 'card__section-label' }, ['التخفيف']),
      createElement('div', { class: 'chem-card__dilution-box' }, [
        createElement('span', { 'aria-hidden': 'true' }, ['🧪']),
        createElement('div', {}, [
          createElement('div', { class: 'chem-card__dilution-ratio' }, [chem.dilution]),
          createElement('div', { style: 'font-size:12px;color:var(--content-muted);margin-top:2px' }, [chem.dilutionNote])
        ])
      ])
    ]),

    createElement('div', { class: 'card__section card__section--full' }, [
      createElement('div', { class: 'card__section-label' }, ['معدات الحماية المطلوبة (PPE)']),
      createElement(
        'div',
        { class: 'chem-card__ppe-row' },
        chem.ppe.map((item) =>
          createElement('span', { class: 'chem-card__ppe-item' }, [`${item.icon} ${item.label}`])
        )
      )
    ]),

    createElement('div', { class: 'card__section card__section--full' }, [
      createElement('div', { class: 'card__section-label' }, ['الإسعافات الأولية']),
      createElement(
        'div',
        { class: 'u-flex-col u-gap-2' },
        chem.firstAid.map((item) =>
          createElement('div', { class: 'chem-card__firstaid-item' }, [
            createElement('span', { 'aria-hidden': 'true' }, [item.icon]),
            createElement('span', {}, [item.text])
          ])
        )
      )
    ]),

    createElement('div', { class: 'card__section' }, [
      createElement('div', { class: 'card__section-label' }, ['التخزين']),
      createElement('div', { class: 'card__section-value' }, [chem.storage])
    ]),

    createElement('div', { class: 'card__section' }, [
      createElement('div', { class: 'card__section-label' }, ['تحذير']),
      createElement('div', { class: 'card__section-value', style: 'color:var(--status-danger)' }, [chem.hazard])
    ]),

    createElement('div', { class: 'card__actions card__section--full' }, [
      createElement(
        'button',
        { class: 'btn btn--sm btn--ghost', type: 'button', 'data-action': 'copy', 'data-chem-id': chem.id },
        ['📋 نسخ التفاصيل']
      )
    ])
  ]);

  if (relatedChemicals.length > 0) {
    bodyInner.appendChild(
      createElement('div', { class: 'card__section card__section--full' }, [
        createElement('div', { class: 'card__section-label' }, ['مواد ذات صلة']),
        createElement(
          'div',
          { class: 'chem-card__related' },
          relatedChemicals.map((rel) =>
            createElement(
              'button',
              { class: 'chip', type: 'button', 'data-action': 'open-related', 'data-chem-id': rel.id },
              [rel.nameEn]
            )
          )
        )
      ])
    );
  }

  return createElement(
    'div',
    { class: 'card__body', id: bodyId, 'data-open': isExpanded ? 'true' : 'false' },
    [bodyInner]
  );
}

/**
 * يعالج نقر زر توسيع/طي بطاقة: يُحدّث الحالة المحلية للبطاقات المفتوحة،
 * يُسجّل المادة في "شوهد مؤخراً"، ويُحدّث الـ DOM مباشرة (بدون إعادة بناء
 * القائمة بالكامل، لتفادي فقدان موضع التمرير).
 * @param {HTMLElement} toggleBtn
 * @returns {void}
 */
function handleCardToggle(toggleBtn) {
  const chemId = Number(toggleBtn.dataset.chemId);
  const card = toggleBtn.closest('.card');
  const body = card.querySelector('.card__body');
  const willExpand = !expandedCardIds.has(chemId);

  const nowExpanded = toggleExpandable(toggleBtn, body, willExpand);

  if (nowExpanded) {
    expandedCardIds.add(chemId);
    recordRecentChemical(chemId);
  } else {
    expandedCardIds.delete(chemId);
  }

  card.classList.toggle('card--expanded', nowExpanded);
}

/**
 * يعالج نقر زر المفضلة: يُبدّل الحالة في state.js ويُحدّث مظهر الزر فوراً.
 * @param {HTMLElement} favoriteBtn
 * @returns {void}
 */
function handleFavoriteClick(favoriteBtn) {
  const chemId = Number(favoriteBtn.dataset.chemId);
  const isNowFavorite = toggleFavoriteChemical(chemId);

  favoriteBtn.setAttribute('aria-pressed', String(isNowFavorite));
  favoriteBtn.setAttribute('aria-label', isNowFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة');
  favoriteBtn.textContent = isNowFavorite ? '★' : '☆';
  favoriteBtn.classList.toggle('btn--primary', isNowFavorite);

  showToast(isNowFavorite ? 'أُضيفت للمفضلة' : 'أُزيلت من المفضلة', 'success');
}

/**
 * يعالج نقر زر "نسخ التفاصيل": يُنسّق كل بيانات المادة كنص عادي ويضعه
 * في الحافظة، مفيد لمشاركة المعلومات سريعاً عبر واتساب مع الزملاء.
 * @param {HTMLElement} copyBtn
 * @returns {Promise<void>}
 */
async function handleCopyClick(copyBtn) {
  const chemId = Number(copyBtn.dataset.chemId);
  const chem = chemicals.find((c) => c.id === chemId);
  if (!chem) return;

  const text = [
    `${chem.nameAr} / ${chem.nameEn}`,
    `الاستخدام: ${chem.usage}`,
    `التخفيف: ${chem.dilution}`,
    `الخطورة: ${getDangerLabel(chem.danger)}`,
    `التحذير: ${chem.hazard}`,
    `التخزين: ${chem.storage}`
  ].join('\n');

  const success = await copyToClipboard(text);
  showToast(success ? 'تم نسخ التفاصيل' : 'تعذّر النسخ', success ? 'success' : 'error');
}

/**
 * يفتح بطاقة مادة كيميائية معيّنة برمجياً (تُستخدم من "مواد ذات صلة" ومن
 * البحث الشامل في لوحة التحكم)، مع التمرير التلقائي لموضعها.
 * @param {number} chemId
 * @returns {void}
 */
export function openChemicalById(chemId) {
  expandedCardIds.add(chemId);
  activeCategory = 'all';
  searchQuery = '';
  if (rootEl) {
    rootEl.querySelector('#chemSearchInput').value = '';
    renderList();
    requestAnimationFrame(() => {
      const card = rootEl.querySelector(`[data-chem-id="${chemId}"]`);
      card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}

registerView('chemicals', {
  onEnter: () => init()
});
