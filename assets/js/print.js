/**
 * ============================================================================
 * print.js — المطبوعات: ملصق التخفيف، ملصق سلامة الغذاء، شهادة الإكمال
 * ============================================================================
 * مسؤولية واحدة: توليد مستندات A4 جاهزة للطباعة من بيانات data.js ومن تقدّم
 * المستخدم. الطباعة عبر window.print() مع أنماط @media print في extras.css
 * (تُخفي كل شيء عدا .print-sheet، بألوان ثابتة لا تتأثر بالمظهر الداكن).
 *
 * الشهادة سجلّ داخلي ذاتي، ونصها يقول ذلك صراحة — ليست اعتماداً رسمياً.
 * ============================================================================
 */

import { chemicals, educationModules } from './data.js';
import { getState, setLearnerName } from './state.js';
import { getDangerLabel, createElement, showToast } from './utils.js';
import { registerView } from './router.js';

let rootEl = null;
let activeDoc = 'dilution';
let sheetHost = null;

const DOCS = [
  { id: 'dilution', label: '🧪 ملصق التخفيف و PPE' },
  { id: 'foodsafety', label: '🥗 ملصق سلامة الغذاء' },
  { id: 'certificate', label: '🎓 شهادة الإكمال' }
];

function init() {
  rootEl = document.querySelector('[data-view="print"]');
  if (!rootEl) return;

  if (rootEl.dataset.initialized !== 'true') {
    rootEl.dataset.initialized = 'true';
    rootEl.innerHTML = '';
    rootEl.appendChild(
      createElement('div', { class: 'view-header', 'data-no-print': '' }, [
        createElement('div', { class: 'view-header__eyebrow' }, ['المطبوعات']),
        createElement('h1', { class: 'view-header__title' }, ['مستندات جاهزة للطباعة'])
      ])
    );
    rootEl.appendChild(
      createElement(
        'div',
        { class: 'print-tabs', role: 'group', 'aria-label': 'اختيار المستند', 'data-no-print': '' },
        DOCS.map((d) => createElement('button', { class: 'chip', type: 'button', 'data-doc': d.id, 'aria-pressed': d.id === activeDoc ? 'true' : 'false' }, [d.label]))
      )
    );
    sheetHost = createElement('div', { class: 'print-host' });
    rootEl.appendChild(sheetHost);
    rootEl.addEventListener('click', onClick);
    rootEl.addEventListener('input', onInput);
  }
  renderDoc();
}

function onClick(e) {
  const tab = e.target.closest('[data-doc]');
  if (tab) {
    activeDoc = tab.dataset.doc;
    rootEl.querySelectorAll('[data-doc]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.doc === activeDoc ? 'true' : 'false'));
    renderDoc();
    return;
  }
  const printBtn = e.target.closest('#printNowBtn');
  if (printBtn && !printBtn.disabled) window.print();
}

function onInput(e) {
  if (e.target.id !== 'learnerNameInput') return;
  setLearnerName(e.target.value);
  const nameEl = rootEl.querySelector('#certName');
  if (nameEl) nameEl.textContent = getState('learnerName') || '................................';
  updatePrintButton();
}

function certificateEligibility() {
  const completed = getState('completedModuleIds').filter((id) => educationModules.some((m) => m.id === id));
  return {
    completed: completed.length,
    total: educationModules.length,
    hasName: getState('learnerName').length > 0
  };
}

function updatePrintButton() {
  const btn = rootEl.querySelector('#printNowBtn');
  if (!btn || activeDoc !== 'certificate') return;
  const { completed, total, hasName } = certificateEligibility();
  btn.disabled = !(hasName && completed === total);
}

function renderDoc() {
  sheetHost.innerHTML = '';
  const builders = { dilution: buildDilutionSheet, foodsafety: buildFoodSafetySheet, certificate: buildCertificateSheet };
  sheetHost.appendChild(builders[activeDoc]());
  updatePrintButton();
}

const printButton = (disabled = false) =>
  createElement('button', { class: 'btn btn--primary', type: 'button', id: 'printNowBtn', 'data-no-print': '', ...(disabled ? { disabled: 'true' } : {}) }, ['🖨️ طباعة'])

function todayAr() {
  return new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());
}

/* ------------------------------ ملصق التخفيف ------------------------------ */

function buildDilutionSheet() {
  const rows = chemicals.map((c) =>
    createElement('tr', {}, [
      createElement('th', { scope: 'row' }, [createElement('div', {}, [c.nameAr]), createElement('div', { class: 'print-sheet__en', translate: 'no' }, [c.nameEn])]),
      createElement('td', { class: 'print-sheet__ltr' }, [c.dilution]),
      createElement('td', {}, [c.ppe.map((p) => p.icon).join(' ')]),
      createElement('td', { class: `print-sheet__danger print-sheet__danger--${c.danger}` }, [getDangerLabel(c.danger)])
    ])
  );

  return createElement('div', {}, [
    printButton(),
    createElement('article', { class: 'print-sheet' }, [
      createElement('h2', { class: 'print-sheet__title' }, ['جدول التخفيف ومعدات الحماية — قسم الاستيوارد']),
      createElement('table', { class: 'print-sheet__table' }, [
        createElement('thead', {}, [
          createElement('tr', {}, ['المادة', 'التخفيف', 'PPE', 'الخطورة'].map((h) => createElement('th', { scope: 'col' }, [h])))
        ]),
        createElement('tbody', {}, rows)
      ]),
      createElement('p', { class: 'print-sheet__foot' }, [
        '⛔ ممنوع خلط أي مادتين كيميائيتين. المواد المحقونة تلقائياً لا تُخفف يدوياً. المرجع الأول دائماً ملصق المنتج وصحيفة SDS وتعليمات المشرف.'
      ])
    ])
  ]);
}

