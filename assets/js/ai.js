/**
 * ============================================================================
 * ai.js — المساعد الذكي (واجهة شبيهة بـ ChatGPT، محرك إجابات محلي بدون خادم)
 * ============================================================================
 * مسؤولية واحدة: واجهة المحادثة وتفاعلها. محرك الإجابة نفسه (answerFromKnowledge
 * وما يتفرّع منه) منقول بمنطقه الأصلي بالكامل من التطبيق المصدر — هذا ليس
 * استدعاءً لأي API خارجي؛ التطبيق 100% ثابت (static) بلا خادم، والمساعد
 * يعمل بقاعدة معرفة محلية مبنية على أنماط نصية (regex) وقاعدة بيانات
 * المواد الكيميائية في data.js. تم الحفاظ على هذا القرار كما ووفق عليه
 * صراحة في مرحلة التخطيط (لا يوجد مفتاح API يمكن تخزينه بأمان في كود ثابت).
 * ============================================================================
 */

import { chemicals } from './data.js';
import { getState, appendChatMessage, clearChatHistory } from './state.js';
import {
  normalizeText,
  getDangerLabel,
  createElement,
  renderSimpleMarkdown,
  copyToClipboard,
  showToast,
  formatTime
} from './utils.js';
import { registerView } from './router.js';
import { openChemicalById } from './chemicals.js';

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
  'ماكينة الأطباق مش بتنضف كويس'
];

/**
 * يُهيّئ عرض المساعد الذكي: يبني هيكل المحادثة، يستعيد السجل المحفوظ إن وُجد.
 * @returns {void}
 */
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

/**
 * يبني الهيكل الثابت لواجهة المحادثة (منطقة الرسائل + شريط الإدخال).
 * @returns {HTMLElement}
 */
function buildChatShell() {
  const hasSpeechRecognition = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  return createElement('div', { class: 'ai-view' }, [
    createElement('div', { class: 'ai-messages', id: 'aiMessages', role: 'log', 'aria-live': 'polite' }),
    createElement('div', { class: 'ai-input-bar' }, [
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
      createElement(
        'button',
        { class: 'btn btn--icon btn--primary', type: 'button', id: 'aiSendBtn', 'aria-label': 'إرسال' },
        ['↑']
      )
    ].filter(Boolean))
  ]);
}

/**
 * يعرض الشاشة الترحيبية إن كان السجل فارغاً، أو يستعيد الرسائل المحفوظة.
 * @returns {void}
 */
function renderWelcomeOrHistory() {
  const history = getState('chatHistory');
  messagesEl.innerHTML = '';

  if (history.length === 0) {
    messagesEl.appendChild(buildWelcomeCard());
    return;
  }

  history.forEach((msg) => {
    messagesEl.appendChild(buildMessageBubble(msg.role, msg.content));
  });
  scrollToBottom();
}

/**
 * يبني بطاقة الترحيب مع شارة "يعمل بدون إنترنت" واقتراحات سريعة.
 * @returns {HTMLElement}
 */
function buildWelcomeCard() {
  return createElement('div', { class: 'ai-welcome' }, [
    createElement('div', { class: 'ai-welcome__title' }, [
      createElement('span', { 'aria-hidden': 'true' }, ['🤖']),
      'مساعد الاستيوارد الذكي'
    ]),
    createElement('div', { class: 'ai-welcome__desc' }, [
      'اسألني عن أي مادة كيميائية، مشكلة تشغيلية، أو إجراء سلامة — إجابات فورية من قاعدة معرفة القسم.'
    ]),
    createElement('div', { class: 'ai-context-badge' }, [
      createElement('span', { 'aria-hidden': 'true' }, ['📡']),
      'يعمل بالكامل بدون إنترنت'
    ]),
    createElement(
      'div',
      { class: 'ai-suggestions-row' },
      QUICK_SUGGESTIONS.map((s) =>
        createElement('button', { class: 'chip', type: 'button', 'data-suggestion': s }, [s])
      )
    )
  ]);
}

/**
 * يبني فقاعة رسالة واحدة (مستخدم أو مساعد) مع أزرار الإجراءات للمساعد.
 * @param {'user'|'assistant'} role
 * @param {string} content
 * @returns {HTMLElement}
 */
