/**
 * ============================================================================
 * ai.js — المساعد الذكي (واجهة المحادثة فقط)
 * ============================================================================
 * مسؤولية واحدة: واجهة المحادثة وتفاعلها. محرك الإجابة انتقل في v2.1 إلى
 * assistant-engine.js (دوال نقية قابلة للاختبار الآلي، بنظام نقاط بدل
 * «أول regex يتطابق يفوز»). التطبيق ما زال 100% ثابتاً بلا خادم.
 * ============================================================================
 */

import { getState, appendChatMessage, clearChatHistory } from './state.js';
import { createElement, renderSimpleMarkdown, copyToClipboard, showToast } from './utils.js';
import { registerView, navigateTo } from './router.js';
import { openChemicalById } from './chemicals.js';
import { answer } from './assistant-engine.js';
import { chemicals } from './data.js';

let rootEl = null;
let messagesEl = null;
let inputEl = null;
let sendBtn = null;
let isThinking = false;

/** اقتراحات سريعة تُعرض في الشاشة الترحيبية وكرقاقات قابلة للنقر. */
const QUICK_SUGGESTIONS = [
  'Checklist وردية صباحية',
  'بقع مياه على الأطباق',
  'دهون محروقة على الجريلة',
  'الفرق بين التنظيف والتطهير',
  'ماكينة الأطباق مش بتنضف كويس',
  'تخفيف ENFORCE'
];

/** يُهيّئ عرض المساعد الذكي ويستعيد السجل المحفوظ. */
function init() {
  rootEl = document.querySelector('[data-view="ai"]');
  if (!rootEl || rootEl.dataset.initialized === 'true') return;
  rootEl.dataset.initialized = 'true';

  rootEl.innerHTML = '';
  rootEl.appendChild(createElement('h1', { class: 'u-visually-hidden' }, ['المساعد الذكي']));
  rootEl.appendChild(buildChatShell());

  messagesEl = rootEl.querySelector('#aiMessages');
  inputEl = rootEl.querySelector('#aiInput');
  sendBtn = rootEl.querySelector('#aiSendBtn');

  renderWelcomeOrHistory();
  bindEvents();
}

/** يبني الهيكل الثابت: شريط أدوات + منطقة الرسائل + شريط الإدخال. */
function buildChatShell() {
  const hasSpeechRecognition = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  return createElement('div', { class: 'ai-view' }, [
    createElement('div', { class: 'ai-toolbar' }, [
      createElement('button', { class: 'btn btn--sm btn--ghost', type: 'button', id: 'aiClearBtn' }, ['🗑️ مسح المحادثة'])
    ]),
    createElement('div', { class: 'ai-messages', id: 'aiMessages', role: 'log', 'aria-live': 'polite' }),
    createElement(
      'div',
      { class: 'ai-input-bar' },
      [
        createElement('div', { class: 'field ai-input-bar__field' }, [
          createElement('textarea', {
            class: 'field__textarea',
            id: 'aiInput',
            rows: '1',
            placeholder: 'اكتب سؤالك… مثال: بقع مياه على الأطباق',
            name: 'question',
            autocomplete: 'off',
            enterkeyhint: 'send',
            'aria-label': 'اكتب رسالتك للمساعد الذكي'
          })
        ]),
        hasSpeechRecognition
          ? createElement(
              'button',
              { class: 'btn btn--icon btn--ghost ai-input-bar__mic', type: 'button', id: 'aiMicBtn', 'aria-label': 'إدخال صوتي' },
              ['🎤']
            )
          : '',
        createElement('button', { class: 'btn btn--icon btn--primary', type: 'button', id: 'aiSendBtn', 'aria-label': 'إرسال' }, ['↑'])
      ].filter(Boolean)
    )
  ]);
}

