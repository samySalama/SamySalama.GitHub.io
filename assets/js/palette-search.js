/** palette-search.js — بحث نقي (بلا DOM) للوحة الأوامر: تطبيع عربي + ترتيب بالنقاط + تسامح إملائي. */
import { isFuzzyMatch } from './fuzzy.js';

export function norm(s) {
  return String(s ?? '').toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ').trim();
}

/** @param {{kind:string,title:string,hay:string}[]} items */
export function searchItems(items, query, limit = 8) {
  const q = norm(query);
  if (!q) return items.filter((i) => i.kind === 'page').slice(0, limit);
  const words = q.split(' ').filter((w) => w.length >= 4);
  const scored = [];
  for (const item of items) {
    const title = norm(item.title);
    let score = 0;
    if (title.startsWith(q)) score = 4;
    else if (title.includes(q)) score = 3;
    else if (item.hay.includes(q)) score = 1;
    else if (words.length) {
      const hw = item.hay.split(/[^a-z0-9\u0600-\u06FF]+/).filter(Boolean);
      if (words.every((w) => hw.some((h) => isFuzzyMatch(w, h)))) score = 0.5;
    }
    if (score) scored.push({ item, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.item);
}
