/**
 * ============================================================================
 * assistant-engine.js — محرك إجابات المساعد المحلي (دوال نقية قابلة للاختبار)
 * ============================================================================
 * مسؤولية واحدة: تحويل نص المستخدم إلى إجابة، بلا أي اعتماد على الـ DOM.
 *
 * الآلية (بديل مطابقة regex الأولى-تفوز):
 *   1) تطبيع النص وتقطيعه لكلمات (مع تجريد البادئات ال/وال/بال/لل).
 *   2) كل «نيّة» (Intent) تحسب درجة؛ تفوز الأعلى درجة (لا الأولى ترتيباً).
 *   3) مطابقة المواد الكيميائية بالاسم الكامل أو بكلمة فريدة تخص مادة واحدة،
 *      وعند الالتباس (مثل «oasis») يسأل المساعد: تقصد أي مادة؟
 *   4) محتوى الإجابات يُسحب من data.js حيثما أمكن (مصدر الحقيقة الواحد).
 * ============================================================================
 */

import { chemicals, educationModules, safetyContent } from './data.js';
import { normalizeText, getDangerLabel } from './utils.js';
import { closestWord } from './fuzzy.js';
import { checklistToText } from './checklists.js';

/** أدنى درجة لقبول نيّة ما. */
const MIN_INTENT_SCORE = 4;
const TOKEN_SPLIT = /[^a-z0-9\u0600-\u06FF]+/;

/** @param {string} id */
const getModule = (id) => educationModules.find((m) => m.id === id);

/* ============================================================================
   1) التطبيع والمطابقة
   ============================================================================ */

/**
 * يقسّم نصاً مُطبَّعاً لكلمات.
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
  return normalizeText(text).split(TOKEN_SPLIT).filter(Boolean);
}

/**
 * يبني سياق السؤال: النص المُطبَّع + الكلمات + صيغها بعد تجريد البادئات.
 * @param {string} raw
 */
function buildContext(raw) {
  const text = normalizeText(raw);
  const tokens = text.split(TOKEN_SPLIT).filter(Boolean);
  const stems = new Set();
  tokens.forEach((t) => {
    stems.add(t);
    ['وال', 'بال', 'لل', 'ال'].forEach((p) => {
      if (t.startsWith(p) && t.length > p.length + 1) stems.add(t.slice(p.length));
    });
    if (t.length >= 5 && /^[وبل]/.test(t)) stems.add(t.slice(1));
  });
  return { raw, text, tokens, stems: [...stems] };
}

/**
 * هل يطابق السياق نمطاً؟ — عبارة (فيها مسافة) تُبحث كنص،
 * وكلمة تُطابق كاملة، وكلمة تنتهي بـ * تُطابق كبادئة.
 * @param {ReturnType<typeof buildContext>} ctx
 * @param {string} pattern
 */
function matches(ctx, pattern) {
  const p = normalizeText(pattern);
  if (p.includes(' ')) return ctx.text.includes(p);
  if (p.endsWith('*')) {
    const prefix = p.slice(0, -1);
    return ctx.stems.some((t) => t.startsWith(prefix));
  }
  return ctx.stems.includes(p);
}

const any = (ctx, list) => list.some((p) => matches(ctx, p));
const count = (ctx, list) => list.filter((p) => matches(ctx, p)).length;

/* ============================================================================
   2) مطابقة المواد الكيميائية
   ============================================================================ */

/** كلمات اسم كل مادة (عربي + إنجليزي) — أطول من حرفين أو أرقام. */
function chemicalTokens(chem) {
  return new Set(
    tokenize(`${chem.nameEn} ${chem.nameAr}`).filter((t) => t.length >= 3 || /^\d+$/.test(t))
  );
}

/** فهرس: كلمة ← عدد المواد التي تحتويها (للكلمات الفريدة وزن أعلى). */
function buildTokenOwners() {
  const owners = new Map();
  chemicals.forEach((chem) => {
    chemicalTokens(chem).forEach((t) => {
      if (!owners.has(t)) owners.set(t, []);
      owners.get(t).push(chem.id);
    });
  });
  return owners;
}

