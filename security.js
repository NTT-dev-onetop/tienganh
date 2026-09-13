// security.js
// Client-side obfuscation is NOT encryption and cannot protect answers from
// someone who can inspect the browser bundle. Real answer protection requires
// trusted server-side grading; this file only preserves compatibility with
// the existing client format.
const XOR_KEY = 73;
const LEGACY_SECRET = 'EN11T1-client-secret-v1';

export function encodeCorrectIndex(index) {
  const n = Number(index);
  if (!Number.isInteger(n) || n < 0 || n > 9) return '';
  try { return btoa(String(n ^ XOR_KEY)); } catch { return ''; }
}

export function decodeCorrectIndex(code) {
  if (typeof code !== 'string' || !code.trim()) return -1;
  try {
    const idx = Number(atob(code)) ^ XOR_KEY;
    return Number.isInteger(idx) && idx >= 0 && idx <= 9 ? idx : -1;
  } catch { return -1; }
}

export function simpleHash(input) {
  let h = 2166136261;
  for (const c of String(input ?? '')) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// Legacy compatibility only. Do not use this as a security check.
export function makeSignature(uid, setId, score, date) {
  return simpleHash(`${uid}|${setId}|${score}|${date}|${LEGACY_SECRET}`);
}

export function isValidToday(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date();
  const local = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return date === local;
}
