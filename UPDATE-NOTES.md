# تحديث دليل الاستيوارد → v2.2 (حزمة تراكمية)

تُنسخ فوق مشروع **v2.0** مباشرة، وتتضمن كل ما في v2.1 (المحرك، الاختبارات، التدقيق) مع الجديد. الملفات المتطابقة بالاسم تُستبدل.

## الجديد في v2.2
| الميزة | التفاصيل |
|---|---|
| **روابط عميقة** | `#chemicals?open=7` يفتح بطاقة المادة مباشرة؛ الموجّه يعيد استدعاء `onEnter` عند تغيّر المعامل داخل نفس العرض |
| **مشاركة المواد** | زر «🔗 مشاركة» (قائمة المشاركة الأصلية للجهاز، أو نسخ الرابط). «نسخ التفاصيل» يضيف الرابط أيضاً |
| **تنقل بروابط حقيقية** | الشريط السفلي صار `<a href="#...">` (فتح بتبويب جديد، لا مستمع نقر زائد) |
| **زر طوارئ دائم** 🚨 | يظهر في الرئيسية والمواد والتعليم، ويختفي في السلامة والمحادثة والإعدادات |
| **اتصال بلمسة** | أرقام الطوارئ الرقمية روابط `tel:` من `safety.js` مباشرة |
| **إشعار التحديث** | `pwa-update.js`: «يتوفر تحديث جديد — تحديث الآن» (لا يظهر عند أول تثبيت) |
| **سياسة CSP** | `script-src 'self'` — تمنع أي JavaScript مضمّن أو خارجي؛ تسمح بالخطوط فقط من Google |
| **إعدادات أأمن** | تأكيد قبل استيراد البيانات، وعناوين `<h1>` لا تُمحى في السلامة والإعدادات |
| **جودة الكود** | ESLint 9 + EditorConfig + Prettier، وخطوة lint في CI |
| **سكربت تصحيح السلامة** | `npm run fix:data` يصحّح نص «إضافة الماء للكيماوي» في `data.js` تلقائياً |

## الملفات
**جديدة:** `assets/js/pwa-update.js` · `assets/js/a11y.js` · `assets/js/assistant-engine.js` · `assets/js/quiz.js` · `assets/js/quizzes.js` · `assets/css/extras.css` · `scripts/patch-data.mjs` · `eslint.config.js` · `.editorconfig` · `.prettierrc.json` · `package.json` · `playwright.config.js` · `tests/**` · `.github/workflows/ci.yml` · `.gitignore`
**مستبدلة:** `index.html` · `service-worker.js` (v4) · `manifest.json` · `assets/js/{app,router,chemicals,education,safety,settings,ai}.js`
**لم تُمَسّ:** `data.js` · `state.js` · `utils.js` · `dashboard.js` · `tokens/base/components/views.css`

## خطوات ما بعد النسخ
```bash
npm install
npm run fix:data          # تصحيح نص السلامة في data.js (ثم راجعه مع SDS)
npm run check             # ESLint + اختبارات الوحدة وسلامة البيانات
npx playwright install chromium
npm run test:e2e          # اختبارات المتصفح (لم تُشغَّل في بيئتي)
```
> اختبار الانحدار في `data-integrity.test.js` **سيفشل عمداً** حتى تشغّل `fix:data` — هذا بوابة سلامة وليس عطلاً.

## تنبيهات صريحة
- **CSP لم تُجرَّب في متصفح حقيقي.** فعّلتُ `style-src-attr 'unsafe-inline'` لأن الكود يضبط `style=` عبر `createElement`. إن ظهر عنصر بلا تنسيق، افتح الكونسول؛ اختبار E2E «لا مخالفات CSP» مكتوب لكشف ذلك.
- ESLint نظيف على الملفات الجديدة والمعاد كتابتها، أما `data.js` و`state.js` و`utils.js` و`dashboard.js` فلم تكن عندي على القرص فلم تُفحص.
- أرقام الحرارة والتخفيف في `data.js` ما زالت تحتاج مطابقة مع SDS وسياسة Marriott.
- حدّث `PROJECT-DOCUMENTATION.md`: الإصدار 2.2، الروابط العميقة، CSP، معيار اكتمال الوحدة.
