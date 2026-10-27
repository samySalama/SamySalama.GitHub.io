/**
 * ============================================================================
 * temperature.js — حدود الحرارة وتصدير السجل (منطق نقي)
 * ============================================================================
 * الحدود منقولة من محتوى التطبيق نفسه (القاعدة 2 في القواعد الذهبية، وجدول
 * ماكينة الأطباق، ومبدأ HACCP الخامس). لا حدود جديدة هنا.
 * ============================================================================
 */

/**
 * @typedef {Object} TempKind
 * @property {string} id
 * @property {string} label
 * @property {string} rule - الحد بنص مقروء
 * @property {(t:number)=>boolean} isOk
 * @property {string} action - الإجراء التصحيحي عند الخروج عن الحد
 */

/** @type {TempKind[]} */
export const TEMP_KINDS = [
  {
    id: 'cold',
    label: 'ثلاجة (بارد)',
    rule: 'أقل من 5°م',
    isOk: (t) => t < 5,
    action: 'انقل الطعام فوراً لثلاجة سليمة وأبلغ المشرف الهندسي (مبدأ HACCP 5).'
  },
  {
    id: 'frozen',
    label: 'فريزر (مجمّد)',
    rule: '−16°م أو أبرد (المعيار −16 إلى −18°م)',
    isOk: (t) => t <= -16,
    action: 'أبلغ المشرف فوراً وراجع سلامة الأطعمة المجمّدة قبل استخدامها.'
  },
  {
    id: 'hot',
    label: 'حفظ ساخن',
    rule: 'أعلى من 60°م',
    isOk: (t) => t > 60,
    action: 'أعد تسخين الطعام أو استبعده وأبلغ المشرف.'
  },
  {
    id: 'rinse',
    label: 'ماكينة الأطباق — شطف نهائي',
    rule: '75 – 82°م',
    isOk: (t) => t >= 75 && t <= 82,
    action: 'أبلغ المشرف فوراً: أعلى من 82° يترك بقايا مادة التجفيف، وأقل من 75° لا يقتل البكتيريا كفاية.'
  },
  {
    id: 'wash',
    label: 'ماكينة الأطباق — غسيل كيميائي',
    rule: '55 – 65°م',
    isOk: (t) => t >= 55 && t <= 65,
    action: 'أبلغ المشرف فوراً: أعلى من 65° يترك بقايا منظف صعبة الإزالة وتلوثاً كيميائياً.'
  }
];

/** @param {string} id @returns {TempKind|undefined} */
export function getTempKind(id) {
  return TEMP_KINDS.find((k) => k.id === id);
}

/**
 * يحلّل قراءة حرارة (يقبل الأرقام العربية الهندية، والفاصلة العربية، وعلامة «−»).
 * @param {string} raw
 * @returns {number|null}
 */
export function parseTemperature(raw) {
  const normalized = String(raw ?? '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[٫,،]/g, '.')
    .replace(/[−–—]/g, '-')
    .trim();
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return value >= -60 && value <= 300 ? value : null;
}

/**
 * يقيّم قراءة مقابل حد نوعها.
 * @param {string} kindId
 * @param {number} temp
 * @returns {{ok: boolean, kind: TempKind}}
 */
export function evaluateReading(kindId, temp) {
  const kind = getTempKind(kindId);
  if (!kind) throw new Error(`نوع حرارة غير معروف: ${kindId}`);
  return { ok: kind.isOk(temp), kind };
}

/** يحمي خلايا CSV من حقن الصيغ (=,+,-,@ في أول النص) ويهرّب علامات الاقتباس. */
/** @param {unknown} value @returns {string} */
function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * @param {Date} date
 * @returns {string} YYYY-MM-DD HH:mm (توقيت محلي)
 */
export function formatDateTime(date) {
  /** @param {number} n */
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

/**
 * يبني ملف CSV (مع BOM ليفتح العربي سليماً في Excel).
 * @param {{ts:number,point:string,kind:string,temp:number,ok:boolean,note:string}[]} log
 * @returns {string}
 */
export function toCsv(log) {
  const header = ['التاريخ والوقت', 'النقطة', 'النوع', 'الحرارة (°م)', 'الحد', 'الحالة', 'ملاحظة'];
  const rows = log.map((r) => {
    const kind = getTempKind(r.kind);
    return [
      formatDateTime(new Date(r.ts)),
      r.point,
      kind?.label ?? r.kind,
      r.temp,
      kind?.rule ?? '',
      r.ok ? 'ضمن الحد' : 'خارج الحد',
      r.note
    ];
  });
  const body = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  return `\uFEFF${body}\r\n`;
}
