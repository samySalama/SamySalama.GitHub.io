/**
 * ============================================================================
 * chemicals.js — عرض المواد الكيميائية
 * ============================================================================
 * مسؤولية واحدة: عرض قاعدة بيانات المواد، البحث والفلترة، وبطاقات قابلة
 * للتوسيع بكامل التفاصيل. يستخدم تفويض الأحداث (مستمع واحد على الجذر).
 *
 * v2.2: روابط عميقة (#chemicals?open=7) + زر «مشاركة» لكل مادة
 * (Web Share API مع نسخ الرابط كبديل).
 * ============================================================================
 */

import { chemicals, categoryMeta } from './data.js';
import { getState, toggleFavoriteChemical, recordRecentChemical } from './state.js';
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
import { getDilutionSpec, describeDilution } from './dilution.js';
import { chemicalMeta, reviewStatus, isSafeSdsUrl } from './chemical-meta.js';
import { isFuzzyMatch } from './fuzzy.js';

let searchQuery = '';
let activeCategory = 'all';
const expandedCardIds = new Set();

let rootEl = null;

/** يبني رابطاً عميقاً لمادة معيّنة. */
export function getChemicalUrl(chemId) {
  return `${location.origin}${location.pathname}#chemicals?open=${chemId}`;
}

/** يُهيّئ العرض: الهيكل الثابت مرة واحدة ثم تفويض الأحداث. */
function init() {
  rootEl = document.querySelector('[data-view="chemicals"]');
  if (!rootEl || rootEl.dataset.initialized === 'true') return;
  rootEl.dataset.initialized = 'true';

  rootEl.innerHTML = '';
  rootEl.appendChild(createElement('h1', { class: 'u-visually-hidden' }, ['المواد الكيميائية']));
  rootEl.appendChild(buildToolbar());
  rootEl.appendChild(createElement('div', { class: 'stats-bar', id: 'chemStatsBar', role: 'status' }));
  rootEl.appendChild(createElement('div', { class: 'cards-list', id: 'chemCardsList' }));

  bindDelegatedEvents();
  renderList();
}

