/* ==========================================================================
   Componentes de apresentação reutilizáveis (sem regra de negócio)
   ========================================================================== */
IOA.ui = (function () {
  const U = IOA.utils, R = IOA.ref;

  /* ---------------- Ícones (SVG inline, traço) ---------------- */
  const P = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
    antenna: '<path d="M5 12a7 7 0 0 1 14 0"/><path d="M8.5 12a3.5 3.5 0 0 1 7 0"/><circle cx="12" cy="12" r="1"/><path d="M12 13v8M9 21h6"/>',
    cable: '<path d="M4 9a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v1"/><path d="M4 15a5 5 0 0 0 5 5h6a5 5 0 0 0 5-5"/><path d="M2 12h4M18 12h4"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
    cloud: '<path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1 0 8H7z"/><path d="M9 21l1-2M13 21l1-2"/>',
    link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    chevron: '<path d="m15 18-6-6 6-6"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5z"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    pin: '<path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 20a6.5 6.5 0 0 0-3-5.5"/>',
    ticket: '<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4V8z"/><path d="M13 6v12" stroke-dasharray="2 2"/>',
    layers: '<path d="m12 2 10 6-10 6L2 8l10-6z"/><path d="m2 16 10 6 10-6"/><path d="m2 12 10 6 10-6"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
    db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>'
  };
  const icon = (name, cls) => `<svg class="i ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${P[name] || ''}</svg>`;

  /* ---------------- Cores semânticas ---------------- */
  const SEV_COLOR = { critica: '#D92D20', alta: '#E0620B', media: '#C27803', baixa: '#2563EB' };
  const CAT_COLOR = { telecom_movel: '#2563EB', telecom_fixa: '#0891B2', energia: '#D97706', clima: '#7C3AED' };
  const OP_COLOR = { Claro: '#D92D20', Vivo: '#7C3AED', TIM: '#2563EB', Algar: '#0E9F6E', Oi: '#E0A526', 'Provedor regional': '#64748B', Outros: '#A3AEC2' };
  const PALETTE = ['#2563EB', '#0E9F6E', '#E0620B', '#7C3AED', '#0891B2', '#D92D20', '#C27803', '#64748B', '#DB2777', '#4D7C0F'];

  /* ---------------- Badges ---------------- */
  const badge = (text, cls) => `<span class="badge ${cls || ''}">${U.esc(text)}</span>`;
  const sev = (s) => (s && R.SEVERITIES[s] ? `<span class="badge ${R.SEVERITIES[s].cls}"><span class="bdot"></span>${R.SEVERITIES[s].label}</span>` : '—');
  function conf(c) {
    if (!c) return '<span class="badge muted">Sem correlação externa</span>';
    const k = R.CONFIDENCE[c];
    const bars = [1, 2, 3, 4, 5].map((i) => `<i class="${i <= k.rank ? 'on' : ''}"></i>`).join('');
    return `<span class="badge ${k.cls === 'conf' ? 'ana' : k.cls}" title="${U.esc(k.desc)}">${k.label}<span class="conf-scale">${bars}</span></span>`;
  }
  const evStatus = (s) => badge(R.EVENT_STATUS[s] || s, s === 'ativo' ? 'crit' : s === 'resolvido' ? 'ok' : s === 'previsto' ? 'outline' : 'warn');
  const incStatus = (s) => badge(R.INCIDENT_STATUS[s] || s, s === 'resolvido' ? 'ok' : s === 'em_atendimento' ? 'warn' : 'crit');
  const partnerStatus = (s) => badge(s === 'online' ? 'Online' : s === 'offline' ? 'Offline' : 'Degradado', s === 'online' ? 'ok' : s === 'offline' ? 'crit' : 'warn');
  const cat = (c) => { const k = R.EVENT_CATEGORIES[c]; return k ? `<span class="badge" style="background:${k.color}14;color:${k.color}">${k.short}</span>` : ''; };
  function evidence(type) {
    const e = R.EVIDENCE[type]; if (!e) return '';
    const cls = { oficial: 'ana', confirmado_operadora: 'ana', alerta_oficial: 'ana', alerta_distribuidora: 'high', degradacao_reportada: 'high', observado: 'info', previsao: 'outline', historico: 'muted', inferido: 'warn', nao_confirmado: 'muted' }[type];
    return badge(e.label, cls);
  }
  const sim = (txt) => `<span class="badge sim" title="Dado simulado para demonstração — não é um evento real">${U.esc(txt || 'SIMULADO')}</span>`;
  const ruleChip = (r, sup) => `<span class="rule-chip ${sup ? 'sup' : ''}" title="${U.esc(IOA.engine.RULES[r] ? IOA.engine.RULES[r].name : r)}">${r}</span>`;

  /* ---------------- Sparkline SVG (leve, sem instanciar gráfico) ---------------- */
  function sparkline(values, color) {
    const w = 74, h = 28, pad = 2;
    const max = Math.max(...values, 1), min = Math.min(...values, 0);
    const sx = (i) => pad + (i * (w - pad * 2)) / (values.length - 1);
    const sy = (v) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
    const pts = values.map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
    const area = `${sx(0)},${h} ${pts} ${sx(values.length - 1)},${h}`;
    return `<svg class="kpi-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polygon points="${area}" fill="${color}" opacity=".10"/><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="${sx(values.length - 1)}" cy="${sy(values[values.length - 1])}" r="2.2" fill="${color}"/></svg>`;
  }

  /** Card de KPI. higherIsBad: aumento é ruim (vermelho). */
  function kpi(o) {
    const delta = o.prev == null ? null : o.value - o.prev;
    const pctTxt = o.prev ? Math.round((delta / o.prev) * 100) : null;
    let cls = 'flat', arrow = '→';
    if (delta > 0) { cls = o.higherIsBad === false ? 'up-good' : 'up-bad'; arrow = '▲'; }
    if (delta < 0) { cls = o.higherIsBad === false ? 'down-bad' : 'down-good'; arrow = '▼'; }
    const spark = o.series ? sparkline(o.series, o.tone || '#2563EB') : '';
    return `<button class="kpi" data-kpi="${o.id}" style="--tone:${o.tone || '#2563EB'}" title="${U.esc(o.hint || 'Clique para detalhar')}">
      <span class="kpi-label">${U.esc(o.label)}</span>
      <span class="kpi-row"><span class="kpi-value">${o.display != null ? o.display : U.num(o.value)}${o.unit ? `<small>${o.unit}</small>` : ''}</span>${spark}</span>
      <span class="kpi-delta">${delta == null ? '<span class="flat">sem base de comparação</span>' : `<b class="${cls}">${arrow} ${delta > 0 ? '+' : ''}${U.num(delta)}${pctTxt != null && isFinite(pctTxt) ? ` (${pctTxt > 0 ? '+' : ''}${pctTxt}%)` : ''}</b> ${U.esc(o.prevLabel || 'vs. período anterior')}`}</span>
    </button>`;
  }

  /* ---------------- Estados ---------------- */
  const empty = (title, text, ic) => `<div class="empty">${icon(ic || 'info')}<h4>${U.esc(title)}</h4><div>${U.esc(text || '')}</div></div>`;
  const loading = (text) => `<div class="loading"><div class="spinner"></div><div>${U.esc(text || 'Carregando…')}</div></div>`;

  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
  }

  /* ---------------- Tabela com ordenação, paginação e CSV ---------------- */
  class DataTable {
    /**
     * @param {HTMLElement} el
     * @param {{columns:Array, rows:Array, pageSize?:number, sort?:{key,dir}, onRowClick?:Function, csvName?:string, emptyTitle?:string, emptyText?:string}} o
     */
    constructor(el, o) {
      this.el = el; this.o = Object.assign({ pageSize: 10 }, o);
      this.page = 0; this.sort = o.sort || null;
      this.render();
    }
    setRows(rows) { this.o.rows = rows; this.page = 0; this.render(); }
    sortedRows() {
      const rows = this.o.rows.slice();
      if (!this.sort) return rows;
      const col = this.o.columns.find((c) => c.key === this.sort.key);
      const val = (r) => (col.sortValue ? col.sortValue(r) : col.value ? col.value(r) : r[col.key]);
      const dir = this.sort.dir === 'asc' ? 1 : -1;
      return rows.sort((a, b) => {
        const va = val(a), vb = val(b);
        if (va == null && vb == null) return 0; if (va == null) return 1; if (vb == null) return -1;
        return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR', { numeric: true })) * dir;
      });
    }
    render() {
      const { columns, pageSize } = this.o;
      const rows = this.sortedRows();
      const pages = Math.max(1, Math.ceil(rows.length / pageSize));
      if (this.page >= pages) this.page = pages - 1;
      const slice = rows.slice(this.page * pageSize, (this.page + 1) * pageSize);
      this.pageRows = slice;
      const th = columns.map((c) => {
        const sorted = this.sort && this.sort.key === c.key;
        const arrow = sorted ? (this.sort.dir === 'asc' ? '▲' : '▼') : '↕';
        return `<th class="${c.sortable === false ? '' : 'sortable'} ${sorted ? 'sorted' : ''} ${c.num ? 'num' : ''}" data-key="${c.key}">${U.esc(c.label)}${c.sortable === false ? '' : `<span class="arrow">${arrow}</span>`}</th>`;
      }).join('');
      const body = slice.length ? slice.map((r, i) => `<tr class="${this.o.onRowClick ? 'clickable' : ''}" data-i="${i}">${columns.map((c) => `<td class="${c.num ? 'num' : ''} ${c.cls || ''}">${c.render ? c.render(r) : U.esc(c.value ? c.value(r) : r[c.key])}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${columns.length}">${empty(this.o.emptyTitle || 'Nenhum registro', this.o.emptyText || 'Ajuste os filtros para ver resultados.', 'filter')}</td></tr>`;
      const pagerBtns = [];
      const start = Math.max(0, Math.min(this.page - 2, pages - 5));
      for (let p = start; p < Math.min(pages, start + 5); p++) pagerBtns.push(`<button data-p="${p}" class="${p === this.page ? 'on' : ''}">${p + 1}</button>`);
      this.el.innerHTML = `<div class="table-wrap"><table class="dt"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>
        <div class="dt-foot"><span>${U.num(rows.length)} registro(s)${rows.length > pageSize ? ` · página ${this.page + 1} de ${pages}` : ''}</span>
        <span class="pager">${this.o.csvName ? `<button class="btn sm" data-csv style="margin-right:8px">${icon('download')} CSV</button>` : ''}${pages > 1 ? `<button data-p="prev" ${this.page === 0 ? 'disabled' : ''}>‹</button>${pagerBtns.join('')}<button data-p="next" ${this.page >= pages - 1 ? 'disabled' : ''}>›</button>` : ''}</span></div>`;
      this.el.querySelectorAll('th.sortable').forEach((h) => h.addEventListener('click', () => {
        const k = h.dataset.key;
        this.sort = this.sort && this.sort.key === k ? { key: k, dir: this.sort.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'desc' };
        this.render();
      }));
      this.el.querySelectorAll('.pager button[data-p]').forEach((b) => b.addEventListener('click', () => {
        const v = b.dataset.p; this.page = v === 'prev' ? this.page - 1 : v === 'next' ? this.page + 1 : +v; this.render();
      }));
      const csv = this.el.querySelector('[data-csv]');
      if (csv) csv.addEventListener('click', () => this.exportCSV());
      if (this.o.onRowClick) this.el.querySelectorAll('tbody tr.clickable').forEach((tr) => tr.addEventListener('click', (e) => {
        if (e.target.closest('a,button')) return;
        const r = this.pageRows[+tr.dataset.i]; if (r) this.o.onRowClick(r);
      }));
    }
    exportCSV() {
      const cols = this.o.columns.filter((c) => c.csv !== false).map((c) => ({ label: c.label, value: c.csv || c.value || ((r) => r[c.key]) }));
      U.downloadCSV(this.o.csvName + '_' + U.isoDateSP(Date.now()) + '.csv', this.sortedRows(), cols);
      toast('CSV exportado (' + this.o.rows.length + ' linhas, dados simulados).');
    }
  }

  /* ---------------- Drawer de detalhes ---------------- */
  const drawer = (function () {
    let el, back, stack = [];
    function ensure() {
      if (el) return;
      back = document.createElement('div'); back.className = 'drawer-backdrop';
      el = document.createElement('aside'); el.className = 'drawer'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
      document.body.append(back, el);
      back.addEventListener('click', close);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    }
    function open(o, push) {
      ensure();
      if (!push) stack = [];
      stack.push(o);
      paint();
    }
    function paint() {
      const o = stack[stack.length - 1];
      el.innerHTML = `<div class="drawer-head"><div style="min-width:0">
          ${stack.length > 1 ? `<button class="btn sm" data-back style="margin-bottom:6px">${icon('chevron')} Voltar</button>` : ''}
          <div class="kicker">${o.kicker || ''}</div><h2>${o.title}</h2>${o.badges ? `<div class="badges">${o.badges}</div>` : ''}</div>
          <button class="drawer-close" aria-label="Fechar">${icon('close')}</button></div>
        <div class="drawer-body">${o.body}</div>`;
      el.querySelector('.drawer-close').addEventListener('click', close);
      const b = el.querySelector('[data-back]'); if (b) b.addEventListener('click', () => { stack.pop(); paint(); });
      el.classList.add('open'); back.classList.add('open');
      el.querySelector('.drawer-body').scrollTop = 0;
      if (o.onMount) o.onMount(el.querySelector('.drawer-body'));
    }
    function close() { if (!el) return; el.classList.remove('open'); back.classList.remove('open'); stack = []; }
    return { open, close };
  })();

  /* ---------------- Gráficos (Chart.js) ---------------- */
  const charts = (function () {
    const registry = new Map();
    function base() {
      if (!window.Chart) return;
      Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
      Chart.defaults.font.size = 11;
      Chart.defaults.color = '#4A5A75';
      Chart.defaults.plugins.legend.labels.boxWidth = 10;
      Chart.defaults.plugins.legend.labels.boxHeight = 10;
      Chart.defaults.plugins.tooltip.backgroundColor = '#0F1D36';
      Chart.defaults.plugins.tooltip.padding = 8;
      Chart.defaults.maintainAspectRatio = false;
      Chart.defaults.animation.duration = 250;
    }
    function make(canvas, cfg) {
      if (!window.Chart) { canvas.parentElement.innerHTML = empty('Biblioteca de gráficos indisponível', 'Chart.js não foi carregado.', 'alert'); return null; }
      destroy(canvas.id);
      const c = new Chart(canvas, cfg);
      registry.set(canvas.id, c);
      return c;
    }
    function destroy(id) { if (registry.has(id)) { registry.get(id).destroy(); registry.delete(id); } }
    function destroyAll() { registry.forEach((c) => c.destroy()); registry.clear(); }
    const grid = { color: '#EEF1F6' };
    function bar(id, labels, datasets, opts) {
      opts = opts || {};
      const el = document.getElementById(id); if (!el) return null;
      if (!labels.length) { el.parentElement.innerHTML = empty('Sem dados', 'Nenhum registro para os filtros atuais.', 'filter'); return null; }
      return make(el, {
        type: 'bar',
        data: { labels, datasets: datasets.map((d, i) => Object.assign({ backgroundColor: d.colors || PALETTE[i], borderRadius: 3, maxBarThickness: 26 }, d)) },
        options: {
          indexAxis: opts.horizontal ? 'y' : 'x',
          plugins: { legend: { display: datasets.length > 1, position: 'bottom' } },
          scales: {
            x: { stacked: !!opts.stacked, grid: opts.horizontal ? grid : { display: false }, ticks: { precision: 0 } },
            y: { stacked: !!opts.stacked, grid: opts.horizontal ? { display: false } : grid, ticks: { precision: 0 }, beginAtZero: true }
          },
          onClick: opts.onClick ? (e, els) => { if (els.length) opts.onClick(labels[els[0].index], els[0]); } : undefined,
          onHover: opts.onClick ? (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; } : undefined
        }
      });
    }
    function doughnut(id, labels, data, colors, opts) {
      opts = opts || {};
      const el = document.getElementById(id); if (!el) return null;
      if (!data.some((v) => v > 0)) { el.parentElement.innerHTML = empty('Sem dados', 'Nenhum registro para os filtros atuais.', 'filter'); return null; }
      return make(el, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
        options: {
          cutout: '62%',
          plugins: { legend: { position: 'right' } },
          onClick: opts.onClick ? (e, els) => { if (els.length) opts.onClick(labels[els[0].index]); } : undefined,
          onHover: opts.onClick ? (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; } : undefined
        }
      });
    }
    function line(id, labels, datasets, opts) {
      opts = opts || {};
      const el = document.getElementById(id); if (!el) return null;
      return make(el, {
        type: 'line',
        data: { labels, datasets: datasets.map((d, i) => Object.assign({ borderColor: PALETTE[i], backgroundColor: PALETTE[i] + '22', tension: 0.3, pointRadius: 2, borderWidth: 2 }, d)) },
        options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' } }, scales: Object.assign({ x: { grid: { display: false } }, y: { grid, beginAtZero: true, ticks: { precision: 0 } } }, opts.scales || {}) }
      });
    }
    function scatter(id, points, opts) {
      const el = document.getElementById(id); if (!el) return null;
      return make(el, {
        type: 'scatter',
        data: { datasets: [{ data: points, backgroundColor: (opts.color || '#6D3FD8') + '88', pointRadius: 4 }].concat(opts.trend ? [{ type: 'line', data: opts.trend, borderColor: '#0F1D36', borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, label: 'Tendência linear' }] : []) },
        options: {
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => (c.raw.label ? c.raw.label + ': ' : '') + c.raw.x + ' / ' + c.raw.y } } },
          scales: { x: { title: { display: true, text: opts.xLabel }, grid }, y: { title: { display: true, text: opts.yLabel }, grid, beginAtZero: true } }
        }
      });
    }
    return { base, bar, doughnut, line, scatter, destroy, destroyAll, PALETTE };
  })();

  return { icon, badge, sev, conf, evStatus, incStatus, partnerStatus, cat, evidence, sim, ruleChip, sparkline, kpi, empty, loading, toast, DataTable, drawer, charts, SEV_COLOR, CAT_COLOR, OP_COLOR, PALETTE };
})();
