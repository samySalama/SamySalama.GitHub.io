/**
 * ============================================================================
 * safety.js — عرض السلامة والطوارئ
 * ============================================================================
 * مسؤولية واحدة: عرض محتوى السلامة ووضع الطوارئ (زر SOS + أرقام اتصال سريع)
 * من safetyContent و developerInfo في data.js فقط.
 *
 * v2.2: أرقام الطوارئ الرقمية روابط tel: تتصل بالرقم بلمسة واحدة، وعنوان <h1>
 * لا يُمحى عند البناء.
 * ============================================================================
 */

import { safetyContent, developerInfo } from './data.js';
import { createElement, showToast } from './utils.js';
import { registerView } from './router.js';

let rootEl = null;

/** يُهيّئ عرض السلامة: يبني كل الكتل بالترتيب مرة واحدة. */
function init() {
  rootEl = document.querySelector('[data-view="safety"]');
  if (!rootEl || rootEl.dataset.initialized === 'true') return;
  rootEl.dataset.initialized = 'true';

  rootEl.innerHTML = '';
  rootEl.appendChild(
    createElement('div', { class: 'view-header' }, [
      createElement('div', { class: 'view-header__eyebrow' }, ['السلامة']),
      createElement('h1', { class: 'view-header__title' }, ['السلامة والطوارئ'])
    ])
  );
  rootEl.appendChild(buildEmergencyBlock());
  rootEl.appendChild(buildContaminationBlock());
  rootEl.appendChild(buildPrecautionsBlock());
  rootEl.appendChild(buildPPEBlock());
  rootEl.appendChild(buildFirstAidBlock());
  rootEl.appendChild(buildPestControlBlock());
  rootEl.appendChild(buildDeveloperFooter());

  bindDelegatedEvents();
}

/**
 * يبني بطاقة جهة اتصال طوارئ: رابط tel: إن كان الرقم رقمياً، وإلا بطاقة عادية
 * (مثل «داخلي» للمشرف المناوب).
 * @param {{icon:string,label:string,number:string}} contact
 * @returns {HTMLElement}
 */
function buildContactCard(contact) {
  const children = [
    createElement('span', { 'aria-hidden': 'true' }, [contact.icon]),
    createElement('span', {}, [contact.label]),
    createElement('span', { class: 'emergency-contact__number' }, [contact.number])
  ];

  if (/^\d+$/.test(contact.number)) {
    return createElement(
      'a',
      {
        class: 'emergency-contact',
        href: `tel:${contact.number}`,
        'aria-label': `اتصل بـ ${contact.label} على الرقم ${contact.number}`
      },
      children
    );
  }
  return createElement('div', { class: 'emergency-contact' }, children);
}

/** وضع الطوارئ: زر SOS + شبكة أرقام اتصال سريع. */
function buildEmergencyBlock() {
  return createElement('div', { class: 'safety-block', 'data-no-print': '' }, [
    createElement('h2', { class: 'safety-block__title' }, [createElement('span', { 'aria-hidden': 'true' }, ['🚨']), ' وضع الطوارئ']),
    createElement('div', { class: 'emergency-sos' }, [
      createElement(
        'button',
        { class: 'emergency-sos__button', type: 'button', id: 'sosButton', 'aria-label': 'إظهار أرقام الطوارئ' },
        ['SOS']
      ),
      createElement('div', { style: 'font-size:12px;color:var(--content-muted)' }, ['اضغط لعرض أرقام الاتصال السريع'])
    ]),
    createElement('div', { class: 'emergency-contacts' }, safetyContent.emergencyContacts.map(buildContactCard))
  ]);
}

/** كتلة «أنواع التلوث الغذائي». */
function buildContaminationBlock() {
  return createElement('div', { class: 'safety-block' }, [
    createElement('h2', { class: 'safety-block__title' }, [createElement('span', { 'aria-hidden': 'true' }, ['🦠']), ' أنواع التلوث الغذائي']),
    ...safetyContent.contamination.map((c) =>
      createElement('div', { class: 'contam-card' }, [
        createElement('div', { class: 'contam-card__title' }, [createElement('span', { 'aria-hidden': 'true' }, [c.icon]), c.title]),
        createElement('div', { class: 'contam-card__desc' }, [c.desc]),
        createElement(
          'div',
          { class: 'contam-card__examples' },
          c.tags.map((t) => createElement('span', { class: `badge badge--${c.variant}` }, [t]))
        )
      ])
    )
  ]);
}

