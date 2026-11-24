/* ==========================================================================
   Utilitários gerais (sem dependência de DOM de telas)
   Namespace global IOA para funcionar abrindo o index.html direto (file://),
   onde ES modules não carregam.
   ========================================================================== */
window.IOA = window.IOA || {};
IOA.views = IOA.views || {};

IOA.utils = (function () {
  const TZ = 'America/Sao_Paulo';

  /* ---------- RNG determinístico (mulberry32) ---------- */
  function rng(seed) {
    let a = seed >>> 0;
    const next = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.int = (min, max) => Math.floor(next() * (max - min + 1)) + min;
    next.pick = (arr) => arr[Math.floor(next() * arr.length)];
    next.weighted = (pairs) => { // [[valor, peso], ...]
      const total = pairs.reduce((s, p) => s + p[1], 0);
      let r = next() * total;
      for (const p of pairs) { if ((r -= p[1]) <= 0) return p[0]; }
      return pairs[pairs.length - 1][0];
    };
    next.jitter = (v, amp) => v + (next() - 0.5) * 2 * amp;
    return next;
  }

  /* ---------- Geografia ---------- */
  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371, toRad = Math.PI / 180;
    const dLat = (lat2 - lat1) * toRad, dLon = (lon2 - lon1) * toRad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  /* ---------- Datas (sempre exibidas em America/Sao_Paulo) ---------- */
  const fmtDT = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtD = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtT = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const fmtHM = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  const fmtMon = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, month: 'short', year: '2-digit' });
  const fmtDM = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit' });

  const toDate = (v) => (v instanceof Date ? v : new Date(v));
  const dt = (v) => (v ? fmtDT.format(toDate(v)).replace(',', '') : '—');
  const d = (v) => (v ? fmtD.format(toDate(v)) : '—');
  const time = (v) => (v ? fmtT.format(toDate(v)) : '—');
  const hm = (v) => (v ? fmtHM.format(toDate(v)) : '—');
  const dm = (v) => (v ? fmtDM.format(toDate(v)) : '—');
  const month = (v) => fmtMon.format(toDate(v)).replace('.', '');

  /** Data no formato YYYY-MM-DD segundo o fuso de São Paulo (para inputs date). */
  function isoDateSP(v) {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(toDate(v));
    return p; // en-CA já sai como YYYY-MM-DD
  }

  function duration(min) {
    if (min == null || isNaN(min)) return '—';
    min = Math.round(min);
    if (min < 60) return min + ' min';
    const h = Math.floor(min / 60), m = min % 60;
    if (h < 24) return h + 'h' + (m ? String(m).padStart(2, '0') : '');
    const dd = Math.floor(h / 24);
    return dd + 'd ' + (h % 24) + 'h';
  }

  function ago(v, now) {
    const diff = ((now || Date.now()) - toDate(v).getTime()) / 60000;
    if (diff < 1) return 'agora';
    if (diff < 60) return 'há ' + Math.round(diff) + ' min';
    if (diff < 1440) return 'há ' + Math.round(diff / 60) + ' h';
    return 'há ' + Math.round(diff / 1440) + ' d';
  }

  /* ---------- Números ---------- */
  const nf = new Intl.NumberFormat('pt-BR');
  const num = (v) => (v == null ? '—' : nf.format(v));
  const pct = (v, dec = 1) => (v == null || isNaN(v) ? '—' : (v * 100).toFixed(dec).replace('.', ',') + '%');

  /* ---------- Texto / HTML ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  /* ---------- Coleções ---------- */
  function groupCount(arr, keyFn) {
    const m = new Map();
    for (const x of arr) { const k = keyFn(x); if (k == null) continue; m.set(k, (m.get(k) || 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }
  function groupBy(arr, keyFn) {
    const m = new Map();
    for (const x of arr) { const k = keyFn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
    return m;
  }
  const sum = (arr, fn) => arr.reduce((s, x) => s + (fn ? fn(x) : x), 0);
  const avg = (arr, fn) => (arr.length ? sum(arr, fn) / arr.length : null);
  const uniq = (arr) => [...new Set(arr)];

  /* ---------- Memoização por chave (evita recálculo a cada render) ---------- */
  function memo(fn) {
    let lastKey = null, lastVal;
    return function (key, ...args) {
      if (key === lastKey) return lastVal;
      lastKey = key; lastVal = fn(...args);
      return lastVal;
    };
  }

  /* ---------- CSV ---------- */
  function toCSV(rows, columns) {
    const sep = ';'; // padrão Excel pt-BR
    const q = (v) => {
      const s = v == null ? '' : String(v);
      return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const head = columns.map((c) => q(c.label)).join(sep);
    const body = rows.map((r) => columns.map((c) => q(typeof c.csv === 'function' ? c.csv(r) : (typeof c.value === 'function' ? c.value(r) : r[c.key]))).join(sep));
    return '﻿' + [head, ...body].join('\r\n');
  }
  function downloadCSV(filename, rows, columns) {
    const blob = new Blob([toCSV(rows, columns)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function debounce(fn, ms) {
    let t; return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
  }

  return { TZ, rng, haversineKm, dt, d, time, hm, dm, month, isoDateSP, duration, ago, num, pct, esc, norm, groupCount, groupBy, sum, avg, uniq, memo, toCSV, downloadCSV, debounce };
})();