/** يعرض الترحيب إن كان السجل فارغاً، أو يستعيد الرسائل المحفوظة. */
function renderWelcomeOrHistory() {
  const history = getState('chatHistory');
  messagesEl.innerHTML = '';

  if (history.length === 0) {
    messagesEl.appendChild(buildWelcomeCard());
    return;
  }

  history.forEach((msg) => messagesEl.appendChild(buildMessageBubble(msg.role, msg.content)));
  scrollToBottom();
}

/** بطاقة الترحيب مع شارة "يعمل بدون إنترنت" واقتراحات سريعة. */
function buildWelcomeCard() {
  return createElement('div', { class: 'ai-welcome' }, [
    createElement('div', { class: 'ai-welcome__title' }, [createElement('span', { 'aria-hidden': 'true' }, ['🤖']), 'مساعد الاستيوارد الذكي']),
    createElement('div', { class: 'ai-welcome__desc' }, [
      'اسألني عن أي مادة كيميائية (تخفيفها، معدات حمايتها، إسعافاتها)، مشكلة تشغيلية، أو إجراء سلامة — إجابات فورية من قاعدة معرفة القسم.'
    ]),
    createElement('div', { class: 'ai-context-badge' }, [createElement('span', { 'aria-hidden': 'true' }, ['📡']), 'يعمل بالكامل بدون إنترنت']),
    createElement(
      'div',
      { class: 'ai-suggestions-row' },
      QUICK_SUGGESTIONS.map((s) => createElement('button', { class: 'chip', type: 'button', 'data-suggestion': s }, [s]))
    )
  ]);
}

/**
 * يحوّل أسماء المواد الكيميائية في النص لروابط تفاعلية لفتحها في صفحة المواد.
 * @param {string} text
 * @returns {string}
 */
function linkifyChemicalNames(text) {
  let linkedText = text;
  chemicals.forEach((chem) => {
    const nameEnPattern = new RegExp(`\\b${escapeRegExp(chem.nameEn)}\\b`, 'g');
    linkedText = linkedText.replace(
      nameEnPattern,
      `<button class="ai-chem-link" type="button" data-open-chem="${chem.id}">${chem.nameEn}</button>`
    );
    if (chem.nameAr && chem.nameAr !== chem.nameEn) {
      const nameArPattern = new RegExp(escapeRegExp(chem.nameAr), 'g');
      if (!linkedText.includes(`data-open-chem="${chem.id}">${chem.nameAr}</button>`)) {
        linkedText = linkedText.replace(
          nameArPattern,
          `<button class="ai-chem-link" type="button" data-open-chem="${chem.id}">${chem.nameAr}</button>`
        );
      }
    }
  });
  return linkedText;
}

/**
 * يُهرب أحرف RegExp
 * @param {string} string
 * @returns {string}
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * يحصل على اقتراحات متابعة بناءً على محتوى الرد
 * @param {string} content
 * @returns {string[]}
 */
function getFollowUpSuggestions(content) {
  const normalized = content.toLowerCase().replace(/[^\u0600-\u06FFa-z0-9\s]/g, ' ');
  if (/بقع|مياه|water|spot/.test(normalized)) {
    return ['ماكينة الأطباق مش بتنضف كويس', 'الفرق بين التنظيف والتطهير', 'RINSE DRY كيفية الاستخدام'];
  }
  if (/جريله|دهون|محروق|greas|grill/.test(normalized)) {
    return ['نظافة المعدات يومياً', 'معدات الحماية المطلوبة', 'GREASSTRIP PLUS طريقة الاستخدام'];
  }
  if (/ماكينه|غساله|اطباق|dish/.test(normalized)) {
    return ['بقع مياه على الأطباق', 'Checklist وردية صباحية', 'SOLID POWER XL'];
  }
  if (/كيماوي|عين|جلد|طوارئ|اسعاف/.test(normalized)) {
    return ['معدات الحماية الشخصية PPE', 'قواعد السلامة العامة', 'أرقام الطوارئ'];
  }
  if (/حساسيه|allerg/.test(normalized)) {
    return ['القواعد الذهبية لسلامة الغذاء', 'ترتيب الثلاجة', 'الألواح الملونة'];
  }
  if (/haccp|هاسب/.test(normalized)) {
    return ['القواعد الذهبية لسلامة الغذاء', 'نقاط التحكم الحرجة', 'تحليل المخاطر'];
  }
  if (/ثلاجه|تبريد|تجميد/.test(normalized)) {
    return ['القواعد الذهبية لسلامة الغذاء', 'منع التلوث المتبادل', 'درجات الحرارة الآمنة'];
  }
  return ['Checklist وردية صباحية', 'القواعد الذهبية لسلامة الغذاء', 'المواد الكيميائية الأكثر استخداماً'];
}