/**
 * يعيد المواد المطابقة للسؤال مرتبة بالدرجة.
 * اسم كامل = 100، وكلمة فريدة = 10، وكلمة مشتركة بين n مواد = 10/n.
 * @param {ReturnType<typeof buildContext>} ctx
 * @returns {{chem: import('./data.js').Chemical, score: number}[]}
 */
export function findChemicalMatches(ctx) {
  const owners = buildTokenOwners();
  const scores = new Map();

  chemicals.forEach((chem) => {
    const full =
      ctx.text.includes(normalizeText(chem.nameEn)) || ctx.text.includes(normalizeText(chem.nameAr));
    if (full) scores.set(chem.id, 100);
  });

  ctx.stems.forEach((stem) => {
    let ids = owners.get(stem);
    let weight = 1;
    if (!ids && stem.length >= 5) {
      // تسامح إملائي: «سانكلور» ← «سانيكلور» (وزن أقل من المطابقة التامة)
      const near = closestWord(stem, owners.keys());
      if (near) {
        ids = owners.get(near);
        weight = 0.9;
      }
    }
    if (!ids) return;
    ids.forEach((id) => scores.set(id, (scores.get(id) ?? 0) + (10 * weight) / ids.length));
  });

  return [...scores.entries()]
    .map(([id, score]) => ({ chem: chemicals.find((c) => c.id === id), score }))
    .sort((a, b) => b.score - a.score);
}

/**
 * يحسم: مادة واحدة واضحة، أم مرشحات ملتبسة.
 * @param {{chem: any, score: number}[]} found
 */
function resolveChemical(found) {
  if (!found.length) return { chem: null, candidates: [] };
  const [first, second] = found;
  if (first.score >= 9 && (!second || first.score > second.score)) {
    return { chem: first.chem, candidates: [] };
  }
  return { chem: null, candidates: found.slice(0, 4).map((m) => m.chem) };
}

/* ============================================================================
   3) نصوص الإجابات (تُبنى من data.js حيثما أمكن)
   ============================================================================ */

function buildChecklist(type) {
  return checklistToText(type);
}

function emergencyNumbersLine() {
  const nums = safetyContent.emergencyContacts
    .filter((c) => /^\d+$/.test(c.number))
    .map((c) => `${c.icon} ${c.label} ${c.number}`)
    .join(' — ');
  return `📞 أرقام الطوارئ: ${nums}`;
}

function chemicalCard(chem) {
  const ppe = chem.ppe.map((p) => `${p.icon} ${p.label}`).join('، ');
  return `**${chem.nameAr} / ${chem.nameEn}**
${chem.desc}
الاستخدام: ${chem.usage}
التخفيف: ${chem.dilution} (${chem.dilutionNote})
الخطورة: ${getDangerLabel(chem.danger)}
معدات الحماية: ${ppe}
التحذير: ${chem.hazard}
التخزين: ${chem.storage}`;
}

const CHEMICAL_ASPECTS = [
  { id: 'dilution', words: ['تخفيف', 'تخفف*', 'اخفف*', 'نسبه', 'تركيز*', 'جرعه', 'جرعات', 'كام مل'], build: (c) => `**تخفيف ${c.nameEn}:** ${c.dilution}\n${c.dilutionNote}` },
  { id: 'ppe', words: ['ppe', 'قفاز*', 'نظار*', 'حمايه', 'البس*', 'ارتدي*'], build: (c) => `**معدات حماية ${c.nameEn}:** ${c.ppe.map((p) => `${p.icon} ${p.label}`).join('، ')}` },
  { id: 'firstaid', words: ['اسعاف*', 'اصابه', 'عين*', 'عيني', 'جلد*', 'ابتلع*', 'استنشق*'], build: (c) => `**إسعاف ${c.nameEn}:**\n${c.firstAid.map((f) => `${f.icon} ${f.text}`).join('\n')}\n${emergencyNumbersLine()}` },
  { id: 'storage', words: ['تخزين', 'اخزن*', 'حفظ', 'احفظ*'], build: (c) => `**تخزين ${c.nameEn}:** ${c.storage}` },
  { id: 'hazard', words: ['خطر*', 'خطير*', 'تحذير*', 'سام*', 'احذر*'], build: (c) => `**تحذير ${c.nameEn}** (خطورة ${getDangerLabel(c.danger)}): ${c.hazard}` }
];

