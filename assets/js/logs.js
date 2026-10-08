/**
 * ============================================================================
 * logs.js — السجلات التشغيلية: قوائم الوردية + سجل الحرارة (HACCP)
 * ============================================================================
 * مسؤولية واحدة: واجهة تحلّ محل الورق — قوائم تدقيق قابلة للتأشير (تُصفَّر
 * تلقائياً كل يوم)، وسجل حرارة بتقييم فوري مقابل الحد والإجراء التصحيحي،
 * مع تصدير CSV. كل شيء محلي على الجهاز (state.js).
 * ============================================================================
 */

import { checklists } from './checklists.js';
import { TEMP_KINDS, evaluateReading, parseTemperature, toCsv, formatDateTime, getTempKind } from './temperature.js';
import {
  getState,
  subscribe,
  localDateKey,
  toggleChecklistItem,
  resetChecklist,
  addTemperatureReading,
  deleteTemperatureReading,
  clearTemperatureLog
} from './state.js';
import { createElement, showToast } from './utils.js';
import { registerView } from './router.js';

let rootEl = null;
let activeTab = 'checklists';
let panelEl = null;

const TABS = [
  { id: 'checklists', label: '✅ قوائم الوردية' },
  { id: 'temps', label: '🌡️ سجل الحرارة' }
];

function init() {
  rootEl = document.querySelector('[data-view="logs"]');
  if (!rootEl) return;

  if (rootEl.dataset.initialized !== 'true') {
    rootEl.dataset.initialized = 'true';
    rootEl.innerHTML = '';
    rootEl.appendChild(
      createElement('div', { class: 'view-header' }, [
        createElement('div', { class: 'view-header__eyebrow' }, ['التشغيل']),
        createElement('h1', { class: 'view-header__title' }, ['السجلات التشغيلية'])
      ])
    );
    rootEl.appendChild(
      createElement(
        'div',
        { class: 'logs-tabs', role: 'group', 'aria-label': 'نوع السجل' },
        TABS.map((t) =>
          createElement('button', { class: 'chip', type: 'button', 'data-tab': t.id, 'aria-pressed': t.id === activeTab ? 'true' : 'false' }, [t.label])
        )
      )
    );
    panelEl = createElement('div', { class: 'logs-panel' });
    rootEl.appendChild(panelEl);
    bindEvents();
    subscribe((keys) => {
      if (!rootEl || rootEl.hidden) return;
      if (keys.includes('temperatureLog') && activeTab === 'temps') renderTempList();
    });
  }
  renderPanel();
}

function renderPanel() {
  panelEl.innerHTML = '';
  if (activeTab === 'checklists') panelEl.appendChild(buildChecklistsTab());
  else panelEl.appendChild(buildTempsTab());
}

/* ============================ قوائم الوردية ============================ */

function buildChecklistsTab() {
  const dateKey = localDateKey();
  const progress = getState('checklistProgress')[dateKey] ?? {};

  return createElement('div', { class: 'logs-section' }, [
    createElement('p', { class: 'logs-hint' }, [`قوائم اليوم (${dateKey}) — تُصفَّر تلقائياً غداً، وتُحفظ على جهازك فقط.`]),
    ...Object.entries(checklists).map(([listId, list]) => {
      const done = new Set(progress[listId] ?? []);
      return createElement('section', { class: 'check-card', 'data-list': listId, 'aria-labelledby': `check-title-${listId}` }, [
        createElement('div', { class: 'check-card__head' }, [
          createElement('h2', { class: 'check-card__title', id: `check-title-${listId}` }, [list.title]),
          createElement('span', { class: 'badge badge--brand', 'data-progress': listId }, [`${done.size}/${list.items.length}`])
        ]),
        createElement(
          'ul',
          { class: 'check-card__items' },
          list.items.map((text, index) =>
            createElement('li', {}, [
              createElement('label', { class: 'check-item' }, [
                createElement('input', {
                  type: 'checkbox',
                  class: 'check-item__box',
                  'data-list-id': listId,
                  'data-index': index,
                  ...(done.has(index) ? { checked: 'true' } : {})
                }),
                createElement('span', {}, [text])
              ])
            ])
          )
        ),
        createElement('button', { class: 'btn btn--sm btn--ghost', type: 'button', 'data-reset-list': listId }, ['↺ تصفير القائمة'])
      ]);
    })
  ]);
}