/**
 * يحصل على مواد كيميائية ذات صلة بناءً على محتوى الرد
 * @param {string} content
 * @returns {Array}
 */
function getRelatedChemicals(content) {
  const normalized = content.toLowerCase().replace(/[^\u0600-\u06FFa-z0-9\s]/g, ' ');
  const related = [];
  if (/بقع|مياه|شطف|rinse|spot/.test(normalized)) {
    const c1 = chemicals.find(c => c.nameEn === 'SOLID BRILLIANCE');
    const c2 = chemicals.find(c => c.nameEn === 'RINSE DRY');
    if (c1) related.push(c1);
    if (c2) related.push(c2);
  }
  if (/دهون|جريله|محروق|greas|grill/.test(normalized)) {
    const c = chemicals.find(c => c.nameEn === 'GREASSTRIP PLUS');
    if (c) related.push(c);
  }
  if (/غساله|اطباق|dish/.test(normalized)) {
    const c1 = chemicals.find(c => c.nameEn === 'SOLID POWER XL');
    const c2 = chemicals.find(c => c.nameEn === 'SUPER TRUMP');
    if (c1) related.push(c1);
    if (c2) related.push(c2);
  }
  if (/ارضيات|floor|enforce/.test(normalized)) {
    const c = chemicals.find(c => c.nameEn === 'ENFORCE');
    if (c) related.push(c);
  }
  if (/تطهير|مطهر|sanit/.test(normalized)) {
    const c1 = chemicals.find(c => c.nameEn === 'OASIS 146');
    const c2 = chemicals.find(c => c.nameEn === 'SANICHLOR');
    if (c1) related.push(c1);
    if (c2) related.push(c2);
  }
  if (/املاح|cale|descal|lime/.test(normalized)) {
    const c = chemicals.find(c => c.nameEn === 'LIME-AWAY EXTRA');
    if (c) related.push(c);
  }
  return related.slice(0, 3);
}

/**
 * يبني فقاعة رسالة (مستخدم أو مساعد) مع أزرار الإجراءات للمساعد.
 * @param {'user'|'assistant'} role
 * @param {string} content
 * @param {number} [chemicalId] - إن وُجد يظهر زر لفتح بطاقة المادة.
 * @param {boolean} [showExtras=false]
 * @returns {HTMLElement}
 */
