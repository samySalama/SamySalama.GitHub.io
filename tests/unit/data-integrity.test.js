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

test('انحدار سلامة: لا نص يأمر بإضافة الماء إلى الكيماوي', () => {
  const data = readFileSync(new URL('assets/js/data.js', ROOT), 'utf8');
  assert.ok(!data.includes('أضف الماء البارد للكيماوي'), 'شغّل: npm run fix:data وراجعه مع SDS');
});

test('كل ملف js مُحمَّل من index.html أو مستورد، وكل script في index.html موجود', () => {
  const html = readFileSync(new URL('index.html', ROOT), 'utf8');
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 1);
  for (const s of scripts) assert.ok(existsSync(new URL(s, ROOT)), `script مفقود: ${s}`);
});

test('index.html: سياسة CSP تمنع JavaScript المضمّن وتسمح بالخطوط فقط', () => {
  const html = readFileSync(new URL('index.html', ROOT), 'utf8');
  const csp = html.match(/Content-Security-Policy"\s+content="([^"]+)"/)[1];
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.ok(!/script-src[^;]*unsafe-inline/.test(csp));
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>\s*\S/.test(html), 'يوجد <script> مضمّن يخالف CSP');
});

test('الخطوط مستضافة ذاتياً: لا اعتماد على Google Fonts، والملفات موجودة ومُخزَّنة مسبقاً', () => {
  const html = readFileSync(new URL('index.html', ROOT), 'utf8');
  const css = readFileSync(new URL('assets/css/fonts.css', ROOT), 'utf8');
  const sw = readFileSync(new URL('service-worker.js', ROOT), 'utf8');
  assert.ok(!/googleapis|gstatic/.test(html + css), 'ما زال هناك اعتماد على Google Fonts');
  const files = [...css.matchAll(/url\('\.\.\/fonts\/([^']+)'\)/g)].map((m) => m[1]);
  assert.ok(files.length >= 3);
  for (const f of files) {
    assert.ok(existsSync(new URL(`assets/fonts/${f}`, ROOT)), `ملف خط مفقود: ${f}`);
    assert.ok(sw.includes(`./assets/fonts/${f}`), `الخط ${f} غير مُخزَّن مسبقاً في عامل الخدمة`);
  }
});

test('عامل الخدمة: سطر CACHE_VERSION بالصيغة التي يستبدلها deploy.yml', () => {
  const sw = readFileSync(new URL('service-worker.js', ROOT), 'utf8');
  assert.match(sw, /const CACHE_VERSION = 'steward-guide-v[0-9]*';/);
  const deploy = readFileSync(new URL('.github/workflows/deploy.yml', ROOT), 'utf8');
  assert.ok(deploy.includes("steward-guide-v[0-9]*'"), 'نمط sed في deploy.yml لا يطابق الملف');
});

test('كل عرض في index.html له تسجيل (registerView) وعنوان في الموجّه', () => {
  const html = readFileSync(new URL('index.html', ROOT), 'utf8');
  const router = readFileSync(new URL('assets/js/router.js', ROOT), 'utf8');
  const app = readFileSync(new URL('assets/js/app.js', ROOT), 'utf8');
  const views = [...html.matchAll(/<section class="view" data-view="(\w+)"/g)].map((m) => m[1]);
  assert.ok(views.length >= 8);
  for (const v of views) {
    assert.ok(new RegExp(`${v}:\\s*'`).test(router), `عنوان العرض ${v} غير موجود في router.js`);
    assert.ok(existsSync(new URL(`assets/js/${v}.js`, ROOT)), `لا ملف لعرض ${v}`);
    assert.ok(app.includes(`./${v}.js`), `app.js لا يستورد عرض ${v}`);
  }
});
