import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { chemicals, categoryMeta, educationModules } from '../../assets/js/data.js';
import { quizzes } from '../../assets/js/quizzes.js';
import { normalizeText } from '../../assets/js/utils.js';

const ROOT = new URL('../../', import.meta.url);

test('معرّفات المواد الكيميائية فريدة وكاملة الحقول', () => {
  const ids = new Set(chemicals.map((c) => c.id));
  assert.equal(ids.size, chemicals.length);
  for (const c of chemicals) {
    for (const f of ['nameEn', 'nameAr', 'desc', 'dilution', 'usage', 'storage', 'hazard']) {
      assert.ok(c[f], `المادة ${c.id} ينقصها الحقل ${f}`);
    }
    assert.ok(['low', 'med', 'high'].includes(c.danger), `خطورة غير صالحة للمادة ${c.id}`);
    assert.ok(c.ppe.length > 0 && c.firstAid.length > 0);
    for (const cat of c.category) assert.ok(cat in categoryMeta, `فئة غير معرّفة: ${cat}`);
  }
});

test('لكل وحدة تعليمية اختبار، والعكس', () => {
  const moduleIds = educationModules.map((m) => m.id).sort();
  assert.deepEqual(Object.keys(quizzes).sort(), moduleIds);
});

test('أسئلة الاختبارات سليمة (فهرس الإجابة صحيح، خيارات فريدة، شرح موجود)', () => {
  for (const [id, quiz] of Object.entries(quizzes)) {
    assert.ok(quiz.questions.length >= 3, `الوحدة ${id} فيها أقل من 3 أسئلة`);
    for (const q of quiz.questions) {
      assert.ok(q.options.length >= 2);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, `${id}: فهرس إجابة خاطئ`);
      assert.equal(new Set(q.options).size, q.options.length, `${id}: خيارات مكررة`);
      assert.ok(q.why.length > 5);
    }
  }
});

test('كل ملف في قائمة التخزين الأساسية لعامل الخدمة موجود على القرص', () => {
  const sw = readFileSync(new URL('service-worker.js', ROOT), 'utf8');
  const block = sw.match(/const CORE_FILES = \[([\s\S]*?)\];/)[1];
  const files = [...block.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);
  assert.ok(files.length > 10);
  for (const f of files) assert.ok(existsSync(new URL(f, ROOT)), `مفقود: ${f}`);
});

test('كل ملفات js/css داخل assets مذكورة في التخزين المؤقت', async () => {
  const { readdirSync } = await import('node:fs');
  const sw = readFileSync(new URL('service-worker.js', ROOT), 'utf8');
  for (const dir of ['assets/js', 'assets/css']) {
    for (const f of readdirSync(new URL(`${dir}/`, ROOT))) {
      assert.ok(sw.includes(`./${dir}/${f}`), `${dir}/${f} غير موجود في عامل الخدمة`);
    }
  }
});

test('manifest: كل أيقونة وكل اختصار يشير لملف/رابط صالح الشكل', () => {
  const m = JSON.parse(readFileSync(new URL('manifest.json', ROOT), 'utf8'));
  assert.equal(m.dir, 'rtl');
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  for (const s of m.shortcuts) assert.match(s.url, /#(chemicals|ai|safety)$/);
});

test('normalizeText يوحّد الألف والتاء المربوطة والتشكيل', () => {
  assert.equal(normalizeText('إنفورس'), normalizeText('انفورس'));
  assert.equal(normalizeText('مَدرسة'), normalizeText('مدرسه'));
});
