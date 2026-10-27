/**
 * ============================================================================
 * state.js — إدارة حالة التطبيق المركزية
 * ============================================================================
 * مسؤولية واحدة: امتلاك الحالة وحفظها في localStorage وإشعار المشتركين (Pub/Sub).
 * كل الحالة داخل closure ولا تُعدَّل إلا عبر الدوال المُصدَّرة.
 *
 * v2.3: مفاتيح جديدة — checklistProgress (تقدّم القوائم حسب اليوم)،
 * temperatureLog (سجل الحرارة)، learnerName (اسم الشهادة).
 * ============================================================================
 */

const STORAGE_KEY = 'stewardApp:v2:state';

/** @type {Object} */
const DEFAULT_STATE = {
  theme: 'dark',
  fontSize: 'medium',
  reducedMotion: false,

  favoriteChemicalIds: /** @type {number[]} */ ([]),
  recentChemicalIds: /** @type {number[]} */ ([]),
  recentViews: /** @type {string[]} */ ([]),

  completedModuleIds: /** @type {string[]} */ ([]),
  quizScores: /** @type {Record<string, {score:number,total:number,completedAt:string}>} */ ({}),
  unlockedAchievementIds: /** @type {string[]} */ ([]),

  chatHistory: /** @type {{role:string,content:string,ts:number}[]} */ ([]),

  // -- السجلات التشغيلية (v2.3) --
  /** تقدّم قوائم الوردية: { 'YYYY-MM-DD': { morning: [0,2], deep: [] } } */
  checklistProgress: /** @type {Record<string, Record<string, number[]>>} */ ({}),
  /** سجل الحرارة: الأحدث أولاً */
  temperatureLog: /** @type {{id:string,ts:number,point:string,kind:string,temp:number,ok:boolean,note:string}[]} */ ([]),
  learnerName: '',

  lastActiveView: 'dashboard',
  installPromptDismissed: false
};

let state = structuredClone(DEFAULT_STATE);
const subscribers = new Set();

/** يحمّل الحالة المحفوظة ويدمجها فوق الافتراضية (حقول جديدة تحصل على قيمها). */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    state = { ...structuredClone(DEFAULT_STATE), ...saved };
  } catch (err) {
    console.warn('[state] تعذّر تحميل الحالة المحفوظة، سيتم استخدام القيم الافتراضية.', err);
  }
}

function persistToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[state] تعذّر حفظ الحالة — التغييرات لن تدوم بعد إعادة التحميل.', err);
  }
}

/**
 * نسخة للقراءة فقط من الحالة (كاملة أو حقل واحد).
 * @param {string} [key]
 * @returns {*}
 */
export function getState(key) {
  const snapshot = structuredClone(state);
  return key === undefined ? snapshot : snapshot[key];
}

/**
 * يحدّث حقلاً أو أكثر، يحفظ، ثم يُشعر المشتركين.
 * @param {Object} partialState
 * @returns {void}
 */
export function setState(partialState) {
  state = { ...state, ...partialState };
  persistToStorage();
  notifySubscribers(Object.keys(partialState));
}

/**
 * @param {(changedKeys: string[]) => void} callback
 * @returns {() => void} دالة إلغاء الاشتراك
 */