/** شريط الأدوات: مربع البحث وشرائح الفئات. */
function buildToolbar() {
  const searchInput = createElement('input', {
    type: 'search',
    class: 'field__input field__input--with-icon',
    id: 'chemSearchInput',
    name: 'chemical-search',
    autocomplete: 'off',
    placeholder: 'ابحث عن مادة، استخدام، أو خطر…',
    'aria-label': 'بحث في المواد الكيميائية'
  });

  const filterChips = Object.entries(categoryMeta).map(([key, meta]) =>
    createElement(
      'button',
      { class: 'chip', type: 'button', 'data-category': key, 'aria-pressed': key === activeCategory ? 'true' : 'false' },
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

/** يسجّل كل مستمعي الأحداث عبر تفويض واحد على الجذر. */
function bindDelegatedEvents() {
  const searchInput = rootEl.querySelector('#chemSearchInput');
  searchInput.addEventListener(
    'input',
    debounce((e) => {
      searchQuery = e.target.value;
      renderList();
    }, 180)
  );

  rootEl.addEventListener('input', (e) => {
    const calcInput = e.target.closest('[data-calc-liters]');
    if (!calcInput) return;
    const id = Number(calcInput.dataset.calcLiters);
    const out = rootEl.querySelector(`[data-calc-result="${id}"]`);
    if (out) out.textContent = describeDilution(id, calcInput.value);
  });

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

    const shareBtn = e.target.closest('[data-action="share"]');
    if (shareBtn) {
      handleShareClick(shareBtn);
      return;
    }

    const relatedBtn = e.target.closest('[data-action="open-related"]');
    if (relatedBtn) {
      openChemicalById(Number(relatedBtn.dataset.chemId));
    }
  });
}

/** يرشّح المواد حسب نص البحث والفئة النشطة معاً. */
function getFilteredChemicals() {
  const normalizedQuery = normalizeText(searchQuery);
  return chemicals.filter((chem) => {
    const matchesCategory = activeCategory === 'all' || chem.category.includes(activeCategory);
    if (!matchesCategory) return false;
    if (!normalizedQuery) return true;

    const haystack = normalizeText([chem.nameAr, chem.nameEn, chem.desc, chem.usage, chem.hazard].join(' '));
    return haystack.includes(normalizedQuery);
  });
}

/** بحث تقريبي (أخطاء إملائية) على أسماء المواد — يُستخدم فقط عند غياب أي نتيجة دقيقة. */
function getFuzzyChemicals() {
  const words = normalizeText(searchQuery).split(' ').filter((w) => w.length >= 4);
  if (!words.length) return [];
  return chemicals.filter((chem) => {
    if (activeCategory !== 'all' && !chem.category.includes(activeCategory)) return false;
    const nameWords = normalizeText(`${chem.nameAr} ${chem.nameEn}`).split(/[^a-z0-9\u0600-\u06FF]+/).filter(Boolean);
    return words.every((w) => nameWords.some((n) => isFuzzyMatch(w, n)));
  });
}

/** يعيد بناء قائمة البطاقات ويحدّث شريط الإحصائيات. */
function renderList() {
  let filtered = getFilteredChemicals();
  if (filtered.length === 0 && searchQuery.trim()) filtered = getFuzzyChemicals();
  const listEl = rootEl.querySelector('#chemCardsList');
  const statsEl = rootEl.querySelector('#chemStatsBar');

  statsEl.textContent = `${filtered.length} من ${chemicals.length} مادة`;

  listEl.innerHTML = '';
  if (filtered.length === 0) {
    listEl.appendChild(buildEmptyState());
    return;
  }

  const favorites = getState('favoriteChemicalIds');
  filtered.forEach((chem) => listEl.appendChild(buildChemicalCard(chem, favorites.includes(chem.id))));
}

/** حالة «لا نتائج». */
function buildEmptyState() {
  return createElement('div', { class: 'empty-state' }, [
    createElement('div', { class: 'empty-state__icon', 'aria-hidden': 'true' }, ['🔍']),
    createElement('div', {}, ['لا توجد نتائج مطابقة']),
    createElement('div', { class: 'u-visually-hidden' }, ['جرّب كلمة بحث أخرى أو غيّر الفئة المختارة'])
  ]);
}

/** يبني بطاقة مادة كاملة (رأس قابل للطي + جسم بالتفاصيل). */
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
            createElement('div', { class: 'card__title', translate: 'no' }, [chem.nameEn]),
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

/** يبني الجسم القابل للطي بكل الأقسام التفصيلية. */
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
        chem.ppe.map((item) => createElement('span', { class: 'chem-card__ppe-item' }, [`${item.icon} ${item.label}`]))
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

    ...buildDilutionCalculator(chem),

    buildReviewSection(chem),

    createElement('div', { class: 'card__actions card__section--full' }, [
      createElement(
        'button',
        { class: 'btn btn--sm btn--ghost', type: 'button', 'data-action': 'copy', 'data-chem-id': chem.id },
        ['📋 نسخ التفاصيل']
      ),
      createElement(
        'button',
        { class: 'btn btn--sm btn--ghost', type: 'button', 'data-action': 'share', 'data-chem-id': chem.id },
        ['🔗 مشاركة']
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
            createElement('button', { class: 'chip', type: 'button', 'data-action': 'open-related', 'data-chem-id': rel.id }, [rel.nameEn])
          )
        )
      ])
    );
  }

  return createElement('div', { class: 'card__body', id: bodyId, 'data-open': isExpanded ? 'true' : 'false' }, [bodyInner]);
}


/** حاسبة التخفيف للمواد ذات التخفيف اليدوي بمل/لتر (إن وُجدت مواصفتها). */
function buildDilutionCalculator(chem) {
  const spec = getDilutionSpec(chem.id);
  if (!spec) return [];
  return [
    createElement('div', { class: 'card__section card__section--full' }, [
      createElement('div', { class: 'card__section-label' }, ['حاسبة التخفيف (تقدير)']),
      createElement('div', { class: 'dilution-calc' }, [
        createElement('label', { class: 'dilution-calc__field' }, [
          'كمية المحلول المطلوب تحضيرها (لتر)',
          createElement('input', {
            type: 'text',
            inputmode: 'decimal',
            class: 'field__input',
            name: `liters-${chem.id}`,
            autocomplete: 'off',
            'data-calc-liters': chem.id
          })
        ]),
        createElement('output', { class: 'dilution-calc__result', 'data-calc-result': chem.id, 'aria-live': 'polite' }, [
          describeDilution(chem.id, '')
        ]),
        createElement('div', { class: 'dilution-calc__note' }, [`المصدر: ${spec.source}. تقدير حسابي — الأولوية لملصق المنتج وتعليمات المشرف.`])
      ])
    ])
  ];
}

