/**
 * ============================================================================
 * fuzzy.js — مطابقة تقريبية (تسامح مع الأخطاء الإملائية)
 * ============================================================================
 * دوال نقية بلا DOM. تُستخدم في البحث بالمواد وفي محرك المساعد:
 * «سانكلور» ← SANICHLOR، «انفورز» ← ENFORCE.
 * ============================================================================
 */

/**
 * مسافة ليفنشتاين بين كلمتين (عدد الإدراج/الحذف/الاستبدال).
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const curr = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

/**
 * أقصى مسافة مقبولة حسب طول الكلمة: قصيرة = صارم (لتفادي الإيجابيات الكاذبة).
 * @param {number} length
 * @returns {number}
 */
export function maxTypos(length) {
  if (length < 5) return 0;
  if (length < 9) return 1;
  return 2;
}

/**
 * هل الكلمتان متقاربتان إملائياً؟ (يتطلب أول حرفين متطابقين تقريباً لتقليل الضجيج)
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function isFuzzyMatch(a, b) {
  const limit = maxTypos(Math.min(a.length, b.length));
  if (limit === 0) return a === b;
  if (Math.abs(a.length - b.length) > limit) return false;
  return levenshtein(a, b) <= limit;
}

/**
 * يعيد أقرب كلمة من قائمة لكلمة مُدخلة، أو null إن لم توجد مقاربة مقبولة.
 * @param {string} word
 * @param {Iterable<string>} candidates
 * @returns {string|null}
 */
export function closestWord(word, candidates) {
  let best = null;
  let bestDistance = Infinity;
  for (const c of candidates) {
    if (!isFuzzyMatch(word, c)) continue;
    const d = levenshtein(word, c);
    if (d < bestDistance) {
      best = c;
      bestDistance = d;
    }
  }
  return best;
}
