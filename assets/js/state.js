/**
 * ============================================================================
 * state.js — إدارة حالة التطبيق المركزية
 * ============================================================================
 * مسؤولية واحدة: امتلاك حالة التطبيق (State) وحفظها في localStorage،
 * وإشعار أي جزء من التطبيق مهتم بالتغييرات (Pub/Sub بسيط).
 *
 * لا يوجد أي متغير عام (global variable) هنا — كل الحالة محفوظة داخل
 * إغلاق (closure) للوحدة، ولا يمكن الوصول إليها إلا عبر الدوال المُصدَّرة
 * (getState, setState, subscribe). هذا يمنع أي كود آخر من تعديل الحالة
 * مباشرة أو بشكل غير متوقع، ويجعل مصدر التغيير دائماً واضحاً وقابلاً للتتبع.
 * ============================================================================
 */

const STORAGE_KEY = 'stewardApp:v2:state';

/**
 * الحالة الافتراضية عند أول استخدام للتطبيق (لا يوجد بيانات محفوظة بعد).
 * @type {Object}
 */
const DEFAULT_STATE = {
  // -- تفضيلات العرض --
  theme: 'dark',        // 'dark' | 'light'
  fontSize: 'medium',   // 'small' | 'medium' | 'large' | 'xlarge'
  reducedMotion: false, // تفضيل إضافي فوق prefers-reduced-motion للنظام

  // -- المفضلة والتنقل --
  favoriteChemicalIds: /** @type {number[]} */ ([]),
  recentChemicalIds: /** @type {number[]} */ ([]),
  recentViews: /** @type {string[]} */ ([]),

  // -- تقدم التعليم (Academy) --
  completedModuleIds: /** @type {string[]} */ ([]),
  quizScores: /** @type {Record<string, {score:number,total:number,completedAt:string}>} */ ({}),
  unlockedAchievementIds: /** @type {string[]} */ ([]),

  // -- المساعد الذكي --
  chatHistory: /** @type {{role:string,content:string,ts:number}[]} */ ([]),

  // -- بيانات عامة --
  lastActiveView: 'dashboard',
  installPromptDismissed: false
};

/** الحالة الحيّة أثناء تشغيل التطبيق (تبدأ كنسخة من الافتراضي). */
let state = structuredClone(DEFAULT_STATE);

/** قائمة المشتركين الذين يجب إشعارهم عند أي تغيير في الحالة. */
const subscribers = new Set();

/**
 * يحمّل الحالة المحفوظة من localStorage ويدمجها فوق الحالة الافتراضية.
 * الدمج (بدلاً من الاستبدال الكامل) يضمن أن أي حقل جديد أُضيف في تحديث
 * لاحق للتطبيق يحصل على قيمة افتراضية سليمة حتى لو كانت بيانات المستخدم
 * القديمة لا تحتوي عليه.
 * @returns {void}
 */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    state = { ...structuredClone(DEFAULT_STATE), ...saved };
  } catch (err) {
    // بيانات تالفة أو localStorage غير متاح (وضع خاص/متصفح قديم) — نُكمل بالحالة الافتراضية
    console.warn('[state] تعذّر تحميل الحالة المحفوظة، سيتم استخدام القيم الافتراضية.', err);
  }
}

/**
 * يحفظ الحالة الحالية في localStorage. يُستدعى تلقائياً بعد كل setState.
 * @returns {void}
 */
function persistToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    // مساحة التخزين ممتلئة أو غير متاحة — لا نُفشل التطبيق، فقط نُسجّل تحذيراً
    console.warn('[state] تعذّر حفظ الحالة — التغييرات لن تدوم بعد إعادة التحميل.', err);
  }
}

/**
 * يُعيد نسخة للقراءة فقط من الحالة الحالية بالكامل، أو حقل واحد إن حُدّد مفتاح.
 * إرجاع نسخة (وليس المرجع الأصلي) يمنع أي كود مستهلك من تعديل الحالة
 * مباشرة متجاوزاً setState، وهو ما يكسر آلية الإشعار بالتغييرات.
 * @param {string} [key] - مفتاح اختياري لحقل محدد من الحالة.
 * @returns {*} كامل الحالة أو قيمة الحقل المطلوب.
 */
export function getState(key) {
  const snapshot = structuredClone(state);
  return key === undefined ? snapshot : snapshot[key];
}

/**
 * يُحدّث حقلاً أو أكثر من الحالة، يحفظها في localStorage، ثم يُشعر كل
 * المشتركين بالتغيير. هذه هي الطريقة الوحيدة المسموح بها لتعديل الحالة.
 * @param {Object} partialState - كائن يحتوي الحقول المراد تحديثها فقط.
 * @returns {void}
 */
export function setState(partialState) {
  state = { ...state, ...partialState };
  persistToStorage();
  notifySubscribers(Object.keys(partialState));
}

/**
 * يشترك مستمعاً ليُستدعى عند أي تغيير في الحالة.
 * @param {(changedKeys: string[]) => void} callback - يُستدعى مع مفاتيح الحقول التي تغيّرت.
 * @returns {() => void} دالة لإلغاء الاشتراك.
 */