/* ============================================================================
   4) النيّات (Intents)
   ============================================================================ */

const STOPWORDS = new Set([
  'ايه', 'ازاي', 'في', 'من', 'على', 'عن', 'هو', 'هي', 'ده', 'دي', 'لو', 'مع', 'انا', 'عايز', 'عاوز',
  'اعمل', 'ممكن', 'ليه', 'فين', 'امتي', 'كام', 'الي', 'اللي', 'ان', 'او', 'يا', 'لما', 'بتاع', 'بتاعت'
]);

/**
 * @typedef {Object} Intent
 * @property {string} id
 * @property {(ctx: any, chemical: any) => number} score
 * @property {(ctx: any, chemical: any) => string} reply
 */

/** @type {Intent[]} */
const INTENTS = [
  {
    id: 'greeting',
    score: (ctx) => (any(ctx, ['سلام*', 'اهلا', 'مرحبا', 'هلا', 'صباح الخير', 'مساء الخير', 'hello', 'hi']) && ctx.tokens.length <= 4 ? 5 : 0),
    reply: () => 'أهلاً بك! 👋 اسألني عن أي مادة كيميائية، مشكلة تشغيلية، أو إجراء سلامة. مثال: «تخفيف ENFORCE» أو «بقع مياه على الأطباق».'
  },
  {
    id: 'thanks',
    score: (ctx) => (any(ctx, ['شكرا', 'تسلم*', 'thanks', 'thx']) && ctx.tokens.length <= 5 ? 5 : 0),
    reply: () => 'العفو! أنا هنا لأي سؤال تشغيلي أو سلامة. 🌟'
  },
  {
    id: 'firstAid',
    score: (ctx) => {
      const body = any(ctx, ['عين*', 'عيني', 'جلد*', 'ايد*', 'وش', 'فم*', 'حلق*', 'صدر*', 'نفس*']);
      const event = any(ctx, ['اسعاف*', 'اصاب*', 'حرق*', 'حروق', 'تسمم*', 'ابتلع*', 'بلع*', 'استنشق*', 'اختناق*', 'دخل*', 'وقع*', 'طار*', 'تطاير*']);
      if (any(ctx, ['طوارئ', 'اسعافات', 'اسعاف*'])) return 7;
      const chemWord = any(ctx, ['كيماو*', 'كيماويات', 'منظف*', 'مطهر*', 'مادة', 'سائل', 'مزيل*']);
      return (body ? 3 : 0) + (event ? 3 : 0) + (body && chemWord ? 3 : 0);
    },
    reply: () => `إسعافات أولية سريعة:
- **العين:** شطف 15 دقيقة على الأقل مع إزالة العدسات.
- **الجلد:** إزالة الملابس المتأثرة وغسل جيد بالماء والصابون.
- **الابتلاع:** لا تستفز القيء، واطلب الطوارئ فوراً.
- **الاستنشاق:** هواء نقي فوراً ومساعدة طبية.
مع أي حادث لازم تبلغ المشرف فوراً.
${emergencyNumbersLine()}`
  },
  {
    id: 'mixing',
    score: (ctx) => (any(ctx, ['خلط*', 'اخلط*', 'مزج*', 'امزج*']) ? 6 : 0),
    reply: () => `⛔ **ممنوع منعاً باتاً خلط أي مادتين كيميائيتين.**
- خلط المواد الحمضية مع الكلور (مثل **LIME-AWAY EXTRA** مع **SANICHLOR**) ينتج غاز سام.
- **SANICHLOR** لا يُخلط مع الأمونيا أو أي مادة حمضية.
- المواد التي تُحقن تلقائياً في الماكينة لا تُخفف يدوياً.
لو حصل خلط بالغلط: ابتعد فوراً لمكان مفتوح وأبلغ المشرف.
${emergencyNumbersLine()}`
  },
  {
    id: 'stains',
    score: (ctx) => (any(ctx, ['بقع*', 'بقعه']) && any(ctx, ['شاي', 'قهوه', 'فناجين', 'فنجان', 'اكواب الشاي']) ? 9 : 0),
    reply: () => {
      const c = chemicals.find((x) => x.nameEn === 'DIP-IT XP');
      return c ? `لبقع الشاي والقهوة استخدم **${c.nameEn}** (${c.nameAr}):\nالتخفيف: ${c.dilution} — ${c.dilutionNote}\n${c.usage}` : 'استخدم مزيل بقع الشاي والقهوة المخصص.';
    }
  },
  {
    id: 'burntPots',
    score: (ctx) => (any(ctx, ['اواني', 'حله', 'حلل', 'طناجر', 'طنجره', 'صواني', 'صينيه']) && any(ctx, ['محروق*', 'محترق*', 'ترسبات', 'محروقه']) ? 9 : 0),
    reply: () => {
      const c = chemicals.find((x) => x.nameEn.startsWith('DECARBONIZER'));
      return c ? `للأواني المحروقة استخدم **${c.nameEn}** (${c.nameAr}):\n${c.usage}\nالتخفيف: ${c.dilution}\nارتدِ ${c.ppe.map((p) => p.label).join(' + ')}.` : 'انقع الأواني في مادة نقع مناسبة ثم اشطف جيداً.';
    }
  },
  {
    id: 'waterSpots',
    score: (ctx) => (any(ctx, ['بقع*', 'بقعه', 'spot*', 'water spot']) ? 4 : 0) + (any(ctx, ['مياه', 'ماء', 'اطباق', 'كاس*', 'اكواب', 'كوب*', 'زجاج*', 'شفاف*']) ? 3 : 0),
    reply: () => `لو الأطباق بتطلع عليها بقع مياه:
1) راجع مادة الشطف/التجفيف مثل **SOLID BRILLIANCE** أو **RINSE DRY**.
2) تأكد إن الشطف النهائي بين 75 و82°م.
3) لو الحرارة أعلى من 82° ممكن يحصل تلوث كيميائي وبقايا مادة التجفيف.
4) افحص عسر المياه وتراكم الأملاح واستخدم مزيل أملاح عند الحاجة.`
  },
  {
    id: 'burntGrease',
    score: (ctx) => {
      const place = any(ctx, ['جريل*', 'grill*', 'شواي*', 'فرن*', 'هود*', 'اهواد*', 'شفاط*']) ? 3 : 0;
      const dirt = count(ctx, ['دهون', 'دهن', 'شحوم*', 'محروق*', 'محترق*', 'تنظيف', 'نظف*', 'حروق']);
      return place + 3 * Math.min(2, dirt);
    },
    reply: () => `للدهون المحروقة على الجريلة:
1) افصل المصدر الكهربائي أو الغاز.
2) اعمل تنظيف مبدئي بالمقطع والفرشاة.
3) استخدم **GREASSTRIP PLUS** على حرارة 40–50°م لمدة 10–15 دقيقة.
4) اشطف ثم لو فيه ترسبات استخدم مزيل أملاح مناسب.
5) ارتدِ قفازات سميكة + نظارة + تهوية جيدة.`
  },
  {
    id: 'ph',
    score: (ctx) => (any(ctx, ['ph', 'p h', 'حمضي*', 'قلوي*', 'حموض*', 'احماض']) ? 5 : 0),
    reply: () => `اختيار المادة حسب pH:
- **الحمضي:** لإزالة الأملاح والترسبات.
- **المحايد:** آمن ولطيف مثل بعض أنواع صابون اليد.
- **القلوي:** أفضل لإزالة الدهون والزيوت.
ممنوع خلط المواد المختلفة خصوصاً الحمضي مع الكلور.`
  },
  {
    id: 'cleanVsSanitize',
    score: (ctx) => {
      const n = count(ctx, ['تنظيف', 'تطهير', 'تعقيم', 'نظافه']);
      return any(ctx, ['فرق*', 'يختلف*', 'اختلاف*', 'مقارنه']) && n >= 1 ? 5 + n : 0;
    },
    reply: () => `الفرق باختصار:
- **التنظيف:** إزالة الأوساخ المرئية وغير المرئية.
- **التطهير:** تنظيف + تقليل البكتيريا للحد الآمن للغذاء.
- **التعقيم:** أعلى مستوى ويستهدف القضاء الكامل على الميكروبات.`
  },
  {
    id: 'dishTemps',
    score: (ctx) => (any(ctx, ['حراره*', 'درجه', 'درجات']) && any(ctx, ['ماكين*', 'غسال*', 'شطف', 'dishwasher']) ? 8 : 0),
    reply: () => {
      const rows = getModule('dishwasher')?.tempTable ?? [];
      return `درجات حرارة ماكينة الأطباق:\n${rows.map((r) => `- **${r.stage}:** ${r.temp} — ${r.note}`).join('\n')}`;
    }
  },
  {
    id: 'dishwasherFault',
    score: (ctx) =>
      any(ctx, ['ماكين*', 'غسال*', 'dishwasher'])
        ? 3 + (any(ctx, ['مش بتنضف', 'مش نضيف*', 'مش بتغسل', 'مش بتنظف', 'ضعيف*', 'ضعف', 'بتسيب', 'عطل*', 'بايظ*', 'مشكله', 'ليه', 'وقفت', 'بقايا']) ? 4 : 0)
        : 0,
    reply: () => `لو ماكينة الأطباق مش بتنظف كويس:
1) راجع التنظيف المبدئي قبل دخول الأطباق.
2) تأكد من مادة الغسيل ومادة الشطف.
3) افحص درجات الحرارة: غسيل 55–65°م وشطف نهائي 75–82°م.
4) افحص الذراع الرشاش والفلاتر وترسبات الأملاح.
5) تأكد إن الجرعات تلقائية ومفيش انسداد في خطوط الضخ.`
  },
  {
    id: 'handwash',
    score: (ctx) => (any(ctx, ['غسل*', 'اغسل*', 'غسيل*']) && any(ctx, ['ايد*', 'يد', 'يدين', 'يدي']) ? 7 : 0),
    reply: () => {
      const rule = getModule('golden-rules')?.rules.find((r) => r.n === 1);
      return `**غسل اليدين (القاعدة 1):** ${rule ? rule.desc : 'كل 20 دقيقة لمدة 20 ثانية على الأقل.'}
- صابون اليد: **AB CLEAN & SMOOTH** — جاهز بدون تخفيف.
- معقم اليد: **INSTANT HAND SANITIZER** — قابل للاشتعال، ابعده عن النار.`;
    }
  },
  {
    id: 'boards',
    score: (ctx) => (any(ctx, ['لوح*', 'الواح', 'سكاكين', 'سكين*']) && any(ctx, ['لون*', 'ملون*', 'الوان', 'احمر', 'اخضر', 'ازرق', 'اصفر', 'بنفسجي', 'بني', 'ابيض']) ? 8 : 0),
    reply: () => {
      const boards = getModule('golden-rules')?.cuttingBoards ?? [];
      return `**الألواح والسكاكين الملونة (القاعدة 13):**\n${boards.map((b) => `- ${b.name}: ${b.use}`).join('\n')}\n- **بنفسجي:** مخصص لطعام ضيوف الحساسية فقط (القاعدة 4).`;
    }
  },
  {
    id: 'allergens',
    score: (ctx) => (any(ctx, ['حساسي*', 'اليرج*', 'allerg*', 'تحسس*']) ? 6 : 0),
    reply: () => {
      const list = (getModule('golden-rules')?.allergens ?? []).join('، ');
      return `مسببات الحساسية التسعة الأساسية:\n${list}.\n**القاعدة 4:** لضيوف الحساسية استخدم لوح تقطيع وسكين **بنفسجيين** مخصصين فقط، واسأل الضيف عن أي حساسية إضافية يُخبرك بها.`;
    }
  },
  {
    id: 'haccp',
    score: (ctx) => (any(ctx, ['haccp', 'هاسب', 'ccp', 'نقاط التحكم', 'تحليل المخاطر']) ? 6 : 0),
    reply: () => {
      const list = (getModule('haccp')?.principles ?? []).map((p) => `${p.n}) ${p.title.replace(/^\S+\s/, '')}`).join('\n');
      return `نظام **HACCP** — المبادئ السبعة:\n${list}\nالتفاصيل الكاملة بأمثلة عملية في وحدة HACCP بالأكاديمية.`;
    }
  },
  {
    id: 'fridge',
    score: (ctx) => (any(ctx, ['ثلاج*', 'فريزر*', 'تبريد*', 'تجميد*', 'مجمد*', 'اذاب*', 'تذويب*']) ? 5 : 0),
    reply: () => `قواعد التبريد والتجميد:
- **ترتيب الثلاجة من الأعلى للأسفل:** خضراوات ← سمك ← لحم ← دجاج (الدجاج دائماً في القاع لمنع التلوث المتبادل).
- **البارد:** أقل من 5°م — **المجمّد:** −16° إلى −18°م — **الساخن:** أعلى من 60°م.
- **إذابة التجميد:** داخل الثلاجة (حتى 3 أيام) أو تحت ماء بارد جارٍ فقط.
- **تبريد الطعام الساخن:** Blast Chiller أو حمام ثلج — لا يُترك يبرد ببطء أبداً.`
  },
  {
    id: 'ppe',
    score: (ctx) => (any(ctx, ['ppe', 'قفاز*', 'نظار*', 'كمام*', 'مريل*', 'معدات الحمايه', 'حمايه شخصيه']) ? 5 : 0),
    reply: () => {
      const items = safetyContent.ppe.map((i) => `${i.icon} ${i.name} (${i.when})`).join('، ');
      return `معدات الحماية الشخصية (PPE):\n${items}.\n**القاعدة 7:** القفازات إلزامية عند التعامل المباشر مع الأطعمة الجاهزة للأكل (RTE).`;
    }
  },
  {
    id: 'goldenRules',
    score: (ctx) => (any(ctx, ['قاعده ذهبيه', 'قواعد ذهبيه', 'القواعد الذهبيه', '13 قاعده']) ? 7 : 0),
    reply: () => {
      const rules = getModule('golden-rules')?.rules ?? [];
      return `القواعد الذهبية الـ 13 لسلامة الغذاء:\n${rules.map((r) => `${r.n}) ${r.title.replace(/^\S+\s/, '')}`).join('\n')}\nالتفاصيل في وحدة "القواعد الذهبية" بالأكاديمية.`;
    }
  },
  {
    id: 'checklist',
    score: (ctx) => {
      if (any(ctx, ['checklist', 'تشك ليست', 'شيك ليست', 'تشيك ليست', 'قائمه تدقيق', 'قائمه متابعه', 'قائمه نظافه'])) return 7;
      return any(ctx, ['قائمه*', 'جدول']) && any(ctx, ['نظافه', 'وردي*', 'تدقيق', 'متابعه', 'يوميه']) ? 6 : 0;
    },
    reply: (ctx) => {
      if (any(ctx, ['صباح*', 'morning'])) return buildChecklist('morning');
      if (any(ctx, ['عميق*', 'شهري*', 'اسبوعي*', 'deep'])) return buildChecklist('deep');
      return buildChecklist('general');
    }
  },
  {
    id: 'chemicalAspect',
    score: (ctx, chem) => (chem && CHEMICAL_ASPECTS.some((a) => any(ctx, a.words)) ? 10 : 0),
    reply: (ctx, chem) => {
      const aspect = CHEMICAL_ASPECTS.find((a) => any(ctx, a.words));
      return aspect.build(chem);
    }
  },
  {
    id: 'chemicalCard',
    score: (ctx, chem) => (chem ? 5 : 0),
    reply: (ctx, chem) => chemicalCard(chem)
  }
];