/** حالة مراجعة المادة مع رابط صحيفة SDS (حوكمة المحتوى). */
function buildReviewSection(chem) {
  const meta = chemicalMeta[chem.id];
  const status = reviewStatus(meta);
  const children = [createElement('span', { class: `badge review-badge review-badge--${status.state}` }, [status.label])];
  if (isSafeSdsUrl(meta?.sdsUrl)) {
    children.push(
      createElement('a', { href: meta.sdsUrl, target: '_blank', rel: 'noopener noreferrer', class: 'review-sds-link' }, ['📄 صحيفة SDS'])
    );
  }
  return createElement('div', { class: 'card__section card__section--full chem-card__review' }, children);
}

/** توسيع/طي بطاقة مع تسجيلها في «شوهد مؤخراً» دون إعادة بناء القائمة. */
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

/** تبديل المفضلة وتحديث مظهر الزر فوراً. */
function handleFavoriteClick(favoriteBtn) {
  const chemId = Number(favoriteBtn.dataset.chemId);
  const isNowFavorite = toggleFavoriteChemical(chemId);

  favoriteBtn.setAttribute('aria-pressed', String(isNowFavorite));
  favoriteBtn.setAttribute('aria-label', isNowFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة');
  favoriteBtn.textContent = isNowFavorite ? '★' : '☆';
  favoriteBtn.classList.toggle('btn--primary', isNowFavorite);

  showToast(isNowFavorite ? 'أُضيفت للمفضلة' : 'أُزيلت من المفضلة', 'success');
}

/** نسخ تفاصيل المادة كنص عادي (للمشاركة السريعة عبر واتساب). */
async function handleCopyClick(copyBtn) {
  const chem = chemicals.find((c) => c.id === Number(copyBtn.dataset.chemId));
  if (!chem) return;

  const text = [
    `${chem.nameAr} / ${chem.nameEn}`,
    `الاستخدام: ${chem.usage}`,
    `التخفيف: ${chem.dilution}`,
    `الخطورة: ${getDangerLabel(chem.danger)}`,
    `التحذير: ${chem.hazard}`,
    `التخزين: ${chem.storage}`,
    getChemicalUrl(chem.id)
  ].join('\n');

  const success = await copyToClipboard(text);
  showToast(success ? 'تم نسخ التفاصيل' : 'تعذّر النسخ', success ? 'success' : 'error');
}

/** مشاركة رابط المادة: قائمة المشاركة الأصلية للجهاز، أو نسخ الرابط كبديل. */
async function handleShareClick(shareBtn) {
  const chem = chemicals.find((c) => c.id === Number(shareBtn.dataset.chemId));
  if (!chem) return;

  const data = {
    title: `${chem.nameEn} — ${chem.nameAr}`,
    text: `${chem.nameAr}: ${chem.hazard}`,
    url: getChemicalUrl(chem.id)
  };

  if (navigator.share) {
    try {
      await navigator.share(data);
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }

  const success = await copyToClipboard(data.url);
  showToast(success ? 'تم نسخ رابط المادة' : 'تعذّر النسخ', success ? 'success' : 'error');
}

/**
 * يفتح بطاقة مادة برمجياً ويمرّر إليها.
 * @param {number} chemId
 * @returns {void}
 */
export function openChemicalById(chemId) {
  if (!chemicals.some((c) => c.id === chemId)) return;
  expandedCardIds.add(chemId);
  activeCategory = 'all';
  searchQuery = '';
  if (rootEl) {
    rootEl.querySelector('#chemSearchInput').value = '';
    rootEl.querySelectorAll('[data-category]').forEach((btn) => {
      btn.setAttribute('aria-pressed', btn.dataset.category === 'all' ? 'true' : 'false');
    });
    renderList();
    requestAnimationFrame(() => {
      rootEl.querySelector(`.card[data-chem-id="${chemId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}

registerView('chemicals', {
  onEnter: (params) => {
    init();
    const openId = Number(params?.get('open'));
    if (openId) openChemicalById(openId);
  }
});
