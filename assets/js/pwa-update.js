/**
 * ============================================================================
 * pwa-update.js — إشعار «تحديث جديد جاهز»
 * ============================================================================
 * مسؤولية واحدة: عندما يستلم عامل الخدمة نسخة جديدة وهو يخدم صفحة مفتوحة،
 * تبقى الصفحة تعمل بملفات JS القديمة حتى إعادة التحميل. هذا الإشعار يخبر
 * المستخدم ويتيح له إعادة التحميل بضغطة. لا يظهر عند أول تثبيت.
 * ============================================================================
 */

import { createElement } from './utils.js';

function showUpdateBanner() {
  if (document.getElementById('updateBanner')) return;

  const reloadBtn = createElement('button', { class: 'btn btn--sm btn--primary', type: 'button' }, ['تحديث الآن']);
  reloadBtn.addEventListener('click', () => window.location.reload());

  const dismissBtn = createElement('button', { class: 'btn btn--sm btn--ghost', type: 'button', 'aria-label': 'إغلاق' }, ['✕']);

  const banner = createElement('div', { class: 'update-banner', id: 'updateBanner', role: 'status' }, [
    createElement('span', {}, ['🔄 يتوفر تحديث جديد للتطبيق']),
    reloadBtn,
    dismissBtn
  ]);
  dismissBtn.addEventListener('click', () => banner.remove());

  document.body.appendChild(banner);
}

function init() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;

  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) showUpdateBanner();
  });
}

init();