function buildMessageBubble(role, content) {
  const isUser = role === 'user';
  const bubble = createElement('div', { class: 'ai-message__bubble' });
  bubble.innerHTML = renderSimpleMarkdown(content);

  const children = [
    createElement('div', { class: 'ai-message__avatar', 'aria-hidden': 'true' }, [isUser ? '👤' : '🤖']),
    bubble
  ];

  const wrapper = createElement('div', { class: `ai-message ai-message--${isUser ? 'user' : 'assistant'}` }, isUser ? children : [children[1], children[0]].reverse());
  // ملاحظة: الترتيب البصري (أفاتار/فقاعة) يُدار عبر flex-direction في CSS حسب
  // .ai-message--user، لذا لا حاجة لعكس ترتيب DOM هنا فعلياً — أُبقي على
  // الترتيب المنطقي (أفاتار ثم فقاعة) لثبات بنية DOM بين الحالتين.

  if (!isUser) {
    const actions = createElement('div', { class: 'ai-message__actions' }, [
      createElement('button', { class: 'btn btn--sm btn--ghost', type: 'button', 'data-action': 'copy-message' }, ['📋 نسخ']),
      createElement('button', { class: 'btn btn--sm btn--ghost', type: 'button', 'data-action': 'regenerate' }, ['🔄 إعادة توليد'])
    ]);
    bubble.dataset.rawContent = content;
    wrapper.querySelector('.ai-message__avatar').insertAdjacentElement('afterend', actions);
  }

  return wrapper;
}

/**
 * يبني ويعرض مؤشر "المساعد يكتب..." المتحرك أثناء انتظار الرد.
 * @returns {HTMLElement}
 */
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
  return wrapper;
}

/** يُمرّر منطقة الرسائل لأسفل بسلاسة عند وصول رسالة جديدة. */
function scrollToBottom() {
  messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: 'smooth' });
}

/* ============================================================================
   محرك الإجابة المحلي (منقول بمنطقه الأصلي الكامل من التطبيق المصدر)
   ============================================================================ */

/**
 * يبحث عن مادة كيميائية مذكورة ضمن نص حر (بالعربي أو الإنجليزي).
 * @param {string} text
 * @returns {import('./data.js').Chemical|undefined}
 */
function findChemicalFromText(text) {
  const normalized = normalizeText(text);
  return chemicals.find(
    (c) =>
      normalized.includes(normalizeText(c.nameAr)) ||
      normalized.includes(normalizeText(c.nameEn)) ||
      normalizeText(c.nameEn)
        .split(' ')
        .some((part) => part.length > 3 && normalized.includes(part.toLowerCase()))
  );
}

/**
 * يبني نص قائمة تدقيق (Checklist) جاهزة حسب نوع الوردية/التنظيف المطلوب.
 * @param {'morning'|'deep'|'general'} type
 * @returns {string}
 */
function buildChecklist(type) {
  if (type === 'morning') {
    return `**Checklist وردية صباحية:**
1) تفقد الـ PPE واللوحات التحذيرية.
2) تجهيز أحواض الغسيل والتطهير بالتراكيز الصحيحة.
3) تنظيف أولي للأسطح والأرضيات قبل بدء التشغيل.
4) فحص ماكينة الأطباق ودرجات الحرارة.
5) التأكد من توافر الصابون والمطهرات والورق.
6) تسجيل أي نقص أو تسريب وإبلاغ المشرف.`;
  }
  if (type === 'deep') {
    return `**Checklist نظافة عميقة:**
1) وقف التشغيل تماماً.
2) فصل الكهرباء والغاز.
3) فك الأجزاء القابلة للفك.
4) تنظيف مبدئي ثم منظف مناسب ثم شطف ثم تطهير ثم تجفيف.
5) تنظيف الأهواد والفلاتر والبالوعات والزوايا المخفية.
6) توقيع المسؤول بعد الفحص النهائي.`;
  }
  return `**Checklist سريعة:**
1) تنظيف مبدئي.
2) اختيار المادة الصحيحة.
3) الالتزام بالتخفيف.
4) ارتداء الـ PPE.
5) شطف/تطهير حسب الحالة.
6) تجفيف وتسجيل الملاحظات.`;
}

/**
 * محرك الإجابة الرئيسي: يُطابق النص مع أنماط معروفة (checklist، بقع مياه،
 * دهون محروقة، pH، فرق التنظيف/التطهير، ماكينة الأطباق، طوارئ) قبل اللجوء
 * لمطابقة اسم مادة كيميائية مباشرة، ثم أخيراً بحث عام بالكلمة الأولى.
 * @param {string} text
 * @returns {string}
 */
