import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levenshtein, isFuzzyMatch, closestWord, maxTypos } from '../../assets/js/fuzzy.js';
import { DILUTION_SPECS, computeDilution, describeDilution, parseLiters, formatMl, getDilutionSpec } from '../../assets/js/dilution.js';
import { TEMP_KINDS, evaluateReading, parseTemperature, toCsv } from '../../assets/js/temperature.js';
import { reviewStatus, isSafeSdsUrl, chemicalMeta } from '../../assets/js/chemical-meta.js';
import { checklists, checklistToText } from '../../assets/js/checklists.js';
import { buildReport } from '../../assets/js/diagnostics.js';
import { chemicals } from '../../assets/js/data.js';
import { answer } from '../../assets/js/assistant-engine.js';
import {
  localDateKey, toggleChecklistItem, getState, addTemperatureReading, resetAllData, TEMP_LOG_LIMIT, CHECKLIST_KEEP_DAYS, resetChecklist
} from '../../assets/js/state.js';

/* ---------------- fuzzy ---------------- */
test('fuzzy: ليفنشتاين وحدود الأخطاء', () => {
  assert.equal(levenshtein('سانكلور', 'سانيكلور'), 1);
  assert.equal(maxTypos(4), 0);
  assert.equal(maxTypos(6), 1);
  assert.equal(maxTypos(10), 2);
  assert.ok(isFuzzyMatch('سانكلور', 'سانيكلور'));
  assert.ok(!isFuzzyMatch('بقع', 'بصل'), 'الكلمات القصيرة تُطابق حرفياً فقط');
  assert.equal(closestWord('enforse', ['enforce', 'oasis']), 'enforce');
  assert.equal(closestWord('xyz', ['enforce']), null);
});

/* ---------------- dilution ---------------- */
test('dilution: كل مواصفة تطابق نص التخفيف في data.js حرفياً (منع الانجراف)', () => {
  for (const spec of DILUTION_SPECS) {
    const chem = chemicals.find((c) => c.id === spec.id);
    assert.ok(chem, `المادة ${spec.id} غير موجودة`);
    assert.equal(chem.dilution, spec.source, `نص تخفيف ${chem.nameEn} تغيّر — حدّث dilution.js`);
    assert.ok(spec.minMl > 0 && spec.maxMl >= spec.minMl && spec.perLiters > 0);
  }
});

test('dilution: الحساب والتنسيق', () => {
  const enforce = getDilutionSpec(10); // 30–60 مل / 5 لتر
  assert.deepEqual(computeDilution(enforce, 10), { minMl: 60, maxMl: 120 });
  assert.deepEqual(computeDilution(getDilutionSpec(7), 0.5), { minMl: 1, maxMl: 2.5 });
  assert.equal(formatMl(1500), '1.5 لتر');
  assert.equal(formatMl(2.5), '2.5 مل');
  assert.match(describeDilution(10, '10'), /60 مل – 120 مل/);
});

test('dilution: مدخلات المستخدم (أرقام عربية، فاصلة، قيم سيئة)', () => {
  assert.equal(parseLiters('١٠'), 10);
  assert.equal(parseLiters('2,5'), 2.5);
  assert.equal(parseLiters('٢٫٥'), 2.5);
  assert.equal(parseLiters(''), null);
  assert.equal(parseLiters('abc'), null);
  assert.equal(parseLiters('-3'), null);
  assert.equal(parseLiters('0'), null);
  assert.equal(parseLiters('100000'), null);
  assert.match(describeDilution(10, 'abc'), /أدخل رقماً/);
  assert.equal(describeDilution(1, '5'), '', 'مادة بلا مواصفة لا تُعرض لها حاسبة');
});

/* ---------------- temperature ---------------- */
test('temperature: الحدود تطابق محتوى التطبيق', () => {
  const ok = (kind, t) => evaluateReading(kind, t).ok;
  assert.ok(ok('cold', 4.9) && !ok('cold', 5) && !ok('cold', 8));
  assert.ok(ok('frozen', -18) && ok('frozen', -16) && !ok('frozen', -15));
  assert.ok(ok('hot', 61) && !ok('hot', 60));
  assert.ok(ok('rinse', 75) && ok('rinse', 82) && !ok('rinse', 83) && !ok('rinse', 74));
  assert.ok(ok('wash', 55) && ok('wash', 65) && !ok('wash', 66));
  assert.throws(() => evaluateReading('nope', 1));
  assert.equal(TEMP_KINDS.length, 5);
});

test('temperature: قراءة المُدخل (سالب، عربي، رموز)', () => {
  assert.equal(parseTemperature('-18'), -18);
  assert.equal(parseTemperature('−18'), -18);
  assert.equal(parseTemperature('٣٫٥'), 3.5);
  assert.equal(parseTemperature('3,5'), 3.5);
  assert.equal(parseTemperature('abc'), null);
  assert.equal(parseTemperature('999'), null);
  assert.equal(parseTemperature(''), null);
});

