/**
 * scripts/generate-qr.mjs — ملصقات QR للمواد الكيميائية
 * ============================================================================
 * يولّد لكل مادة QR يفتح بطاقتها مباشرة (#chemicals?open=ID) + ورقة A4 جاهزة
 * للطباعة (qr-labels.html) تُلصق على الرف والعبوة.
 *
 * الاستخدام:
 *   node scripts/generate-qr.mjs --base https://USER.github.io/REPO/ --out dist-qr
 * في النشر التلقائي يُنفَّذ هذا تلقائياً ويُنشر على /labels/qr-labels.html.
 * ============================================================================
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import QRCode from 'qrcode';
import { chemicals } from '../assets/js/data.js';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const base = arg('base', '');
const out = arg('out', 'dist-qr');

if (!/^https?:\/\/.+/.test(base)) {
  console.error('✗ مطلوب --base برابط الموقع كاملاً، مثال: --base https://user.github.io/steward-guide/');
  process.exit(1);
}

const baseUrl = base.endsWith('/') ? base : `${base}/`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const DANGER = { low: 'منخفضة', med: 'متوسطة', high: 'عالية' };

mkdirSync(join(out, 'svg'), { recursive: true });

const labels = [];
for (const chem of chemicals) {
  const url = `${baseUrl}index.html#chemicals?open=${chem.id}`;
  const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, width: 160 });
  writeFileSync(join(out, 'svg', `chemical-${chem.id}.svg`), svg);
  labels.push(`
    <figure class="label label--${esc(chem.danger)}">
      ${svg}
      <figcaption>
        <strong dir="ltr">${esc(chem.nameEn)}</strong>
        <span>${esc(chem.nameAr)}</span>
        <small>الخطورة: ${DANGER[chem.danger] ?? ''}</small>
      </figcaption>
    </figure>`);
}

const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ملصقات QR — دليل الاستيوارد</title>
<style>
  @page { size: A4; margin: 10mm; }
  body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 12px; color: #111; }
  header { text-align: center; margin-bottom: 8px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; }
  .label { margin: 0; padding: 6px; border: 2px solid #111; border-radius: 6px; text-align: center; break-inside: avoid; }
  .label--high { border-color: #b00020; }
  .label svg { width: 100%; max-width: 120px; height: auto; }
  figcaption { display: flex; flex-direction: column; gap: 2px; font-size: 12px; }
  figcaption strong { font-size: 13px; }
  small { color: #444; }
  .note { font-size: 12px; margin-top: 8px; text-align: center; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <header>
    <h1>ملصقات QR للمواد الكيميائية</h1>
    <button class="no-print" onclick="window.print()">🖨️ طباعة</button>
    <p class="note">امسح الكود بكاميرا الجوال لفتح بطاقة المادة. الرابط الأساسي: ${esc(baseUrl)}</p>
  </header>
  <main class="grid">${labels.join('\n')}
  </main>
</body>
</html>
`;

writeFileSync(join(out, 'qr-labels.html'), html);
console.log(`✓ ${chemicals.length} ملصق QR في ${out}/ (افتح qr-labels.html للطباعة)`);
