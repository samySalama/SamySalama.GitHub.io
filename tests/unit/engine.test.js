import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answer, detectIntent } from '../../assets/js/assistant-engine.js';

const CASES = [
  ['Checklist وردية صباحية', 'checklist'],
  ['بقع مياه على الأطباق', 'waterSpots'],
  ['دهون محروقة على الجريلة', 'burntGrease'],
  ['الفرق بين التنظيف والتطهير', 'cleanVsSanitize'],
  ['ايه الفرق بين الحمضي والقلوي', 'ph'],
  ['ماكينة الأطباق مش بتنضف كويس', 'dishwasherFault'],
  ['كيماوي في العين', 'firstAid'],
  ['مسببات الحساسية التسعة', 'allergens'],
  ['مبادئ هاسب', 'haccp'],
  ['نقاط التحكم الحرجة', 'haccp'],
  ['ترتيب الثلاجة', 'fridge'],
  ['ايه الـ PPE المطلوبة', 'ppe'],
  ['القواعد الذهبية لسلامة الغذاء', 'goldenRules'],
  ['انفورس', 'chemicalCard'],
  ['تخفيف انفورس', 'chemicalAspect'],
  ['ينفع اخلط سانيكلور مع لايم أواي', 'mixing'],
  ['بقع شاي على الاكواب', 'stains'],
  ['الاواني المحروقة', 'burntPots'],
  ['ازاي اغسل ايدي صح', 'handwash'],
  ['الوان الواح التقطيع', 'boards'],
  ['درجة حرارة ماكينة الأطباق', 'dishTemps']
];

for (const [question, intent] of CASES) {
  test(`النيّة «${intent}» ← ${question}`, () => {
    assert.equal(detectIntent(question).id, intent);
  });
}

test('كلمة عامة لا تُطلق إجابة خاطئة (كانت «مياه» تُطلق بقع المياه)', () => {
  assert.equal(detectIntent('مياه').id, 'none');
  assert.equal(detectIntent('ليه الاطباق وسخة').id, 'none');
});

test('اسم ملتبس بين مادتين يُسأل عنه بدل التخمين', () => {
  const r = answer('oasis');
  assert.equal(r.intent, 'ambiguousChemical');
  assert.match(r.text, /OASIS 146/);
  assert.match(r.text, /OASIS 133/);
});

test('رقم المادة الفريد يحسم الالتباس', () => {
  assert.equal(answer('اواسيس 146 تخفيف').intent, 'chemicalAspect');
});

test('رد المادة يحمل chemicalId لفتح البطاقة', () => {
  assert.equal(typeof answer('ازاي استخدم enforce').chemicalId, 'number');
});

test('ردود الطوارئ تتضمن أرقام الاتصال', () => {
  assert.match(answer('كيماوي في العين').text, /123/);
  assert.match(answer('اخلط سانيكلور مع لايم اواي').text, /123/);
});

test('رد الخلط لا يوصي بأي خلط', () => {
  assert.match(answer('اخلط مادتين').text, /ممنوع/);
});

test('سؤال غير مفهوم يعطي رسالة إرشادية', () => {
  assert.equal(answer('حاجة مش مفهومة خالص').intent, 'fallback');
});
