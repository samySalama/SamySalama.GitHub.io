/**
 * enhance.js — v2.4: أدوات الوردية (مؤقتات زمن التلامس، إبقاء الشاشة، اختصارات لوحة المفاتيح).
 * وحدة مستقلة: لا تعتمد إلا على router.js ولا تغيّر أي حالة في state.js.
 */
import { navigateTo } from './router.js';

const SS_KEY = 'stewardApp:timers';
const PRESETS = [['30 ث', 30], ['دقيقة', 60], ['دقيقتان', 120], ['5 د', 300], ['10 د', 600]];
const GO = { d: 'dashboard', c: 'chemicals', e: 'education', s: 'safety', l: 'logs', p: 'print', a: 'ai', t: 'settings' };

let timers = [];
let sheet, listEl, wakeBtn, wakeLock = null, tick = null, audioCtx = null;

const el = (tag, props = {}, kids = []) => {
  const n = Object.assign(document.createElement(tag), props);
  kids.forEach((k) => n.append(k));
  return n;
};
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const save = () => { try { sessionStorage.setItem(SS_KEY, JSON.stringify(timers)); } catch { /* ignore */ } };

function beep() {
  try {
    audioCtx ??= new AudioContext();
    [0, 0.3, 0.6].forEach((t) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.frequency.value = 880; g.gain.value = 0.15;
      o.connect(g).connect(audioCtx.destination);
      o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.2);
    });
  } catch { /* ignore */ }
  navigator.vibrate?.([300, 150, 300, 150, 300]);
}

function addTimer(seconds, label) {
  if (!(seconds > 0)) return;
  audioCtx ??= (() => { try { return new AudioContext(); } catch { return null; } })(); // يُفتح بإيماءة المستخدم
  timers.push({ id: Date.now() + Math.random(), label, end: Date.now() + seconds * 1000, done: false });
  save(); render(); ensureTick();
}

function ensureTick() {
  if (tick || !timers.length) return;
  tick = setInterval(() => {
    let fired = false;
    timers.forEach((t) => { if (!t.done && Date.now() >= t.end) { t.done = true; fired = true; } });
    if (fired) beep();
    render();
    if (!timers.length) { clearInterval(tick); tick = null; }
  }, 500);
}

function render() {
  if (!listEl) return;
  listEl.replaceChildren(...(timers.length ? timers.map((t) => {
    const left = Math.max(0, Math.ceil((t.end - Date.now()) / 1000));
    return el('div', { className: `tt${t.done ? ' tt--done' : ''}`, role: 'timer' }, [
      el('span', {}, [t.label]),
      el('span', { className: 'tt__time', textContent: t.done ? '00:00 ✔' : fmt(left) }),
      el('button', { className: 'btn btn--sm btn--ghost', type: 'button', textContent: t.done ? 'إيقاف' : 'إلغاء', onclick: () => { timers = timers.filter((x) => x !== t); save(); render(); } })
    ]);
  }) : [el('p', { className: 'tsheet__keys', textContent: 'لا مؤقتات نشطة. اختر زمناً للبدء.' })]));
}

async function toggleWake() {
  if (!('wakeLock' in navigator)) { wakeBtn.textContent = '☀️ غير مدعوم في هذا المتصفح'; wakeBtn.disabled = true; return; }
  try {
    if (wakeLock) { await wakeLock.release(); wakeLock = null; } else { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; wakeBtn.setAttribute('aria-pressed', 'false'); }); }
  } catch { wakeLock = null; }
  wakeBtn.setAttribute('aria-pressed', String(!!wakeLock));
}

const open = (v) => { sheet.dataset.open = String(v); if (v) { render(); sheet.querySelector('button')?.focus(); } };

function build() {
  const custom = el('input', { className: 'field__input', style: 'width:96px', type: 'number', min: 1, max: 180, placeholder: 'دقائق', inputMode: 'numeric', ariaLabel: 'مدة مخصصة بالدقائق' });
  wakeBtn = el('button', { className: 'chip', type: 'button', textContent: '☀️ إبقاء الشاشة مضاءة', ariaPressed: 'false', onclick: toggleWake });
  listEl = el('div', { style: 'display:flex;flex-direction:column;gap:8px' });
  const panel = el('div', { className: 'tsheet__panel', role: 'dialog', ariaModal: 'true', ariaLabel: 'أدوات الوردية' }, [
    el('h2', { textContent: '🛠️ أدوات الوردية' }),
    el('div', { className: 'tsheet__row' }, [...PRESETS.map(([l, s]) => el('button', { className: 'chip', type: 'button', textContent: `⏱ ${l}`, onclick: () => addTimer(s, `مؤقت ${l}`) })),
      custom, el('button', { className: 'btn btn--primary btn--sm', type: 'button', textContent: 'ابدأ', onclick: () => { addTimer(Math.round(custom.value * 60), `مؤقت ${custom.value} د`); custom.value = ''; } })]),
    listEl,
    el('div', { className: 'tsheet__row' }, [wakeBtn, el('button', { className: 'chip', type: 'button', textContent: '⛶ شاشة كاملة', onclick: () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {}); open(false); } }), el('button', { className: 'btn btn--ghost btn--sm', type: 'button', textContent: 'إغلاق', onclick: () => open(false) })]),
    el('div', { className: 'tsheet__keys', innerHTML: '<kbd>Ctrl</kbd>+<kbd>K</kbd> بحث شامل · <kbd>/</kbd> بحث الصفحة · <kbd>G</kbd> ثم <kbd>D</kbd> الرئيسية <kbd>C</kbd> المواد <kbd>E</kbd> التعليم <kbd>S</kbd> السلامة <kbd>L</kbd> السجلات <kbd>P</kbd> المطبوعات <kbd>A</kbd> المساعد · <kbd>T</kbd> الأدوات · <kbd>Esc</kbd> إغلاق' })
  ]);
  sheet = el('div', { className: 'tsheet', onclick: (e) => { if (e.target === sheet) open(false); } }, [panel]);
  document.body.append(sheet);
  const row = document.querySelector('.site-header__row');
  if (row) { let box = row.querySelector('.hdr-actions'); if (!box) { box = el('div', { className: 'hdr-actions' }); row.append(box); }
    box.append(el('button', { className: 'btn btn--ghost btn--icon', type: 'button', ariaLabel: 'أدوات الوردية', textContent: '🛠️', onclick: () => open(true) })); }
}

function bindKeys() {
  let gPending = false;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return open(false);
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    const k = e.key.toLowerCase();
    if (gPending) { gPending = false; if (GO[k]) { e.preventDefault(); navigateTo(GO[k]); } return; }
    if (k === 'g') { gPending = true; setTimeout(() => { gPending = false; }, 1200); }
    else if (k === 't') open(sheet.dataset.open !== 'true');
    else if (k === '/') {
      const inp = document.querySelector('.view:not([hidden]) input[type="search"], .view:not([hidden]) input[type="text"]');
      if (inp) { e.preventDefault(); inp.focus(); }
    }
  });
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && wakeBtn?.getAttribute('aria-pressed') === 'true' && !wakeLock) {
      try { wakeLock = await navigator.wakeLock.request('screen'); } catch { /* ignore */ }
    }
    render();
  });
}

function init() {
  build(); bindKeys();
  try { timers = JSON.parse(sessionStorage.getItem(SS_KEY) ?? '[]').filter((t) => t && t.end); } catch { timers = []; }
  render(); ensureTick();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