/** كتلة «الاحتياطات الأمنية». */
function buildPrecautionsBlock() {
  return createElement('div', { class: 'safety-block' }, [
    createElement('h2', { class: 'safety-block__title' }, [createElement('span', { 'aria-hidden': 'true' }, ['⚡']), ' الاحتياطات الأمنية']),
    createElement('div', { class: 'alert-box alert-box--danger' }, [
      createElement('span', { 'aria-hidden': 'true' }, ['🔴']),
      createElement('div', {}, [
        createElement('strong', {}, ['قانون لا استثناء فيه: ']),
        safetyContent.precautionsAlert.replace('قانون لا استثناء فيه: ', '')
      ])
    ]),
    createElement(
      'ul',
      { class: 'safety-list' },
      safetyContent.precautions.map((p) =>
        createElement('li', {}, [createElement('span', { class: 'safety-list__icon', 'aria-hidden': 'true' }, ['⚠️']), createElement('span', {}, [p])])
      )
    )
  ]);
}

/** شبكة معدات الحماية الشخصية (PPE). */
function buildPPEBlock() {
  return createElement('div', { class: 'safety-block' }, [
    createElement('h2', { class: 'safety-block__title' }, [createElement('span', { 'aria-hidden': 'true' }, ['🦺']), ' معدات الحماية الشخصية (PPE)']),
    createElement(
      'div',
      { class: 'ppe-full-grid' },
      safetyContent.ppe.map((item) =>
        createElement('div', { class: 'ppe-full-item' }, [
          createElement('div', { class: 'ppe-full-item__icon', 'aria-hidden': 'true' }, [item.icon]),
          createElement('div', { class: 'ppe-full-item__name' }, [item.name]),
          createElement('div', { class: 'ppe-full-item__when' }, [item.when])
        ])
      )
    )
  ]);
}

/** كتلة الإسعافات الأولية السريعة. */
function buildFirstAidBlock() {
  return createElement('div', { class: 'safety-block' }, [
    createElement('h2', { class: 'safety-block__title' }, [createElement('span', { 'aria-hidden': 'true' }, ['🚑']), ' إسعافات أولية — كيماويات']),
    createElement('div', { class: 'alert-box alert-box--info' }, [
      createElement('span', { 'aria-hidden': 'true' }, ['💡']),
      createElement('div', {}, [safetyContent.firstAidNote])
    ]),
    createElement(
      'ul',
      { class: 'safety-list' },
      safetyContent.firstAid.map((item) =>
        createElement('li', {}, [
          createElement('span', { class: 'safety-list__icon', 'aria-hidden': 'true' }, [item.icon]),
          createElement('div', {}, [createElement('strong', {}, [`${item.label}: `]), item.text])
        ])
      )
    )
  ]);
}

/** كتلة «مكافحة الحشرات». */
function buildPestControlBlock() {
  return createElement('div', { class: 'safety-block' }, [
    createElement('h2', { class: 'safety-block__title' }, [createElement('span', { 'aria-hidden': 'true' }, ['🪲']), ' مكافحة الحشرات']),
    createElement(
      'ul',
      { class: 'safety-list' },
      safetyContent.pestControl.map((p) =>
        createElement('li', {}, [createElement('span', { class: 'safety-list__icon', 'aria-hidden': 'true' }, ['📅']), createElement('span', {}, [p])])
      )
    )
  ]);
}

/** تذييل معلومات المطوّر مع رابط واتساب. */
function buildDeveloperFooter() {
  return createElement('footer', { class: 'dev-footer', 'data-no-print': '' }, [
    createElement('div', {}, ['تم التطوير بواسطة']),
    createElement('div', { class: 'dev-footer__name' }, [developerInfo.name]),
    createElement(
      'a',
      { href: developerInfo.whatsappUrl, target: '_blank', rel: 'noopener noreferrer', class: 'dev-footer__whatsapp' },
      ['💬 تواصل عبر واتساب']
    ),
    createElement('div', {}, [developerInfo.whatsappNumber])
  ]);
}

/** مستمع الأحداث المفوَّض (زر SOS). */
function bindDelegatedEvents() {
  rootEl.addEventListener('click', (e) => {
    if (e.target.closest('#sosButton')) {
      document.querySelector('.emergency-contacts')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast('المس أقرب رقم من القائمة للاتصال مباشرة', 'default', 3200);
    }
  });
}

registerView('safety', {
  onEnter: () => init()
});
