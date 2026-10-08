/**
 * scripts/review-report.mjs — تقرير حوكمة المحتوى
 * ============================================================================
 * يعرض المواد التي لم تُراجَع مع صحيفة SDS أو انتهت صلاحية مراجعتها، ومن بلا
 * رابط SDS. لا يُفشل CI عمداً (كل المواد «لم تُراجع» في البداية) — خطوة CI تعرضه
 * في ملخص التشغيل ليراه مسؤول السلامة. أضف --strict لإفشاله عند وجود نقص.
 * الاستخدام: npm run report:review [-- --strict]
 * ============================================================================
 */
import { chemicals } from '../assets/js/data.js';
import { chemicalMeta, reviewStatus, isSafeSdsUrl } from '../assets/js/chemical-meta.js';

const strict = process.argv.includes('--strict');
const rows = chemicals.map((c) => {
  const meta = chemicalMeta[c.id];
  return { c, status: reviewStatus(meta), hasSds: isSafeSdsUrl(meta?.sdsUrl) };
});

const unreviewed = rows.filter((r) => r.status.state === 'unreviewed');
const stale = rows.filter((r) => r.status.state === 'stale');
const noSds = rows.filter((r) => !r.hasSds);

console.log('## تقرير مراجعة محتوى المواد الكيميائية\n');
console.log(`- لم تُراجع: ${unreviewed.length}/${chemicals.length}`);
console.log(`- مراجعة قديمة (> سنة): ${stale.length}`);
console.log(`- بلا رابط SDS: ${noSds.length}\n`);
for (const r of rows.filter((x) => x.status.state !== 'ok' || !x.hasSds)) {
  console.log(`- [${r.c.id}] ${r.c.nameEn}: ${r.status.label}${r.hasSds ? '' : ' | بلا SDS'}`);
}

if (strict && (unreviewed.length || stale.length || noSds.length)) process.exit(1);