/* ============================================================================
   5) الواجهة العامة للمحرك
   ============================================================================ */

/**
 * يحدد النيّة الأنسب لنص السؤال.
 * @param {string} text
 * @returns {{id: string, score: number, ctx: any, chem: any, candidates: any[]}}
 */
export function detectIntent(text) {
  const ctx = buildContext(text);
  const { chem, candidates } = resolveChemical(findChemicalMatches(ctx));

  let best = { id: 'none', score: 0 };
  INTENTS.forEach((intent) => {
    const score = intent.score(ctx, chem);
    if (score > best.score) best = { id: intent.id, score };
  });

  if (best.score < MIN_INTENT_SCORE) best = { id: 'none', score: 0 };
  return { ...best, ctx, chem, candidates };
}

/**
 * يبحث في حقول المواد عن كلمات السؤال (بديل «الكلمة الأولى فقط» القديم).
 * @param {{stems: string[]}} ctx
 */
function searchChemicalsByContent(ctx) {
  const words = ctx.stems.filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  if (!words.length) return [];
  return chemicals
    .map((c) => {
      const hay = normalizeText([c.nameAr, c.nameEn, c.desc, c.usage, c.hazard].join(' '));
      return { c, score: words.filter((w) => hay.includes(w)).length };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.c);
}

/**
 * المدخل الرئيسي: يُرجع نص الإجابة + النيّة + (اختيارياً) معرّف مادة لفتح بطاقتها.
 * @param {string} text
 * @returns {{text: string, intent: string, chemicalId?: number}}
 */
export function answer(text) {
  const detected = detectIntent(text);
  const { id, ctx, chem, candidates } = detected;

  if (id !== 'none') {
    const intent = INTENTS.find((i) => i.id === id);
    const reply = intent.reply(ctx, chem);
    const chemicalId = chem && (id === 'chemicalCard' || id === 'chemicalAspect') ? chem.id : undefined;
    return { text: reply, intent: id, chemicalId };
  }

  if (candidates.length > 1) {
    const lines = candidates.map((c, i) => `${i + 1}) ${c.nameEn} — ${c.nameAr}`).join('\n');
    return { text: `تقصد أي مادة من دول؟\n${lines}\n\nاكتب الاسم كاملاً وسأعطيك التفاصيل.`, intent: 'ambiguousChemical' };
  }

  const related = searchChemicalsByContent(ctx);
  if (related.length) {
    const lines = related.map((c, i) => `${i + 1}) ${c.nameAr} — ${c.desc}`).join('\n');
    return { text: `أقرب مواد مرتبطة بسؤالك:\n${lines}\n\nلو تحب، اكتب اسم المعدة أو المشكلة وسأعطيك خطوات أدق.`, intent: 'relatedChemicals' };
  }

  return {
    text: 'ممكن أوضحها لك فوراً. اكتب اسم المادة أو المشكلة التشغيلية نفسها، مثلاً: بقع مياه، دهون محروقة، نظافة وردية صباحية، تخفيف ENFORCE، أو اسم المادة الكيميائية.',
    intent: 'fallback'
  };
}

/** واجهة متوافقة مع الإصدار 2.0: تُرجع نص الإجابة فقط. */
export function answerFromKnowledge(text) {
  return answer(text).text;
}
