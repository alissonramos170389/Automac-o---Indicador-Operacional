/* ==========================================================================
   STORE — estado da aplicação, filtros globais e visões filtradas.
   As telas só leem daqui (nunca do simulador ou dos adapters diretamente).
   A visão filtrada é memoizada pela combinação de filtros: trocar de tela
   não recalcula nada.
   ========================================================================== */
IOA.store = (function () {
  const U = IOA.utils, R = IOA.ref;
  const DAY = 86400000;

  const DEFAULT_FILTERS = {
    uf: '', city: '', partner_code: '', partner_name: '', technology: '', operator: '',
    category: '', severity: '', inc_status: '', date_preset: '7d', date_from: '', date_to: ''
  };

  const state = {
    data: null, engine: null, engineConfig: null,
    filters: Object.assign({}, DEFAULT_FILTERS),
    loadErrors: [], lastUpdate: null, version: 0
  };
  const listeners = new Set();
  const idx = {};

  function init(data, errors) {
    state.data = data;
    state.loadErrors = errors || [];
    state.lastUpdate = Date.now();
    idx.partner = new Map(data.partners.map((p) => [p.partner_code, p]));
    idx.event = new Map(data.events.map((e) => [e.event_id, e]));
    idx.incident = new Map(data.incidents.map((i) => [i.incident_id, i]));
    idx.incByPartner = U.groupBy(data.incidents, (i) => i.partner_code);
    idx.cmdbByPartner = U.groupBy(data.cmdb, (c) => c.partner_code);
    idx.zabbix = new Map(data.zabbix.map((z) => [z.partner_code, z]));
    try { const saved = JSON.parse(localStorage.getItem('ioa.engine') || 'null'); if (saved) state.engineConfig = saved; } catch (e) { /* sem storage */ }
    runEngine();
  }

  function runEngine(cfg) {
    if (cfg) { state.engineConfig = cfg; try { localStorage.setItem('ioa.engine', JSON.stringify(cfg)); } catch (e) { /* ignore */ } }
    state.engine = IOA.engine.run(state.data, state.engineConfig);
    idx.occ = new Map(state.engine.occurrences.map((o) => [o.id, o]));
    state.version++;
    emit();
  }

  function setFilters(patch) {
    Object.assign(state.filters, patch);
    if ('uf' in patch && !('city' in patch)) state.filters.city = '';
    state.version++;
    emit();
  }
  function resetFilters() { state.filters = Object.assign({}, DEFAULT_FILTERS); state.version++; emit(); }
  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function emit() { listeners.forEach((fn) => fn(state)); }

  /* ---------- intervalo de datas ---------- */
  function dateRange() {
    const f = state.filters, now = state.data.now;
    const presets = { '24h': 1, '7d': 7, '30d': 30, '90d': 90, '12m': 365 };
    if (f.date_preset !== 'custom') return { from: now - presets[f.date_preset] * DAY, to: Infinity, days: presets[f.date_preset] };
    const from = f.date_from ? Date.parse(f.date_from + 'T00:00:00-03:00') : now - 7 * DAY;
    const to = f.date_to ? Date.parse(f.date_to + 'T23:59:59-03:00') : Infinity;
    return { from, to, days: Math.max(1, Math.round(((to === Infinity ? now : to) - from) / DAY)) };
  }

  /* ---------- categorias atribuídas a uma ocorrência (para o filtro) ---------- */
  function occCategories(o) {
    const cats = new Set();
    const ev = o.primary_event && idx.event.get(o.primary_event);
    const add = (r) => {
      if (r === 'R1') {
        if (ev && ev.category.startsWith('telecom')) cats.add(ev.category);
        else {
          const p = idx.partner.get(o.partners[0]);
          cats.add(R.isMobile(p.connectivity_type) ? 'telecom_movel' : 'telecom_fixa');
        }
      }
      if (r === 'R2') cats.add('energia');
      if (r === 'R3') cats.add('clima');
      if (r === 'R4' || r === 'R6') { cats.add('telecom_movel'); cats.add('telecom_fixa'); cats.add('energia'); }
      if (r === 'R5' || r === 'ISO') {
        o.partners.forEach((c) => { const p = idx.partner.get(c); cats.add(R.isMobile(p.connectivity_type) ? 'telecom_movel' : 'telecom_fixa'); });
        if (o.category === 'energia') cats.add('energia');
      }
    };
    add(o.rule); o.supporting.forEach(add);
    return cats;
  }

  /* ---------- visão filtrada (memoizada) ---------- */
  const compute = U.memo(function () {
    const f = state.filters, d = state.data, eng = state.engine;
    const range = dateRange();
    const inRange = (start, end) => Date.parse(start) <= range.to && (end ? Date.parse(end) : d.now) >= range.from;
    const nameQ = U.norm(f.partner_name);

    const partners = d.partners.filter((p) =>
      (!f.uf || p.state === f.uf) && (!f.city || p.city === f.city) &&
      (!f.partner_code || p.partner_code.includes(f.partner_code.trim())) &&
      (!nameQ || U.norm(p.partner_name).includes(nameQ)) &&
      (!f.technology || p.connectivity_type === f.technology) &&
      (!f.operator || p.telecom_operator === f.operator));
    const pset = new Set(partners.map((p) => p.partner_code));
    const partnerFilterActive = !!(f.uf || f.city || f.partner_code || f.partner_name || f.technology || f.operator);

    const occAll = eng.occurrences.filter((o) =>
      o.partners.some((c) => pset.has(c)) &&
      (!f.severity || o.severity === f.severity) &&
      (!f.inc_status || (f.inc_status === 'resolvido' ? o.status === 'resolvido' : o.status !== 'resolvido')) &&
      (!f.category || occCategories(o).has(f.category)) &&
      inRange(o.first_seen, o.status === 'resolvido' ? o.last_seen : null));

    const weatherOccPartners = new Set(eng.occurrences.filter((o) => o.rule === 'R3').flatMap((o) => o.partners));
    const incCatOk = (i) => !f.category ||
      (f.category.startsWith('telecom') && i.category === 'conectividade') ||
      (f.category === 'energia' && i.category === 'energia') ||
      (f.category === 'clima' && weatherOccPartners.has(i.partner_code));
    const incidents = d.incidents.filter((i) => pset.has(i.partner_code) &&
      (!f.severity || i.severity === f.severity) &&
      (!f.inc_status || (f.inc_status === 'resolvido' ? i.status === 'resolvido' : f.inc_status === i.status)) &&
      incCatOk(i) && inRange(i.start_time, i.end_time));

    const events = d.events.filter((e) =>
      (!f.uf || e.state === f.uf) && (!f.city || e.city === f.city) &&
      (!f.category || e.category === f.category) &&
      (!f.severity || e.severity === f.severity) &&
      (!f.operator || !e.operator || e.operator === f.operator) &&
      (!f.technology || !e.technology || e.technology === f.technology) &&
      (!(f.partner_code || f.partner_name) || (eng.eventImpact.get(e.event_id) || { nearby: [] }).nearby.some((c) => pset.has(c))) &&
      inRange(e.start_time, e.end_time));

    const occIds = new Set(occAll.map((o) => o.id));
    const correlations = eng.correlations.filter((c) => occIds.has(c.occurrence_id) && pset.has(c.partner_code));
    return { partners, pset, partnerFilterActive, incidents, events, occurrences: occAll, correlations, range };
  });
  function view() { return compute(state.version); }

  /* ---------- consultas auxiliares ---------- */
  const partner = (c) => idx.partner.get(c);
  const event = (id) => idx.event.get(id);
  const incident = (id) => idx.incident.get(id);
  const occurrence = (id) => idx.occ.get(id);
  const partnerIncidents = (c) => idx.incByPartner.get(c) || [];
  const partnerCmdb = (c) => idx.cmdbByPartner.get(c) || [];
  const partnerZabbix = (c) => idx.zabbix.get(c);
  const diag = (c) => state.engine.partnerDiag.get(c);
  const impact = (id) => state.engine.eventImpact.get(id) || { nearby: [], affected: [], offline: [], incidents: [], occurrences: [] };

  /** Eventos externos ativos próximos a um conveniado (raio do evento + tolerância). */
  function eventsNear(p, extraKm) {
    const buf = extraKm != null ? extraKm : state.engine.config.event_buffer_km;
    return state.data.events.filter((e) => e.realtime !== false && e.event_status !== 'resolvido' &&
      U.haversineKm(p.latitude, p.longitude, e.latitude, e.longitude) <= e.affected_radius + buf)
      .map((e) => ({ e, dist: U.haversineKm(p.latitude, p.longitude, e.latitude, e.longitude) }));
  }

  /** Série histórica curta e determinística para sparklines (dados simulados). */
  function series(key, current, n) {
    n = n || 14;
    let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const r = U.rng(h);
    const base = Math.max(1, current * (0.55 + r() * 0.4));
    const out = [];
    for (let i = 0; i < n - 1; i++) out.push(Math.max(0, Math.round(base * (0.6 + r() * 0.8))));
    out.push(current);
    return out;
  }

  return {
    state, DEFAULT_FILTERS, init, runEngine, setFilters, resetFilters, subscribe, view, dateRange, occCategories,
    partner, event, incident, occurrence, partnerIncidents, partnerCmdb, partnerZabbix, diag, impact, eventsNear, series
  };
})();