/* --------------------------- ملصق سلامة الغذاء --------------------------- */

function buildFoodSafetySheet() {
  const rules = educationModules.find((m) => m.id === 'golden-rules');
  const boards = [...rules.cuttingBoards, { color: 'purple', name: 'بنفسجي', use: 'ضيوف الحساسية فقط' }];

  return createElement('div', {}, [
    printButton(),
    createElement('article', { class: 'print-sheet' }, [
      createElement('h2', { class: 'print-sheet__title' }, ['سلامة الغذاء — مرجع سريع']),
      createElement('h3', { class: 'print-sheet__sub' }, ['الألواح والسكاكين الملونة']),
      createElement(
        'div',
        { class: 'print-sheet__boards' },
        boards.map((b) =>
          createElement('div', { class: 'print-sheet__board' }, [
            createElement('span', { class: 'print-sheet__swatch', style: `background:${b.color}`, 'aria-hidden': 'true' }),
            createElement('div', {}, [createElement('strong', {}, [b.name]), ` — ${b.use}`])
          ])
        )
      ),
      createElement('h3', { class: 'print-sheet__sub' }, ['درجات الحرارة الآمنة']),
      createElement(
        'ul',
        { class: 'print-sheet__list' },
        rules.tempQuick.map((t) => createElement('li', {}, [`${t.icon} ${t.label}: `, createElement('strong', {}, [t.value])]))
      ),
      createElement('h3', { class: 'print-sheet__sub' }, ['ترتيب الثلاجة (من الأعلى للأسفل)']),
      createElement(
        'ol',
        { class: 'print-sheet__list' },
        rules.fridgeOrder.map((t) => createElement('li', {}, [`${t.icon} ${t.label} — ${t.note}`]))
      ),
      createElement('h3', { class: 'print-sheet__sub' }, ['غسل اليدين']),
      createElement('p', {}, [rules.rules.find((r) => r.n === 1).desc])
    ])
  ]);
}

/* ------------------------------ شهادة الإكمال ------------------------------ */

function buildCertificateSheet() {
  const { completed, total, hasName } = certificateEligibility();
  const scores = getState('quizScores');
  const name = getState('learnerName');
  const ready = completed === total;

  const status = ready
    ? null
    : createElement('div', { class: 'alert-box alert-box--warning', 'data-no-print': '' }, [
        createElement('span', { 'aria-hidden': 'true' }, ['🔒']),
        createElement('div', {}, [`أكملت ${completed} من ${total} وحدة. اجتز اختبار كل وحدة في الأكاديمية لتفتح الطباعة.`])
      ]);

  return createElement('div', {}, [
    createElement('label', { class: 'print-name', 'data-no-print': '' }, [
      'الاسم على الشهادة',
      createElement('input', { class: 'field__input', id: 'learnerNameInput', name: 'learner-name', type: 'text', maxlength: '60', autocomplete: 'name', value: name })
    ]),
    status ?? '',
    printButton(!(ready && hasName)),
    createElement('article', { class: 'print-sheet print-sheet--certificate' }, [
      createElement('div', { class: 'print-sheet__kicker' }, ['دليل الاستيوارد — Marriott']),
      createElement('h2', { class: 'print-sheet__title' }, ['شهادة إكمال أكاديمية سلامة الغذاء']),
      createElement('p', {}, ['تُفيد هذه الشهادة بأن']),
      createElement('div', { class: 'print-sheet__name', id: 'certName' }, [name || '................................']),
      createElement('p', {}, [`أتمّ/ت ${completed} من ${total} وحدات تعليمية باجتياز اختبار كل وحدة بتاريخ ${todayAr()}.`]),
      createElement(
        'ul',
        { class: 'print-sheet__modules' },
        educationModules.map((m) => {
          const s = scores[m.id];
          return createElement('li', {}, [`${m.title}${s ? ` — ${s.score}/${s.total}` : ''}`]);
        })
      ),
      createElement('p', { class: 'print-sheet__foot' }, [
        'سجلّ تدريب داخلي ذاتي التقييم يُولَّد من التطبيق، وليس شهادة معتمدة رسمياً؛ ولا يُغني عن التدريب والتوثيق الرسمي لدى إدارة التدريب.'
      ])
    ])
  ]);
}

registerView('print', {
  onEnter: () => {
    init();
    showToastOnce();
  }
});

let hinted = false;
function showToastOnce() {
  if (hinted) return;
  hinted = true;
  showToast('اختر المستند ثم اضغط «طباعة»', 'default', 2200);
}
