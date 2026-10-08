/**
 * ============================================================================
 * diagnostics.js — تشخيص الأخطاء محلياً (بلا خادم ولا بيانات شخصية)
 * ============================================================================
 * التطبيق ثابت بلا تتبّع عن بُعد (خصوصية مطلقة)، فلا سبيل لمعرفة أخطاء الموظفين
 * في الميدان. هذه الوحدة تحفظ آخر الأخطاء في localStorage فقط، ويستطيع الموظف
 * نسخ «تقرير تشخيص» من الإعدادات وإرساله لك بيده. التقرير لا يتضمن مفضلة ولا
 * محادثات ولا أي بيانات مستخدم — فقط الإصدار والبيئة ونصوص الأخطاء.
 * تُحمَّل أولاً في index.html لتلتقط أخطاء الإقلاع.
 * ============================================================================
 */

import { APP_VERSION } from './version.js';

const KEY = 'stewardApp:diagnostics';
const MAX_ERRORS = 30;

/** @returns {{ts:number,type:string,message:string,where:string}[]} */
export function getErrors() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function record(type, message, where = '') {
  try {
    const errors = [{ ts: Date.now(), type, message: String(message).slice(0, 300), where: String(where).slice(0, 200) }, ...getErrors()];
    localStorage.setItem(KEY, JSON.stringify(errors.slice(0, MAX_ERRORS)));
  } catch {
    /* التخزين ممتلئ أو معطّل — لا نكسر التطبيق بسبب أداة تشخيص */
  }
}

export function clearErrors() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* لا شيء */
  }
}

/**
 * يبني نص التقرير من مدخلات صريحة (قابل للاختبار بلا DOM).
 * @param {{version:string, errors:{ts:number,type:string,message:string,where:string}[], env:Record<string,string>}} input
 * @returns {string}
 */
export function buildReport({ version, errors, env }) {
  const lines = [
    `تقرير تشخيص — دليل الاستيوارد ${version}`,
    `وقت التقرير: ${new Date().toISOString()}`,
    ...Object.entries(env).map(([k, v]) => `${k}: ${v}`),
    '',
    errors.length ? `آخر ${errors.length} خطأ:` : 'لا أخطاء مسجّلة ✅'
  ];
  errors.forEach((e, i) => {
    lines.push(`${i + 1}) [${new Date(e.ts).toISOString()}] ${e.type}: ${e.message}${e.where ? ` @ ${e.where}` : ''}`);
  });
  return lines.join('\n');
}

/** تقرير التشخيص الحالي كنص جاهز للنسخ. */
export function getDiagnosticsReport() {
  return buildReport({
    version: APP_VERSION,
    errors: getErrors(),
    env: {
      'المتصفح': navigator.userAgent,
      'متصل بالإنترنت': String(navigator.onLine),
      'عامل الخدمة': 'serviceWorker' in navigator ? (navigator.serviceWorker.controller ? 'نشط' : 'غير مسيطر') : 'غير مدعوم',
      'الشاشة': `${window.innerWidth}×${window.innerHeight}`,
      'وضع التثبيت': window.matchMedia('(display-mode: standalone)').matches ? 'مثبّت' : 'متصفح'
    }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => record('error', e.message, `${e.filename?.split('/').pop() ?? ''}:${e.lineno ?? ''}`));
  window.addEventListener('unhandledrejection', (e) => record('promise', e.reason?.message ?? e.reason ?? 'unknown'));
}