/* ============================== سجل الحرارة ============================== */

function buildTempsTab() {
  const recentPoints = [...new Set(getState('temperatureLog').map((r) => r.point))].slice(0, 12);

  const kindSelect = createElement(
    'select',
    { class: 'field__input', id: 'tempKind', name: 'kind' },
    TEMP_KINDS.map((k) => createElement('option', { value: k.id }, [k.label]))
  );

  return createElement('div', { class: 'logs-section' }, [
    createElement('div', { class: 'temp-form' }, [
      createElement('label', { class: 'temp-form__field' }, ['النوع', kindSelect]),
      createElement('div', { class: 'temp-form__rule', id: 'tempRule', role: 'status' }, [`الحد: ${TEMP_KINDS[0].rule}`]),
      createElement('label', { class: 'temp-form__field' }, [
        'اسم النقطة',
        createElement('input', {
          class: 'field__input',
          id: 'tempPoint',
          name: 'point',
          type: 'text',
          list: 'tempPoints',
          autocomplete: 'off',
          placeholder: 'مثال: ثلاجة الخضار 1…',
          maxlength: '60'
        }),
        createElement('datalist', { id: 'tempPoints' }, recentPoints.map((p) => createElement('option', { value: p })))
      ]),
      createElement('label', { class: 'temp-form__field' }, [
        'الحرارة (°م)',
        createElement('input', { class: 'field__input', id: 'tempValue', name: 'temp', type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: 'مثال: 3.5 أو -18' })
      ]),
      createElement('label', { class: 'temp-form__field' }, [
        'ملاحظة (اختياري)',
        createElement('input', { class: 'field__input', id: 'tempNote', name: 'note', type: 'text', autocomplete: 'off', maxlength: '120' })
      ]),
      createElement('button', { class: 'btn btn--primary btn--full', type: 'button', id: 'tempSaveBtn' }, ['💾 حفظ القراءة']),
      createElement('div', { id: 'tempFeedback', role: 'alert' })
    ]),
    createElement('div', { class: 'logs-toolbar' }, [
      createElement('h2', { class: 'logs-subheading' }, ['آخر القراءات']),
      createElement('div', { class: 'logs-toolbar__actions' }, [
        createElement('button', { class: 'btn btn--sm', type: 'button', id: 'tempExportBtn' }, ['⬇️ تصدير CSV']),
        createElement('button', { class: 'btn btn--sm btn--danger', type: 'button', id: 'tempClearBtn' }, ['🗑️ مسح السجل'])
      ])
    ]),
    createElement('div', { id: 'tempList', class: 'temp-list' })
  ]);
}

function renderTempList() {
  const listEl = panelEl.querySelector('#tempList');
  if (!listEl) return;
  const log = getState('temperatureLog').slice(0, 30);
  listEl.innerHTML = '';

  if (log.length === 0) {
    listEl.appendChild(createElement('div', { class: 'empty-state' }, [createElement('div', {}, ['لا توجد قراءات بعد'])]));
    return;
  }

  log.forEach((r) => {
    const kind = getTempKind(r.kind);
    listEl.appendChild(
      createElement('div', { class: `temp-row temp-row--${r.ok ? 'ok' : 'bad'}` }, [
        createElement('div', { class: 'temp-row__main' }, [
          createElement('div', { class: 'temp-row__title' }, [`${r.point} — ${r.temp}°م`]),
          createElement('div', { class: 'temp-row__sub' }, [
            `${kind?.label ?? r.kind} · ${formatDateTime(new Date(r.ts))}${r.note ? ` · ${r.note}` : ''}`
          ])
        ]),
        createElement('span', { class: `badge ${r.ok ? 'badge--brand' : 'badge--danger'}` }, [r.ok ? 'ضمن الحد' : 'خارج الحد']),
        createElement('button', { class: 'btn btn--icon btn--ghost btn--sm', type: 'button', 'data-delete-reading': r.id, 'aria-label': `حذف قراءة ${r.point}` }, ['✕'])
      ])
    );
  });
}