function buildMessageBubble(role, content, chemicalId, showExtras = false) {
  const isUser = role === 'user';
  const bubble = createElement('div', { class: 'ai-message__bubble' });
  const displayContent = isUser ? content : linkifyChemicalNames(content);
  bubble.innerHTML = renderSimpleMarkdown(displayContent);
  bubble.dataset.rawContent = content;

  const avatar = createElement('div', { class: 'ai-message__avatar', 'aria-hidden': 'true' }, [isUser ? '👤' : '🤖']);
  const column = createElement('div', {}, [bubble]);

  if (!isUser) {
    if (chemicalId) {
      column.appendChild(
        createElement(
          'button',
          { class: 'btn btn--sm ai-message__open-card', type: 'button', 'data-action': 'open-chemical', 'data-chem-id': chemicalId },
          ['🧪 افتح بطاقة المادة']
        )
      );
    }
    column.appendChild(
      createElement('div', { class: 'ai-message__actions' }, [
        createElement('button', { class: 'btn btn--sm btn--ghost', type: 'button', 'data-action': 'copy-message' }, ['📋 نسخ']),
        createElement('button', { class: 'btn btn--sm btn--ghost', type: 'button', 'data-action': 'share-whatsapp' }, ['💬 واتساب']),
        createElement('button', { class: 'btn btn--sm btn--ghost', type: 'button', 'data-action': 'regenerate' }, ['🔄 إعادة توليد'])
      ])
    );
    
    if (showExtras) {
      const followUpSuggestions = getFollowUpSuggestions(content);
      if (followUpSuggestions.length > 0) {
        const followUpDiv = createElement('div', { class: 'ai-followup' }, [
          createElement('div', { class: 'ai-followup__label' }, ['اقتراحات متابعة:']),
          createElement(
            'div',
            { class: 'ai-followup__chips' },
            followUpSuggestions.map((s) =>
              createElement('button', { class: 'chip chip--sm', type: 'button', 'data-followup': s }, [s])
            )
          )
        ]);
        column.appendChild(followUpDiv);
      }
      
      const related = getRelatedChemicals(content);
      if (related.length > 0) {
        const relatedDiv = createElement('div', { class: 'ai-related' }, [
          createElement('div', { class: 'ai-related__label' }, ['مواد ذات صلة:']),
          createElement(
            'div',
            { class: 'ai-related__chips' },
            related.map((c) =>
              createElement('button', { class: 'chip chip--sm', type: 'button', 'data-open-chem': c.id }, [c.nameEn])
            )
          )
        ]);
        column.appendChild(relatedDiv);
      }
    }
  }

  return createElement('div', { class: `ai-message ai-message--${isUser ? 'user' : 'assistant'}` }, [avatar, column]);
}

/** مؤشر "المساعد يكتب..." المتحرك. */
function showTypingIndicator() {
  const wrapper = createElement('div', { class: 'ai-message ai-message--assistant', id: 'aiTypingIndicator' }, [
    createElement('div', { class: 'ai-message__avatar', 'aria-hidden': 'true' }, ['🤖']),
    createElement('div', { class: 'ai-typing' }, [
      createElement('span', { class: 'ai-typing__dot' }),
      createElement('span', { class: 'ai-typing__dot' }),
      createElement('span', { class: 'ai-typing__dot' })
    ])
  ]);
  messagesEl.appendChild(wrapper);
  scrollToBottom();
}

function scrollToBottom() {
  messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: 'smooth' });
}

/** يعرض ردّ المساعد ويحفظه في السجل. */
function pushAssistantReply(userText) {
  const { text, chemicalId } = answer(userText);
  appendChatMessage('assistant', text);
  messagesEl.appendChild(buildMessageBubble('assistant', text, chemicalId, true));
  scrollToBottom();
}

/** يرسل رسالة المستخدم الحالية ثم يعرض رد المحرك المحلي بعد تأخير قصير. */
async function sendMessage() {
  if (isThinking) return;
  const text = inputEl.value.trim();
  if (!text) return;

  inputEl.value = '';
  inputEl.style.height = 'auto';
  setThinking(true);

  messagesEl.querySelector('.ai-welcome')?.remove();

  appendChatMessage('user', text);
  messagesEl.appendChild(buildMessageBubble('user', text));
  scrollToBottom();

  showTypingIndicator();
  await new Promise((resolve) => setTimeout(resolve, 450));
  document.getElementById('aiTypingIndicator')?.remove();

  pushAssistantReply(text);
  setThinking(false);
}

/** يعيد توليد الرد على آخر رسالة مستخدم. */
function regenerateLastResponse() {
  const lastUser = [...getState('chatHistory')].reverse().find((m) => m.role === 'user');
  if (!lastUser) return;
  const { text, chemicalId } = answer(lastUser.content);
  appendChatMessage('assistant', text);
  messagesEl.appendChild(buildMessageBubble('assistant', text, chemicalId, true));
  scrollToBottom();
  showToast('تم إعادة توليد الرد', 'success');
}

