/* ==========================================================================
   TELA 7 — HISTÓRICO E RELATÓRIOS (base consolidada, separada dos eventos atuais)
   ========================================================================== */
IOA.views.historico = (function () {
  const U = IOA.utils, R = IOA.ref, S = IOA.store, ui = IOA.ui;

  function data() {
    const f = S.state.filters, h = S.state.data.history;
    const range = S.dateRange();
    const useGlobal = range.days >= 90 || f.date_preset === 'custom';
    const inR = (iso) => !useGlobal || (Date.parse(iso) >= range.from && Date.parse(iso) <= range.to);
    const events = h.events.filter((e) =>
      (!f.uf || e.state === f.uf) && (!f.city || e.city === f.city) && (!f.category || e.category === f.category) &&
      (!f.severity || e.severity === f.severity) && (!f.operator || e.operator === f.operator) && inR(e.start_time));
    const months = U.uniq(h.monthly.map((m) => m.month)).filter((m) => !useGlobal || inR(m + '-15T12:00:00Z'));
    const monthly = h.monthly.filter((m) => (!f.uf || m.state === f.uf) && months.includes(m.month));
    return { events, monthly, months, useGlobal };
  }

  function regression(pts) {
    if (pts.length < 3) return null;
    const mx = U.avg(pts, (p) => p.x), my = U.avg(pts, (p) => p.y);
    let sxy = 0, sxx = 0, syy = 0;
    pts.forEach((p) => { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; });
    const b = sxy / (sxx || 1), a = my - b * mx, xs = pts.map((p) => p.x);
    return { r: sxy / Math.sqrt((sxx || 1) * (syy || 1)), line: [{ x: Math.min(...xs), y: a + b * Math.min(...xs) }, { x: Math.max(...xs), y: a + b * Math.max(...xs) }] };
  }
  const monthLabel = (m) => U.month(m + '-15T12:00:00Z');

  function render(el) {
    const { events, monthly, months, useGlobal } = data();
    const avgTTD = U.avg(events, (e) => e.ttd_min), avgTTR = U.avg(events, (e) => e.ttr_min);
    const affected = U.sum(events, (e) => e.partners_affected);
    const strong = events.filter((e) => ['confirmada', 'alta'].includes(e.confidence)).length;
    const repeated = U.groupCount(events, (e) => e.city + '/' + e.state).filter((x) => x[1] >= 5);

    el.innerHTML = `
      <div class="info-banner">${ui.icon('history')}<span>Base histórica consolidada (simulada), separada dos eventos atuais. ${useGlobal ? 'Usando o período do filtro global.' : '<b>Período global menor que 90 dias:</b> exibindo os últimos 12 meses para dar contexto histórico.'} Filtros de UF, cidade, categoria, severidade e operadora são aplicados.</span></div>
      <div class="kpis">
        ${ui.kpi({ id: 'h1', label: 'Eventos no período', value: events.length, tone: '#2563EB' })}
        ${ui.kpi({ id: 'h2', label: 'Tempo médio de detecção', value: Math.round(avgTTD || 0), display: U.duration(avgTTD), tone: '#6D3FD8' })}
        ${ui.kpi({ id: 'h3', label: 'Tempo médio de resolução', value: Math.round(avgTTR || 0), display: U.duration(avgTTR), tone: '#0F1D36' })}
        ${ui.kpi({ id: 'h4', label: 'Conveniados afetados (soma)', value: affected, tone: '#E0620B' })}
        ${ui.kpi({ id: 'h5', label: 'Com confiança confirmada/alta', value: strong, display: events.length ? Math.round(strong / events.length * 100) + '%' : '—', tone: '#6D3FD8' })}
        ${ui.kpi({ id: 'h6', label: 'Locais com eventos repetidos', value: repeated.length, tone: '#C27803' })}
      </div>
      <div class="grid g-2 mt">
        <div class="card"><div class="card-head"><h3>Eventos por mês e categoria</h3></div><div class="card-body"><div class="chart-box lg"><canvas id="hMonth"></canvas></div></div></div>
        <div class="card"><div class="card-head"><h3>Tempo médio de detecção e resolução</h3><span class="sub">minutos</span></div><div class="card-body"><div class="chart-box lg"><canvas id="hTimes"></canvas></div></div></div>
      </div>
      <div class="grid g-3 mt">
        <div class="card"><div class="card-head"><h3>Eventos por UF</h3></div><div class="card-body"><div class="chart-box lg"><canvas id="hUf"></canvas></div></div></div>
        <div class="card"><div class="card-head"><h3>Eventos por operadora</h3><span class="sub">somente conectividade</span></div><div class="card-body"><div class="chart-box lg"><canvas id="hOp"></canvas></div></div></div>
        <div class="card"><div class="card-head"><h3>Conveniados afetados por mês</h3></div><div class="card-body"><div class="chart-box lg"><canvas id="hAff"></canvas></div></div></div>
      </div>
      <div class="grid g-2 mt">
        <div class="card"><div class="card-head"><h3>Clima × falhas de conectividade</h3><span class="sub" id="r1"></span></div><div class="card-body"><div class="chart-box lg"><canvas id="hRain"></canvas></div></div></div>
        <div class="card"><div class="card-head"><h3>Interrupções de energia × falhas de conectividade</h3><span class="sub" id="r2"></span></div><div class="card-body"><div class="chart-box lg"><canvas id="hEnergy"></canvas></div></div></div>
      </div>
      <div class="grid g-12 mt">
        <div class="card span-4"><div class="card-head"><h3>Ocorrências geográficas repetidas</h3><span class="sub">5+ eventos</span></div><div id="repTable"></div></div>
        <div class="card span-8"><div class="card-head"><h3>Eventos históricos</h3><span class="sub">exportação respeita os filtros</span></div><div id="hTable"></div></div>
      </div>
      <p class="small muted" style="margin-top:12px">Correlações históricas (Pearson) mostram associação entre séries mensais por UF; não indicam causa. Todos os números desta tela são simulados.</p>`;

    const cats = Object.keys(R.EVENT_CATEGORIES);
    ui.charts.bar('hMonth', months.map(monthLabel), cats.map((c) => ({ label: R.EVENT_CATEGORIES[c].short, data: months.map((m) => events.filter((e) => e.month === m && e.category === c).length), colors: ui.CAT_COLOR[c] })), { stacked: true });
    ui.charts.line('hTimes', months.map(monthLabel), [
      { label: 'Detecção (TTD)', data: months.map((m) => Math.round(U.avg(events.filter((e) => e.month === m), (e) => e.ttd_min) || 0)), borderColor: '#6D3FD8', backgroundColor: '#6D3FD822' },
      { label: 'Resolução (TTR)', data: months.map((m) => Math.round(U.avg(events.filter((e) => e.month === m), (e) => e.ttr_min) || 0)), borderColor: '#0F1D36', backgroundColor: '#0F1D3622' }
    ]);
    const byUf = U.groupCount(events, (e) => e.state).slice(0, 12);
    ui.charts.bar('hUf', byUf.map((x) => x[0]), [{ label: 'Eventos', data: byUf.map((x) => x[1]), colors: '#2C4677' }], { horizontal: true, onClick: (uf) => S.setFilters({ uf: S.state.filters.uf === uf ? '' : uf }) });
    const byOp = U.groupCount(events.filter((e) => e.operator), (e) => e.operator);
    ui.charts.bar('hOp', byOp.map((x) => x[0]), [{ label: 'Eventos', data: byOp.map((x) => x[1]), colors: byOp.map((x) => ui.OP_COLOR[x[0]]) }], { onClick: (op) => S.setFilters({ operator: S.state.filters.operator === op ? '' : op }) });
    ui.charts.bar('hAff', months.map(monthLabel), [{ label: 'Conveniados afetados', data: months.map((m) => U.sum(events.filter((e) => e.month === m), (e) => e.partners_affected)), colors: '#E0620B' }]);

    const p1 = monthly.filter((m) => m.partners).map((m) => ({ x: m.rain_mm, y: +(m.conn_incidents / m.partners * 10).toFixed(2), label: m.state + ' ' + m.month }));
    const g1 = regression(p1);
    ui.charts.scatter('hRain', p1, { xLabel: 'Chuva mensal (mm)', yLabel: 'Incid. conectividade / 10 conv.', color: '#7C3AED', trend: g1 && g1.line });
    el.querySelector('#r1').textContent = g1 ? 'r = ' + g1.r.toFixed(2).replace('.', ',') : '';
    const p2 = monthly.filter((m) => m.partners).map((m) => ({ x: m.energy_interruptions, y: m.conn_failures_during_energy, label: m.state + ' ' + m.month }));
    const g2 = regression(p2);
    ui.charts.scatter('hEnergy', p2, { xLabel: 'Interrupções de energia no mês', yLabel: 'Falhas de conectividade durante interrupção', color: '#D97706', trend: g2 && g2.line });
    el.querySelector('#r2').textContent = g2 ? 'r = ' + g2.r.toFixed(2).replace('.', ',') : '';

    new ui.DataTable(el.querySelector('#repTable'), {
      rows: repeated.map(([k, n]) => ({ local: k, n, cats: U.groupCount(events.filter((e) => e.city + '/' + e.state === k), (e) => R.EVENT_CATEGORIES[e.category].short).map((x) => x[0] + ' ' + x[1]).join(', ') })),
      pageSize: 8, csvName: 'ocorrencias_repetidas', sort: { key: 'n', dir: 'desc' },
      columns: [{ key: 'local', label: 'Local' }, { key: 'n', label: 'Eventos', num: true }, { key: 'cats', label: 'Categorias', render: (r) => `<span class="small">${U.esc(r.cats)}</span>` }]
    });
    new ui.DataTable(el.querySelector('#hTable'), {
      rows: events, pageSize: 10, csvName: 'historico_eventos', sort: { key: 'start_time', dir: 'desc' },
      columns: [
        { key: 'event_id', label: 'Evento', render: (e) => `<span class="mono">${e.event_id}</span>` },
        { key: 'start_time', label: 'Início', value: (e) => U.dt(e.start_time), sortValue: (e) => Date.parse(e.start_time) },
        { key: 'category', label: 'Categoria', render: (e) => ui.cat(e.category), value: (e) => R.EVENT_CATEGORIES[e.category].label },
        { key: 'state', label: 'UF' }, { key: 'city', label: 'Cidade' }, { key: 'operator', label: 'Operadora', value: (e) => e.operator || '—' },
        { key: 'partners_affected', label: 'Afetados', num: true }, { key: 'related_incidents', label: 'Incidentes', num: true },
        { key: 'ttd_min', label: 'TTD (min)', num: true }, { key: 'ttr_min', label: 'TTR (min)', num: true },
        { key: 'confidence', label: 'Confiança', render: (e) => ui.conf(e.confidence), value: (e) => R.CONFIDENCE[e.confidence].label, sortValue: (e) => R.CONFIDENCE[e.confidence].rank },
        { key: 'severity', label: 'Severidade', render: (e) => ui.sev(e.severity), value: (e) => R.SEVERITIES[e.severity].label, sortValue: (e) => R.SEVERITIES[e.severity].rank }
      ]
    });
  }

  return { subtitle: 'Tendências, tempos de detecção/resolução e correlações históricas', render };
})();
