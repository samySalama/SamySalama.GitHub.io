/**
 * scripts/patch-data.mjs — يطبّق تصحيح السلامة على data.js تلقائياً.
 * الاستخدام:  node scripts/patch-data.mjs
 * آمن لإعادة التشغيل: إن كان التصحيح مطبَّقاً يخرج دون تغيير.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../assets/js/data.js', import.meta.url);
const WRONG = 'عند إضافة كيماوي للماء: أضف الماء البارد للكيماوي — لا العكس أبداً';
const RIGHT = 'عند تحضير محلول من كيماوي مركّز: أضف الكيماوي إلى الماء — لا الماء إلى الكيماوي';

const text = readFileSync(FILE, 'utf8');
if (text.includes(RIGHT)) {
  console.log('✓ التصحيح مطبَّق مسبقاً.');
} else if (text.includes(WRONG)) {
  writeFileSync(FILE, text.replace(WRONG, RIGHT));
  console.log('✓ تم تصحيح نص الاحتياط في data.js — راجعه مع صحيفة SDS ومسؤول السلامة.');
} else {
  console.error('✗ لم أجد النص المتوقع في data.js؛ راجع الملف يدوياً.');
  process.exit(1);
}