function answerFromKnowledge(text) {
  const normalized = normalizeText(text);
  const matchedChemical = findChemicalFromText(text);

  if (/checklist|جدول|قائمه|تشك ليست/.test(normalized)) {
    if (/صباح|morning/.test(normalized)) return buildChecklist('morning');
    if (/عميق|شهري|اسبوعي|deep/.test(normalized)) return buildChecklist('deep');
    return buildChecklist('general');
  }

  if (/بقع|مياه|water spot|spot/.test(normalized)) {
    return `لو الأطباق بتطلع عليها بقع مياه:
1) راجع مادة الشطف/التجفيف مثل **SOLID BRILLIANCE** أو **RINSE DRY**.
2) تأكد إن الشطف النهائي بين 75 و82°م.
3) لو الحرارة أعلى من 82° ممكن يحصل تلوث كيميائي وبقايا مادة التجفيف.
4) افحص عسر المياه وتراكم الأملاح واستخدم مزيل أملاح عند الحاجة.`;
  }

  if (/جريله|grill|دهون|محروق|burn/.test(normalized)) {
    return `للدهون المحروقة على الجريلة:
1) افصل المصدر الكهربائي أو الغاز.
2) اعمل تنظيف مبدئي بالمقطع والفرشاة.
3) استخدم **GREASSTRIP PLUS** على حرارة 40–50°م لمدة 10–15 دقيقة.
4) اشطف ثم لو فيه ترسبات استخدم مزيل أملاح مناسب.
5) ارتدِ قفازات سميكة + نظارة + تهوية جيدة.`;
  }

  if (/p\s*h|ph|حموض|قلوي|حمضي/.test(normalized)) {
    return `اختيار المادة حسب pH:
- **الحمضي:** لإزالة الأملاح والترسبات.
- **المحايد:** آمن ولطيف مثل بعض أنواع صابون اليد.
- **القلوي:** أفضل لإزالة الدهون والزيوت.
ممنوع خلط المواد المختلفة خصوصاً الحمضي مع الكلور.`;
  }

  if (/تعقيم|تطهير|تنظيف/.test(normalized) && /فرق|ايه/.test(normalized)) {
    return `الفرق باختصار:
- **التنظيف:** إزالة الأوساخ المرئية وغير المرئية.
- **التطهير:** تنظيف + تقليل البكتيريا للحد الآمن.
- **التعقيم:** أعلى مستوى ويستهدف القضاء الكامل على الميكروبات.`;
  }

  if (/ماكينه|غساله|غسيل الاطباق/.test(normalized) && /مش بتنضف|ضعيف|ضعيفه|ليه/.test(normalized)) {
    return `لو ماكينة الأطباق مش بتنظف كويس:
1) راجع التنظيف المبدئي قبل دخول الأطباق.
2) تأكد من مادة الغسيل ومادة الشطف.
3) افحص درجات الحرارة: غسيل 55–65°م وشطف نهائي 75–82°م.
4) افحص الذراع الرشاش والفلاتر وترسبات الأملاح.
5) تأكد إن الجرعات تلقائية ومفيش انسداد في خطوط الضخ.`;
  }

  if (/طوارئ|عين|جلد|ابتلاع|استنشاق/.test(normalized)) {
    return `إسعافات أولية سريعة:
- **العين:** شطف 15 دقيقة على الأقل.
- **الجلد:** إزالة التلوث وغسل جيد بالماء والصابون.
- **الابتلاع:** لا تستفز القيء واطلب الطوارئ.
- **الاستنشاق:** هواء نقي فوراً ومساعدة طبية.
مع أي حادث لازم تبلغ المشرف فوراً.`;
  }

  if (matchedChemical) {
    return `**${matchedChemical.nameAr} / ${matchedChemical.nameEn}**
الاستخدام: ${matchedChemical.usage}
التخفيف: ${matchedChemical.dilution}
الخطورة: ${getDangerLabel(matchedChemical.danger)}
التحذير: ${matchedChemical.hazard}
التخزين: ${matchedChemical.storage}`;
  }

  const firstWord = normalized.split(' ')[0] || '';
  const topMatches = chemicals
    .filter((c) => normalizeText([c.nameAr, c.nameEn, c.desc, c.usage, c.hazard].join(' ')).includes(firstWord))
    .slice(0, 3);

  if (topMatches.length) {
    const lines = topMatches.map((c, i) => `${i + 1}) ${c.nameAr} — ${c.desc}`).join('\n');
    return `أقرب مواد مرتبطة بسؤالك:\n${lines}\n\nلو تحب، اكتب اسم المعدة أو المشكلة وسأعطيك خطوات أدق.`;
  }

  return 'ممكن أوضحها لك فوراً. اكتب اسم المادة أو المشكلة التشغيلية نفسها، مثلاً: بقع مياه، دهون محروقة، نظافة وردية صباحية، أو اسم المادة الكيميائية.';
}

