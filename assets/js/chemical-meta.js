/**
 * ============================================================================
 * chemical-meta.js — حوكمة محتوى المواد: تاريخ المراجعة ورابط صحيفة SDS
 * ============================================================================
 * بيانات وصفية منفصلة عن data.js عمداً: يملؤها مسؤول السلامة بعد مطابقة كل مادة
 * مع صحيفة SDS الرسمية من Ecolab، دون لمس المحتوى التشغيلي.
 *
 *  - lastReviewed: تاريخ المراجعة بصيغة 'YYYY-MM-DD'، أو null = لم تُراجع بعد.
 *  - sdsUrl: رابط https رسمي لصحيفة SDS، أو null.
 *
 * القيم الابتدائية null عن قصد: لا أدّعي مراجعة لم تحدث. تظهر البطاقة «لم تُراجع
 * بعد» حتى تُملأ هنا. التقرير: npm run report:review
 * ============================================================================
 */

/** عدد الأيام التي بعدها تُعتبر المراجعة قديمة. */
export const REVIEW_MAX_AGE_DAYS = 365;

/** @type {Record<number, {lastReviewed: string|null, sdsUrl: string|null}>} */
export const chemicalMeta = {
  1: { lastReviewed: null, sdsUrl: null },
  2: { lastReviewed: null, sdsUrl: null },
  3: { lastReviewed: null, sdsUrl: null },
  4: { lastReviewed: null, sdsUrl: null },
  5: { lastReviewed: null, sdsUrl: null },
  6: { lastReviewed: null, sdsUrl: null },
  7: { lastReviewed: null, sdsUrl: null },
  8: { lastReviewed: null, sdsUrl: null },
  9: { lastReviewed: null, sdsUrl: null },
  10: { lastReviewed: null, sdsUrl: null },
  11: { lastReviewed: null, sdsUrl: null },
  12: { lastReviewed: null, sdsUrl: null },
  13: { lastReviewed: null, sdsUrl: null },
  14: { lastReviewed: null, sdsUrl: null },
  15: { lastReviewed: null, sdsUrl: null },
  16: { lastReviewed: null, sdsUrl: null },
  17: { lastReviewed: null, sdsUrl: null },
  18: { lastReviewed: null, sdsUrl: null },
  19: { lastReviewed: null, sdsUrl: null },
  20: { lastReviewed: null, sdsUrl: null }
};

/**
 * يحدد حالة مراجعة مادة.
 * @param {{lastReviewed: string|null}|undefined} entry
 * @param {Date} [today]
 * @returns {{state: 'unreviewed'|'ok'|'stale', label: string}}
 */
export function reviewStatus(entry, today = new Date()) {
  if (!entry || !entry.lastReviewed) return { state: 'unreviewed', label: 'لم تُراجع مع صحيفة SDS بعد' };
  const reviewed = new Date(`${entry.lastReviewed}T00:00:00`);
  if (Number.isNaN(reviewed.getTime())) return { state: 'unreviewed', label: 'تاريخ المراجعة غير صالح' };
  const ageDays = Math.floor((today.getTime() - reviewed.getTime()) / 86_400_000);
  if (ageDays > REVIEW_MAX_AGE_DAYS) return { state: 'stale', label: `آخر مراجعة ${entry.lastReviewed} — تحتاج تجديداً` };
  return { state: 'ok', label: `آخر مراجعة: ${entry.lastReviewed}` };
}

/**
 * هل الرابط آمن للعرض (https فقط)؟
 * @param {string|null|undefined} url
 * @returns {boolean}
 */
export function isSafeSdsUrl(url) {
  return typeof url === 'string' && /^https:\/\/[^\s]+$/.test(url);
}