function setThinking(thinking) {
  isThinking = thinking;
  sendBtn.disabled = thinking;
}

/** يمسح المحادثة بعد تأكيد المستخدم ويعيد عرض الترحيب. */
function handleClearChat() {
  if (getState('chatHistory').length === 0) return;
  if (!window.confirm('مسح كل المحادثة؟')) return;
  clearChatHistory();
  renderWelcomeOrHistory();
  showToast('تم مسح المحادثة');
}

/** يُسجّل كل مستمعي الأحداث (تفويض على الجذر + مستمعات الإدخال). */
function bindEvents() {
  sendBtn.addEventListener('click', sendMessage);

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  });

  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = `${inputEl.scrollHeight}px`;
  });

  rootEl.addEventListener('click', (e) => {
    const suggestionChip = e.target.closest('[data-suggestion]');
    if (suggestionChip) {
      inputEl.value = suggestionChip.dataset.suggestion;
      sendMessage();
      return;
    }
    
    const followUpChip = e.target.closest('[data-followup]');
    if (followUpChip) {
      inputEl.value = followUpChip.dataset.followup;
      sendMessage();
      return;
    }
    
    const chemLink = e.target.closest('.ai-chem-link');
    if (chemLink) {
      const chemId = Number(chemLink.dataset.openChem);
      navigateTo('chemicals');
      requestAnimationFrame(() => openChemicalById(chemId));
      return;
    }
    
    const openChemBtn = e.target.closest('[data-open-chem]');
    if (openChemBtn && !openChemBtn.classList.contains('ai-chem-link')) {
      const chemId = Number(openChemBtn.dataset.openChem);
      navigateTo('chemicals');
      requestAnimationFrame(() => openChemicalById(chemId));
      return;
    }

    if (e.target.closest('#aiClearBtn')) {
      handleClearChat();
      return;
    }

    const openBtn = e.target.closest('[data-action="open-chemical"]');
    if (openBtn) {
      const chemId = Number(openBtn.dataset.chemId);
      navigateTo('chemicals');
      requestAnimationFrame(() => openChemicalById(chemId));
      return;
    }

    if (e.target.closest('[data-action="copy-message"]')) {
      const bubble = e.target.closest('.ai-message').querySelector('.ai-message__bubble');
      copyToClipboard(bubble.dataset.rawContent).then((success) => {
        showToast(success ? 'تم نسخ الرد' : 'تعذّر النسخ', success ? 'success' : 'error');
      });
      return;
    }
    
    if (e.target.closest('[data-action="share-whatsapp"]')) {
      const bubble = e.target.closest('.ai-message').querySelector('.ai-message__bubble');
      const text = bubble.dataset.rawContent;
      const whatsappText = encodeURIComponent(`*دليل الاستيوارد - المساعد الذكي*\n\n${text}\n\nمن تطبيق دليل الاستيوارد`);
      window.open(`https://wa.me/?text=${whatsappText}`, '_blank');
      showToast('جاري فتح واتساب...', 'success');
      return;
    }

    if (e.target.closest('[data-action="regenerate"]')) {
      regenerateLastResponse();
      return;
    }

    if (e.target.closest('#aiMicBtn')) startVoiceInput();
  });
}

/** الإدخال الصوتي عبر Web Speech API (اختياري، الزر لا يُبنى إن لم يُدعم). */
function startVoiceInput() {
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionCtor) return;

  const recognition = new SpeechRecognitionCtor();
  recognition.lang = 'ar-EG';
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    inputEl.value = event.results[0][0].transcript;
    inputEl.dispatchEvent(new Event('input'));
  };
  recognition.onerror = () => showToast('تعذّر التعرّف على الصوت', 'error');

  recognition.start();
  showToast('استمع الآن… تحدّث بوضوح', 'default', 2000);
}

registerView('ai', {
  onEnter: () => init()
});
