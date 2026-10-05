/**
 * ============================================================================
 * utils.js — دوال مساعدة عامة (Utilities)
 * ============================================================================
 * مسؤولية واحدة: دوال نقية (pure functions) وأدوات عامة يعاد استخدامها عبر
 * أكثر من ملف عرض واحد. لا يوجد هنا أي منطق خاص بصفحة معيّنة، ولا حالة
 * (state) خاصة بهذه الوحدة — فقط دوال بلا آثار جانبية (باستثناء دوال الـ UI
 * الصغيرة الموثقة صراحةً مثل showToast التي تتعامل مع الـ DOM مباشرة).
 * ============================================================================
 */

/**
 * يُطبّع نصاً عربياً/إنجليزياً للمقارنة والبحث: يُزيل التشكيل، يوحّد أشكال
 * الألف والياء والتاء المربوطة، ويحوّل لحروف صغيرة، ويُزيل المسافات الزائدة.
 * ضروري لأن البحث في المحتوى العربي يفشل بسهولة إن قارنّا النص حرفياً
 * (مثال: "انفورس" يجب أن تُطابق "إنفورس" و"أنفورس").
 * @param {string} text
 * @returns {string} النص بعد التطبيع.
 */
export function normalizeText(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, '')   // إزالة التشكيل (الحركات)
    .replace(/[أإآا]/g, 'ا')          // توحيد أشكال الألف
    .replace(/ى/g, 'ي')                // توحيد الألف المقصورة بالياء
    .replace(/ة/g, 'ه')                // توحيد التاء المربوطة بالهاء
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * يُعيد تسمية عربية مقروءة لمستوى خطورة المادة الكيميائية.
 * @param {'low'|'med'|'high'} danger
 * @returns {string}
 */
export function getDangerLabel(danger) {
  const labels = { low: 'منخفضة', med: 'متوسطة', high: 'عالية' };
  return labels[danger] ?? 'غير محددة';
}

/**
 * يُعيد اسم متغيّر CSS الدلالي المناسب لمستوى الخطورة (لربطه بالشرائط اللونية).
 * @param {'low'|'med'|'high'} danger
 * @returns {'safe'|'warning'|'danger'}
 */
export function getDangerVariant(danger) {
  const variants = { low: 'safe', med: 'warning', high: 'danger' };
  return variants[danger] ?? 'safe';
}

/**
 * يُنشئ عنصر DOM بسرعة مع خصائص وأبناء اختياريين، لتفادي تكرار
 * document.createElement + setAttribute يدوياً في كل مكان.
 * @param {string} tag - اسم الوسم (مثال: 'div').
 * @param {Object} [attrs] - خصائص/سمات HTML (class, id, aria-*, data-*, إلخ).
 * @param {(Node|string)[]} [children] - عناصر أو نصوص لإضافتها كأبناء.
 * @returns {HTMLElement}
 */
export function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value === undefined || value === null || value === false) return;
    if (key === 'class') {
      el.className = value;
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'html') {
      el.innerHTML = value; // يُستخدم فقط لمحتوى ثابت آمن (لا مدخلات مستخدم خام)
    } else {
      el.setAttribute(key, value);
    }
  });
  children.forEach((child) => {
    el.append(child instanceof Node ? child : document.createTextNode(child));
  });
  return el;
}

/**
 * يهرب أي محارف HTML خاصة من نص قبل إدراجه في innerHTML، لمنع أي خطر XSS
 * عند عرض نص أدخله المستخدم (مثال: رسائل المحادثة مع المساعد الذكي).
 * @param {string} text
 * @returns {string}
 */