test('temperature: CSV آمن (BOM، اقتباس، منع حقن الصيغ)', () => {
  const csv = toCsv([{ ts: 0, point: '=HYPERLINK("x")', kind: 'cold', temp: 3, ok: true, note: 'a"b' }]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`), 'الصيغة تُعطَّل ببادئة اقتباس');
  assert.ok(csv.includes('"a""b"'));
  assert.ok(csv.includes('ضمن الحد'));
});

/* ---------------- chemical-meta ---------------- */
test('chemical-meta: حالات المراجعة والروابط', () => {
  const now = new Date('2026-10-08T00:00:00');
  assert.equal(reviewStatus(null, now).state, 'unreviewed');
  assert.equal(reviewStatus({ lastReviewed: null }, now).state, 'unreviewed');
  assert.equal(reviewStatus({ lastReviewed: '2026-09-01' }, now).state, 'ok');
  assert.equal(reviewStatus({ lastReviewed: '2024-01-01' }, now).state, 'stale');
  assert.equal(reviewStatus({ lastReviewed: 'garbage' }, now).state, 'unreviewed');
  assert.ok(isSafeSdsUrl('https://example.com/sds.pdf'));
  assert.ok(!isSafeSdsUrl('http://example.com'));
  assert.ok(!isSafeSdsUrl('javascript:alert(1)'));
  assert.ok(!isSafeSdsUrl(null));
});

test('chemical-meta: لكل مادة سجل، وأي رابط/تاريخ مُدخَل صالح الشكل', () => {
  for (const c of chemicals) {
    const meta = chemicalMeta[c.id];
    assert.ok(meta, `لا سجل حوكمة للمادة ${c.id}`);
    if (meta.sdsUrl !== null) assert.ok(isSafeSdsUrl(meta.sdsUrl), `رابط SDS غير آمن للمادة ${c.id}`);
    if (meta.lastReviewed !== null) assert.match(meta.lastReviewed, /^\d{4}-\d{2}-\d{2}$/);
  }
});

/* ---------------- checklists + engine ---------------- */
test('checklists: المساعد يعرض نفس بنود صفحة السجلات', () => {
  for (const [id, list] of Object.entries(checklists)) {
    assert.equal(list.items.length, 6);
    const text = checklistToText(/** @type {any} */ (id));
    list.items.forEach((item) => assert.ok(text.includes(item)));
  }
  assert.match(answer('Checklist وردية صباحية').text, new RegExp(checklists.morning.items[0].slice(0, 12)));
});

test('المحرك: تسامح إملائي مع أسماء المواد', () => {
  assert.equal(answer('سانكلور').intent, 'chemicalCard');
  assert.equal(typeof answer('تخفيف انفورز').chemicalId, 'number');
});

/* ---------------- state (يعمل في node: التخزين يفشل بهدوء) ---------------- */
test('state: تاريخ محلي، تبديل التأشير، التنظيف بعد 14 يوماً', () => {
  resetAllData();
  assert.match(localDateKey(new Date(2026, 0, 5)), /^2026-01-05$/);

  assert.equal(toggleChecklistItem('morning', 2, '2026-01-01'), true);
  assert.equal(toggleChecklistItem('morning', 0, '2026-01-01'), true);
  assert.deepEqual(getState('checklistProgress')['2026-01-01'].morning, [0, 2]);
  assert.equal(toggleChecklistItem('morning', 2, '2026-01-01'), false);
  assert.deepEqual(getState('checklistProgress')['2026-01-01'].morning, [0]);
  resetChecklist('morning', '2026-01-01');
  assert.deepEqual(getState('checklistProgress')['2026-01-01'].morning, []);

  for (let d = 2; d <= 20; d += 1) toggleChecklistItem('deep', 0, `2026-01-${String(d).padStart(2, '0')}`);
  assert.equal(Object.keys(getState('checklistProgress')).length, CHECKLIST_KEEP_DAYS);
  assert.ok(!('2026-01-01' in getState('checklistProgress')), 'الأيام القديمة تُحذف');
});

test('state: سجل الحرارة — الأحدث أولاً وبحد أقصى', () => {
  resetAllData();
  addTemperatureReading({ point: 'ثلاجة 1', kind: 'cold', temp: 3, ok: true });
  addTemperatureReading({ point: 'ثلاجة 2', kind: 'cold', temp: 9, ok: false, note: 'باب مفتوح' });
  const log = getState('temperatureLog');
  assert.equal(log[0].point, 'ثلاجة 2');
  assert.equal(log[0].ok, false);
  for (let i = 0; i < TEMP_LOG_LIMIT + 20; i += 1) addTemperatureReading({ point: `p${i}`, kind: 'cold', temp: 1, ok: true });
  assert.equal(getState('temperatureLog').length, TEMP_LOG_LIMIT);
  resetAllData();
});

/* ---------------- diagnostics ---------------- */
test('diagnostics: التقرير لا يحمل بيانات مستخدم ويعرض الأخطاء', () => {
  const report = buildReport({
    version: 'v2.3',
    errors: [{ ts: 0, type: 'error', message: 'boom', where: 'app.js:1' }],
    env: { المتصفح: 'UA' }
  });
  assert.match(report, /v2\.3/);
  assert.match(report, /boom @ app\.js:1/);
  assert.ok(!/favorite|chatHistory|temperatureLog/.test(report));
  assert.match(buildReport({ version: 'v', errors: [], env: {} }), /لا أخطاء/);
});
