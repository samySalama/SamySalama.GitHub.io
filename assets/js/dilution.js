/**
 * ============================================================================
 * dilution.js — حاسبة التخفيف (منطق نقي + مواصفات منظَّمة)
 * ============================================================================
 * لا أرقام جديدة هنا: كل مواصفة هي ترجمة حرفية لنص التخفيف الموجود في data.js
 * (حقل source). اختبار آلي يتحقق أن source يطابق نص data.js تماماً، فإذا تغيّر
 * نص المادة هناك ولم تُحدَّث المواصفة هنا يفشل الاختبار بدل أن تعرض الحاسبة رقماً قديماً.
 *
 * تقتصر على المواد ذات التخفيف اليدوي بمل/لتر. المواد التي تُحقن تلقائياً أو
 * وحدتها ملعقة/قرص لا تدخل (لا حاسبة أفضل من حاسبة خاطئة).
 * ============================================================================
 */

export const MIN_LITERS = 0.1;
export const MAX_LITERS = 1000;

/**
 * @typedef {Object} DilutionSpec
 * @property {number} id - معرّف المادة في data.js
 * @property {number} minMl - أقل كمية منتج (مل)
 * @property {number} maxMl - أكبر كمية منتج (مل)
 * @property {number} perLiters - لكم لتر من المحلول تُحسب الكمية
 * @property {string} source - نص التخفيف الحرفي من data.js
 */

/** @type {DilutionSpec[]} */
export const DILUTION_SPECS = [
  { id: 3, minMl: 10, maxMl: 20, perLiters: 10, source: '10–20 مل لكل 10 لتر ماء' },
  { id: 7, minMl: 2, maxMl: 5, perLiters: 1, source: '2–5 مل / لتر ماء' },
  { id: 8, minMl: 10, maxMl: 30, perLiters: 1, source: '10–30 مل / لتر حسب نوع الاستخدام' },
  { id: 9, minMl: 5, maxMl: 10, perLiters: 10, source: '50–100 ppm ≈ 5–10 مل / 10 لتر' },
  { id: 10, minMl: 30, maxMl: 60, perLiters: 5, source: '30–60 مل / 5 لتر ماء' },
  { id: 19, minMl: 5, maxMl: 10, perLiters: 1, source: '5–10 مل / لتر ماء' }
];

/**
 * @param {number} chemId
 * @returns {DilutionSpec|undefined}
 */
export function getDilutionSpec(chemId) {
  return DILUTION_SPECS.find((s) => s.id === chemId);
}

/**
 * يحسب نطاق كمية المنتج لحجم محلول معيّن.
 * @param {DilutionSpec} spec
 * @param {number} liters
 * @returns {{minMl: number, maxMl: number}}
 */
export function computeDilution(spec, liters) {
  const factor = liters / spec.perLiters;
  return { minMl: spec.minMl * factor, maxMl: spec.maxMl * factor };
}

/**
 * يحوّل المل إلى نص مقروء (لترات عند 1000 مل فأكثر، وبدون كسور زائدة).
 * @param {number} ml
 * @returns {string}
 */
export function formatMl(ml) {
  if (ml >= 1000) return `${trim(ml / 1000)} لتر`;
  return `${trim(ml)} مل`;
}

/** @param {number} n */
function trim(n) {
  return String(Number(n.toFixed(1)));
}

/**
 * يحلّل مُدخل المستخدم (يقبل الأرقام العربية الهندية والفاصلة العربية).
 * @param {string} raw
 * @returns {number|null} عدد اللترات أو null إن كان غير صالح
 */
export function parseLiters(raw) {
  const western = String(raw ?? '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[٫,،]/g, '.')
    .trim();
  if (!/^\d*\.?\d+$/.test(western)) return null;
  const value = Number(western);
  return value >= MIN_LITERS && value <= MAX_LITERS ? value : null;
}

/**
 * نص النتيجة الكامل لعرضه تحت حقل الإدخال.
 * @param {number} chemId
 * @param {string} rawLiters
 * @returns {string}
 */
export function describeDilution(chemId, rawLiters) {
  const spec = getDilutionSpec(chemId);
  if (!spec) return '';
  if (String(rawLiters ?? '').trim() === '') return 'أدخل عدد اللترات المطلوب تحضيرها';

  const liters = parseLiters(rawLiters);
  if (liters === null) return `أدخل رقماً بين ${MIN_LITERS} و${MAX_LITERS} لتر`;

  const { minMl, maxMl } = computeDilution(spec, liters);
  return `لتحضير ${trim(liters)} لتر: ${formatMl(minMl)} – ${formatMl(maxMl)} من المنتج، ثم ماء حتى ${trim(liters)} لتر`;
}
