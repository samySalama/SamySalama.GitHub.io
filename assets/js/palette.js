/**
 * palette.js — v2.5: لوحة البحث الشامل (Ctrl/⌘+K أو زر 🔍). تبحث في الصفحات والمواد ووحدات التعليم.
 * مستقلة: تعتمد على data.js و router.js و palette-search.js فقط.
 */
import { chemicals, educationModules } from './data.js';
import { navigateTo } from './router.js';
import { norm, searchItems } from './palette-search.js';

const PAGES = [['dashboard', '🏠', 'الرئيسية'], ['chemicals', '🧪', 'المواد الكيميائية'], ['education', '📚', 'أكاديمية التعليم'],
  ['safety', '🚨', 'السلامة والطوارئ'], ['logs', '📝', 'السجلات التشغيلية'], ['print', '🖨️', 'المطبوعات'], ['ai', '🤖', 'المساعد الذكي'], ['settings', '⚙️', 'الإعدادات']];
const DANGER = { low: '🟢', med: '🟡', high: '🔴' };

const items = [
  ...PAGES.map(([view, icon, title]) => ({ kind: 'page', icon, title, sub: 'صفحة', hay: norm(title), view })),
  ...chemicals.map((c) => ({ kind: 'chem', icon: DANGER[c.danger] ?? '🧪', title: c.nameAr, sub: `${c.nameEn} — ${c.desc}`, hay: norm([c.nameAr, c.nameEn, c.desc, c.usage, c.hazard].join(' ')), view: 'chemicals', params: { open: String(c.id) } })),
  ...educationModules.map((m) => ({ kind: 'edu', icon: m.icon ?? '📚', title: m.title, sub: 'أكاديمية التعليم', hay: norm(m.title), view: 'education' }))
];

let root, input, list, results = [], active = 0, lastFocus = null;

const el = (tag, props = {}, kids = []) => { const n = Object.assign(document.createElement(tag), props); kids.forEach((k) => n.append(k)); return n; };

function paint() {
  list.replaceChildren(...(results.length ? results.map((r, i) => {
    const row = el('li', { className: 'pal__item', role: 'option', id: `pal-${i}` }, [
      el('span', { className: 'pal__icon', textContent: r.icon, ariaHidden: 'true' }),
      el('span', { className: 'pal__text' }, [el('strong', { textContent: r.title }), el('small', { textContent: r.sub })])
    ]);
    row.setAttribute('aria-selected', String(i === active));
    row.onclick = () => go(r);
    return row;
  }) : [el('li', { className: 'pal__empty', textContent: 'لا نتائج — جرّب كلمة أخرى' })]));
  input.setAttribute('aria-activedescendant', results.length ? `pal-${active}` : '');
  list.children[active]?.scrollIntoView?.({ block: 'nearest' });
}

function update() { results = searchItems(items, input.value); active = 0; paint(); }

function go(r) {
  close();
  if (r.params) navigateTo(r.view, r.params); else navigateTo(r.view);
}

function open() {
  lastFocus = document.activeElement;
  root.dataset.open = 'true'; input.value = ''; update(); input.focus();
}
function close() { root.dataset.open = 'false'; lastFocus?.focus?.(); }

function build() {
  input = el('input', { type: 'search', placeholder: 'ابحث عن مادة أو صفحة أو وحدة…', autocomplete: 'off', ariaLabel: 'بحث شامل' });
  input.setAttribute('role', 'combobox'); input.setAttribute('aria-controls', 'palList'); input.setAttribute('aria-expanded', 'true');
  list = el('ul', { id: 'palList', className: 'pal__list', role: 'listbox' });
  const panel = el('div', { className: 'pal__panel', role: 'dialog', ariaModal: 'true', ariaLabel: 'البحث الشامل' }, [input, list,
    el('div', { className: 'pal__hint', textContent: '↑↓ تنقّل · Enter فتح · Esc إغلاق' })]);
  root = el('div', { className: 'pal', onclick: (e) => { if (e.target === root) close(); } }, [panel]);
  root.dataset.open = 'false';
  document.body.append(root);
  input.addEventListener('input', update);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, results.length - 1); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); paint(); }
    else if (e.key === 'Enter' && results[active]) { e.preventDefault(); go(results[active]); }
  });
  const row = document.querySelector('.site-header__row');
  if (row) { let box = row.querySelector('.hdr-actions'); if (!box) { box = el('div', { className: 'hdr-actions' }); row.append(box); }
    box.prepend(el('button', { className: 'btn btn--ghost btn--icon', type: 'button', ariaLabel: 'بحث شامل', textContent: '🔍', onclick: open })); }
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); }
    else if (e.key === 'Escape' && root.dataset.open === 'true') close();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