function handleSaveReading() {
  const point = panelEl.querySelector('#tempPoint').value.trim();
  const kindId = panelEl.querySelector('#tempKind').value;
  const note = panelEl.querySelector('#tempNote').value.trim();
  const temp = parseTemperature(panelEl.querySelector('#tempValue').value);
  const feedback = panelEl.querySelector('#tempFeedback');
  feedback.innerHTML = '';

  if (!point) {
    showToast('اكتب اسم النقطة (مثل: ثلاجة 1)', 'error');
    panelEl.querySelector('#tempPoint').focus();
    return;
  }
  if (temp === null) {
    showToast('أدخل رقم حرارة صالحاً (مثال: 3.5 أو -18)', 'error');
    panelEl.querySelector('#tempValue').focus();
    return;
  }

  const { ok, kind } = evaluateReading(kindId, temp);
  addTemperatureReading({ point, kind: kindId, temp, ok, note });
  panelEl.querySelector('#tempValue').value = '';
  panelEl.querySelector('#tempNote').value = '';

  if (ok) {
    showToast('تم الحفظ — ضمن الحد ✅', 'success');
  } else {
    feedback.appendChild(
      createElement('div', { class: 'alert-box alert-box--danger' }, [
        createElement('span', { 'aria-hidden': 'true' }, ['⛔']),
        createElement('div', {}, [createElement('strong', {}, [`خارج الحد (${kind.rule}). `]), kind.action])
      ])
    );
  }
}

function handleExport() {
  const log = getState('temperatureLog');
  if (log.length === 0) {
    showToast('لا توجد قراءات للتصدير', 'error');
    return;
  }
  const blob = new Blob([toCsv(log)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = createElement('a', { href: url, download: `temperature-log-${localDateKey()}.csv` });
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast('تم تصدير السجل', 'success');
}

/* ================================ الأحداث ================================ */

function bindEvents() {
  rootEl.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      activeTab = tab.dataset.tab;
      rootEl.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.tab === activeTab ? 'true' : 'false'));
      renderPanel();
      if (activeTab === 'temps') renderTempList();
      return;
    }

    const resetBtn = e.target.closest('[data-reset-list]');
    if (resetBtn) {
      resetChecklist(resetBtn.dataset.resetList);
      renderPanel();
      return;
    }

    if (e.target.closest('#tempSaveBtn')) return handleSaveReading();
    if (e.target.closest('#tempExportBtn')) return handleExport();

    if (e.target.closest('#tempClearBtn')) {
      if (getState('temperatureLog').length && window.confirm('مسح كل قراءات الحرارة نهائياً؟ صدّرها أولاً إن لزم.')) {
        clearTemperatureLog();
        showToast('تم مسح السجل', 'success');
      }
      return;
    }

    const delBtn = e.target.closest('[data-delete-reading]');
    if (delBtn) deleteTemperatureReading(delBtn.dataset.deleteReading);
  });

  rootEl.addEventListener('change', (e) => {
    const box = e.target.closest('.check-item__box');
    if (box) {
      const listId = box.dataset.listId;
      toggleChecklistItem(listId, Number(box.dataset.index));
      const done = (getState('checklistProgress')[localDateKey()]?.[listId] ?? []).length;
      const badge = rootEl.querySelector(`[data-progress="${listId}"]`);
      if (badge) badge.textContent = `${done}/${checklists[listId].items.length}`;
      return;
    }

    if (e.target.id === 'tempKind') {
      const kind = getTempKind(e.target.value);
      rootEl.querySelector('#tempRule').textContent = `الحد: ${kind.rule}`;
    }
  });

  rootEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing && e.target.closest('.temp-form') && e.target.tagName === 'INPUT') {
      e.preventDefault();
      handleSaveReading();
    }
  });
}

registerView('logs', {
  onEnter: () => {
    init();
    if (activeTab === 'temps') renderTempList();
  }
});