/* ============================================================================
   منطق الواجهة والتفاعل
   ============================================================================ */

/**
 * يرسل رسالة المستخدم الحالية: يعرضها، يعرض مؤشر الكتابة، ثم يعرض رد
 * المحرك المحلي بعد تأخير قصير محاكياً لواقعية "التفكير".
 * @returns {Promise<void>}
 */
async function sendMessage() {
  if (isThinking) return;
  const text = inputEl.value.trim();
  if (!text) return;

  inputEl.value = '';
  inputEl.style.height = 'auto';
  setThinking(true);

  // إزالة بطاقة الترحيب عند أول رسالة فعلية
  messagesEl.querySelector('.ai-welcome')?.remove();

  appendChatMessage('user', text);
  messagesEl.appendChild(buildMessageBubble('user', text));
  scrollToBottom();

  showTypingIndicator();
  await new Promise((resolve) => setTimeout(resolve, 550));
  document.getElementById('aiTypingIndicator')?.remove();

  const reply = answerFromKnowledge(text);
  appendChatMessage('assistant', reply);
  messagesEl.appendChild(buildMessageBubble('assistant', reply));
  scrollToBottom();

  setThinking(false);
}

/**
 * يُعيد توليد آخر رد من المساعد بناءً على آخر رسالة مستخدم في السجل.
 * @returns {void}
 */
function regenerateLastResponse() {
  const history = getState('chatHistory');
  const lastUserMessage = [...history].reverse().find((m) => m.role === 'user');
  if (!lastUserMessage) return;

  const reply = answerFromKnowledge(lastUserMessage.content);
  appendChatMessage('assistant', reply);
  messagesEl.appendChild(buildMessageBubble('assistant', reply));
  scrollToBottom();
  showToast('تم إعادة توليد الرد', 'success');
}

/**
 * يُحدّث حالة "المساعد يفكر" (تعطيل الإرسال أثناء الانتظار لمنع الإرسال المزدوج).
 * @param {boolean} thinking
 * @returns {void}
 */
function setThinking(thinking) {
  isThinking = thinking;
  sendBtn.disabled = thinking;
}

/**
 * يمسح كامل سجل المحادثة الحالي ويعيد عرض الشاشة الترحيبية.
 * @returns {void}
 */
function handleClearChat() {
  clearChatHistory();
  renderWelcomeOrHistory();
  showToast('تم مسح المحادثة');
}

/**
 * يُسجّل كل مستمعي الأحداث لواجهة المحادثة (تفويض + مستمعات مباشرة للإدخال).
 * @returns {void}
 */
function bindEvents() {
  sendBtn.addEventListener('click', sendMessage);

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // توسيع ارتفاع مربع النص تلقائياً مع الكتابة (حتى حد أقصى محدد في CSS)
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

    if (e.target.closest('#aiMicBtn')) {
      startVoiceInput();
    }
  });
}

/**
 * يُفعّل الإدخال الصوتي إن كان المتصفح يدعم Web Speech API (اختياري تماماً؛
 * لا يُكسر شيئاً في المتصفحات التي لا تدعمه لأن الزر لا يُبنى أصلاً هناك).
 * @returns {void}
 */
function startVoiceInput() {
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionCtor) return;

  const recognition = new SpeechRecognitionCtor();
  recognition.lang = 'ar-EG';
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    inputEl.value = transcript;
    inputEl.dispatchEvent(new Event('input'));
  };
  recognition.onerror = () => showToast('تعذّر التعرّف على الصوت', 'error');

  recognition.start();
  showToast('استمع الآن... تحدّث بوضوح', 'default', 2000);
}

registerView('ai', {
  onEnter: () => init()
});

// إعادة التصدير لإتاحة فتح مادة كيميائية من رد المساعد مستقبلاً إذا احتجنا
// ربط ردود المحادثة ببطاقات المواد الكيميائية مباشرة (رابط تفاعلي لاحقاً).
export { openChemicalById };
