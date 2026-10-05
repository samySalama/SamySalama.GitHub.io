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
            placeholder: 'اكتب سؤالك... مثال: بقع مياه على الأطباق',
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
 * يبني فقاعة رسالة (مستخدم أو مساعد) مع أزرار الإجراءات للمساعد.
 * @param {'user'|'assistant'} role
 * @param {string} content
 * @param {number} [chemicalId] - إن وُجد يظهر زر لفتح بطاقة المادة.
 * @returns {HTMLElement}
 */
function buildMessageBubble(role, content, chemicalId) {
  const isUser = role === 'user';
  const bubble = createElement('div', { class: 'ai-message__bubble' });
  bubble.innerHTML = renderSimpleMarkdown(content);
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
        createElement('button', { class: 'btn btn--sm btn--ghost', type: 'button', 'data-action': 'regenerate' }, ['🔄 إعادة توليد'])
      ])
    );
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
  messagesEl.appendChild(buildMessageBubble('assistant', text, chemicalId));
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
  pushAssistantReply(lastUser.content);
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
    if (e.key === 'Enter' && !e.shiftKey) {
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
  showToast('استمع الآن... تحدّث بوضوح', 'default', 2000);
}

registerView('ai', {
  onEnter: () => init()
});