export function subscribe(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

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
   دوال مساعدة عالية المستوى
   ============================================================================ */

const RECENT_LIMIT = 8;
const CHAT_HISTORY_LIMIT = 40;
/** أقصى عدد قراءات حرارة محفوظة، وعدد الأيام المحتفظ بها لتقدّم القوائم. */
export const TEMP_LOG_LIMIT = 500;
export const CHECKLIST_KEEP_DAYS = 14;

/** @param {number} chemicalId @returns {boolean} true = أصبحت مفضلة */
export function toggleFavoriteChemical(chemicalId) {
  const current = getState('favoriteChemicalIds');
  const isFavorite = current.includes(chemicalId);
  const next = isFavorite ? current.filter((id) => id !== chemicalId) : [...current, chemicalId];
  setState({ favoriteChemicalIds: next });
  return !isFavorite;
}

/** @param {number} chemicalId */
export function recordRecentChemical(chemicalId) {
  const current = getState('recentChemicalIds');
  setState({ recentChemicalIds: [chemicalId, ...current.filter((id) => id !== chemicalId)].slice(0, RECENT_LIMIT) });
}

/** @param {string} viewName */
export function recordRecentView(viewName) {
  const current = getState('recentViews');
  setState({ recentViews: [viewName, ...current.filter((v) => v !== viewName)].slice(0, RECENT_LIMIT), lastActiveView: viewName });
}

/** @param {'user'|'assistant'} role @param {string} content */
export function appendChatMessage(role, content) {
  const current = getState('chatHistory');
  setState({ chatHistory: [...current, { role, content, ts: Date.now() }].slice(-CHAT_HISTORY_LIMIT) });
}

export function clearChatHistory() {
  setState({ chatHistory: [] });
}

/** @param {string} moduleId */
export function markModuleCompleted(moduleId) {
  const current = getState('completedModuleIds');
  if (current.includes(moduleId)) return;
  setState({ completedModuleIds: [...current, moduleId] });
}

/** @param {string} moduleId @param {number} score @param {number} total */
export function saveQuizScore(moduleId, score, total) {
  const current = getState('quizScores');
  setState({ quizScores: { ...current, [moduleId]: { score, total, completedAt: new Date().toISOString() } } });
}

/** @param {string} achievementId @returns {boolean} true إذا كان أول فتح */
export function unlockAchievement(achievementId) {
  const current = getState('unlockedAchievementIds');
  if (current.includes(achievementId)) return false;
  setState({ unlockedAchievementIds: [...current, achievementId] });
  return true;
}

/* -- قوائم الوردية -- */

/**
 * تاريخ اليوم المحلي بصيغة YYYY-MM-DD (لا UTC، حتى لا ينقلب اليوم منتصف الليل بتوقيت القاهرة).
 * @param {Date} [date]
 * @returns {string}
 */
export function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * يبدّل تأشير بند في قائمة اليوم ويُنظّف الأيام القديمة.
 * @param {string} listId
 * @param {number} itemIndex
 * @param {string} [dateKey]
 * @returns {boolean} true = أصبح مؤشَّراً
 */
export function toggleChecklistItem(listId, itemIndex, dateKey = localDateKey()) {
  const all = getState('checklistProgress');
  const day = all[dateKey] ?? {};
  const done = new Set(day[listId] ?? []);
  const nowChecked = !done.has(itemIndex);
  if (nowChecked) done.add(itemIndex);
  else done.delete(itemIndex);

  const next = { ...all, [dateKey]: { ...day, [listId]: [...done].sort((a, b) => a - b) } };
  const keep = Object.keys(next).sort().slice(-CHECKLIST_KEEP_DAYS);
  setState({ checklistProgress: Object.fromEntries(keep.map((k) => [k, next[k]])) });
  return nowChecked;
}

/** @param {string} listId @param {string} [dateKey] */
export function resetChecklist(listId, dateKey = localDateKey()) {
  const all = getState('checklistProgress');
  setState({ checklistProgress: { ...all, [dateKey]: { ...(all[dateKey] ?? {}), [listId]: [] } } });
}

/* -- سجل الحرارة -- */

/**
 * @param {{point:string,kind:string,temp:number,ok:boolean,note?:string}} entry
 * @returns {void}
 */
export function addTemperatureReading(entry) {
  const record = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
    point: entry.point,
    kind: entry.kind,
    temp: entry.temp,
    ok: entry.ok,
    note: entry.note ?? ''
  };
  setState({ temperatureLog: [record, ...getState('temperatureLog')].slice(0, TEMP_LOG_LIMIT) });
}

/** @param {string} id */
export function deleteTemperatureReading(id) {
  setState({ temperatureLog: getState('temperatureLog').filter((r) => r.id !== id) });
}

export function clearTemperatureLog() {
  setState({ temperatureLog: [] });
}

/** @param {string} name */
export function setLearnerName(name) {
  setState({ learnerName: String(name).trim().slice(0, 60) });
}

export function resetAllData() {
  state = structuredClone(DEFAULT_STATE);
  persistToStorage();
  notifySubscribers(Object.keys(DEFAULT_STATE));
}

/** @returns {string} */
export function exportStateAsJSON() {
  return JSON.stringify(state, null, 2);
}

/**
 * يستورد حالة من JSON مع تحقق أساسي من الشكل.
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
  } catch {
    return { success: false, error: 'تعذّر قراءة الملف — تأكد أنه ملف تصدير صالح.' };
  }
}

loadFromStorage();