export function subscribe(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

/**
 * يُشعر كل المشتركين بأن حقولاً معيّنة قد تغيّرت.
 * @param {string[]} changedKeys
 * @returns {void}
 */
function notifySubscribers(changedKeys) {
  subscribers.forEach((callback) => {
    try {
      callback(changedKeys);
    } catch (err) {
      console.error('[state] خطأ داخل أحد المشتركين في تغييرات الحالة:', err);
    }
  });
}

/* ============================================================================
   دوال مساعدة عالية المستوى (High-Level Helpers)
   ============================================================================
   هذه الدوال تُغلّف أنماط تحديث شائعة (تبديل مفضلة، إضافة لعنصر أخيراً..)
   حتى لا تتكرر منطق "أضف/احذف من مصفوفة" في كل ملف واجهة يستخدم الحالة.
   ============================================================================ */

/** الحد الأقصى لعدد العناصر المحفوظة في قوائم "الأخيرة" لمنع تضخم localStorage. */
const RECENT_LIMIT = 8;
/** الحد الأقصى لعدد الرسائل المحفوظة في محادثة الذكاء الاصطناعي. */
const CHAT_HISTORY_LIMIT = 40;

/**
 * يُبدّل حالة "مفضلة" لمادة كيميائية معيّنة (إضافة إن لم تكن موجودة، حذف إن كانت).
 * @param {number} chemicalId
 * @returns {boolean} الحالة الجديدة (true = أصبحت مفضلة).
 */
export function toggleFavoriteChemical(chemicalId) {
  const current = getState('favoriteChemicalIds');
  const isFavorite = current.includes(chemicalId);
  const next = isFavorite
    ? current.filter((id) => id !== chemicalId)
    : [...current, chemicalId];
  setState({ favoriteChemicalIds: next });
  return !isFavorite;
}

/**
 * يُسجّل مادة كيميائية في قائمة "شوهد مؤخراً"، مع نقلها للمقدمة إن كانت موجودة.
 * @param {number} chemicalId
 * @returns {void}
 */
export function recordRecentChemical(chemicalId) {
  const current = getState('recentChemicalIds');
  const next = [chemicalId, ...current.filter((id) => id !== chemicalId)].slice(0, RECENT_LIMIT);
  setState({ recentChemicalIds: next });
}

/**
 * يُسجّل زيارة عرض (view) في سجل التنقل الأخير.
 * @param {string} viewName
 * @returns {void}
 */
export function recordRecentView(viewName) {
  const current = getState('recentViews');
  const next = [viewName, ...current.filter((v) => v !== viewName)].slice(0, RECENT_LIMIT);
  setState({ recentViews: next, lastActiveView: viewName });
}

/**
 * يُضيف رسالة جديدة لسجل محادثة الذكاء الاصطناعي، مع تقليم السجل عند تجاوز الحد.
 * @param {'user'|'assistant'} role
 * @param {string} content
 * @returns {void}
 */
export function appendChatMessage(role, content) {
  const current = getState('chatHistory');
  const next = [...current, { role, content, ts: Date.now() }].slice(-CHAT_HISTORY_LIMIT);
  setState({ chatHistory: next });
}

/**
 * يمسح سجل محادثة الذكاء الاصطناعي بالكامل.
 * @returns {void}
 */
export function clearChatHistory() {
  setState({ chatHistory: [] });
}

/**
 * يُعلّم وحدة تعليمية كمكتملة، ويُعيد قائمة أي إنجازات (achievements) جديدة
 * تم فتحها نتيجة لذلك (يُحسب في achievements.js عادةً، هنا فقط تسجيل الإكمال).
 * @param {string} moduleId
 * @returns {void}
 */
export function markModuleCompleted(moduleId) {
  const current = getState('completedModuleIds');
  if (current.includes(moduleId)) return;
  setState({ completedModuleIds: [...current, moduleId] });
}

/**
 * يحفظ نتيجة اختبار (quiz) لوحدة تعليمية معيّنة.
 * @param {string} moduleId
 * @param {number} score
 * @param {number} total
 * @returns {void}
 */
export function saveQuizScore(moduleId, score, total) {
  const current = getState('quizScores');
  setState({
    quizScores: {
      ...current,
      [moduleId]: { score, total, completedAt: new Date().toISOString() }
    }
  });
}

/**
 * يفتح إنجازاً (achievement) جديداً إن لم يكن مفتوحاً بالفعل.
 * @param {string} achievementId
 * @returns {boolean} true إذا كان هذا أول فتح فعلي (وليس مكرراً).
 */
export function unlockAchievement(achievementId) {
  const current = getState('unlockedAchievementIds');
  if (current.includes(achievementId)) return false;
  setState({ unlockedAchievementIds: [...current, achievementId] });
  return true;
}

/**
 * يُعيد تصفير كل بيانات المستخدم للحالة الافتراضية (زر "إعادة الضبط" بالإعدادات).
 * @returns {void}
 */
export function resetAllData() {
  state = structuredClone(DEFAULT_STATE);
  persistToStorage();
  notifySubscribers(Object.keys(DEFAULT_STATE));
}

/**
 * يُصدّر كامل حالة المستخدم كنص JSON (لزر "تصدير البيانات" بالإعدادات).
 * @returns {string}
 */
export function exportStateAsJSON() {
  return JSON.stringify(state, null, 2);
}

/**
 * يستورد حالة من نص JSON (زر "استيراد البيانات")، مع التحقق الأساسي من الشكل
 * قبل الاستبدال لتفادي إفساد الحالة ببيانات غير صالحة.
 * @param {string} jsonText
 * @returns {{success: boolean, error?: string}}
 */
export function importStateFromJSON(jsonText) {
  try {
    const parsed = JSON.parse(jsonText);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { success: false, error: 'صيغة الملف غير صالحة.' };
    }
    state = { ...structuredClone(DEFAULT_STATE), ...parsed };
    persistToStorage();
    notifySubscribers(Object.keys(DEFAULT_STATE));
    return { success: true };
  } catch (err) {
    return { success: false, error: 'تعذّر قراءة الملف — تأكد أنه ملف تصدير صالح.' };
  }
}

// تحميل الحالة المحفوظة فور استيراد هذه الوحدة لأول مرة في التطبيق.
loadFromStorage();