export function escapeHTML(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

/**
 * يُحوّل نص Markdown بسيطاً جداً (عريض، مائل، أكواد، أسطر جديدة) لعناصر HTML.
 * مصمم خصيصاً لردود المساعد الذكي المحلي — ليس محلل Markdown كاملاً، فقط
 * الأنماط الأساسية التي يُنتجها منطق الإجابة في ai.js.
 * @param {string} text
 * @returns {string} HTML آمن (تم تهريب النص الخام أولاً).
 */
export function renderSimpleMarkdown(text) {
  let safe = escapeHTML(text);
  safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  safe = safe.replace(/`(.+?)`/g, '<code>$1</code>');
  safe = safe
    .split('\n\n')
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('');
  return safe;
}

let toastRegionEl = null;

/**
 * يعرض رسالة توست قصيرة العمر في أسفل الشاشة. يُنشئ حاوية التوست تلقائياً
 * عند أول استخدام إن لم تكن موجودة بالفعل في الصفحة.
 * @param {string} message
 * @param {'default'|'success'|'error'} [variant='default']
 * @param {number} [duration=2600] - مدة الظهور بالمللي ثانية.
 * @returns {void}
 */
export function showToast(message, variant = 'default', duration = 2600) {
  if (!toastRegionEl) {
    toastRegionEl = document.getElementById('toastRegion');
  }
  if (!toastRegionEl) return;

  const toast = createElement(
    'div',
    {
      class: `toast${variant !== 'default' ? ` toast--${variant}` : ''}`,
      role: 'status',
      'aria-live': 'polite'
    },
    [message]
  );
  toastRegionEl.appendChild(toast);

  // إطار واحد لضمان تطبيق الانتقال الحركي (transition) بدلاً من القفز المباشر للحالة النهائية
  requestAnimationFrame(() => toast.classList.add('toast--visible'));

  setTimeout(() => {
    toast.classList.remove('toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}

/**
 * ينسخ نصاً للحافظة، مع طريقة احتياطية للمتصفحات/السياقات التي لا تدعم
 * navigator.clipboard (مثال: صفحات غير آمنة أو متصفحات قديمة على الموبايل).
 * @param {string} text
 * @returns {Promise<boolean>} true عند نجاح النسخ.
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    throw new Error('Clipboard API غير متاحة');
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * يُؤخّر استدعاء دالة حتى يتوقف المستخدم عن الكتابة/التفاعل لمدة معيّنة —
 * يُستخدم لحقول البحث لتفادي إعادة الترشيح مع كل ضغطة مفتاح (تقليل reflow).
 * @template {(...args: any[]) => void} F
 * @param {F} fn
 * @param {number} [delay=200]
 * @returns {F}
 */
export function debounce(fn, delay = 200) {
  let timeoutId;
  return function debounced(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * يُنشئ معرّفاً فريداً بسيطاً (لعناصر DOM المُولّدة ديناميكياً التي تحتاج id
 * لأغراض aria-controls / aria-labelledby).
 * @param {string} [prefix='id']
 * @returns {string}
 */
export function generateId(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * يُنسّق طابعاً زمنياً (timestamp) بصيغة وقت قصيرة مقروءة بالعربية (مثال: ٠٣:٤٥ م).
 * @param {number} timestamp
 * @returns {string}
 */
export function formatTime(timestamp) {
  return new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(timestamp)
  );
}

/**
 * يفحص ما إذا كان التطبيق يعمل حالياً بدون اتصال بالإنترنت.
 * @returns {boolean}
 */
export function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * يُبدّل حالة توسيع/طي عنصر قابل للطي بنمط CSS Grid (0fr↔1fr) المستخدم في
 * كل من بطاقات المواد الكيميائية (.card__body) وأكورديون التعليم
 * (.accordion__body). استُخرج هذا المنطق هنا بعد تدقيق الكود لأن كلا
 * الملفين كانا يكرران نفس خمسة أسطر (تحديث aria-expanded + data-open) —
 * تغيير واحد هنا يكفي الآن لتحديث سلوك كل عناصر الطي/التوسيع في التطبيق.
 * @param {HTMLElement} triggerEl - الزر الذي يحمل aria-expanded (المُشغِّل).
 * @param {HTMLElement} bodyEl - العنصر القابل للطي الذي يحمل data-open.
 * @param {boolean} [forceState] - إجبار حالة معيّنة بدلاً من التبديل التلقائي.
 * @returns {boolean} الحالة الجديدة بعد التبديل (true = مفتوح).
 */
export function toggleExpandable(triggerEl, bodyEl, forceState) {
  const nowExpanded = forceState ?? triggerEl.getAttribute('aria-expanded') !== 'true';
  triggerEl.setAttribute('aria-expanded', String(nowExpanded));
  bodyEl.dataset.open = String(nowExpanded);
  return nowExpanded;
}
