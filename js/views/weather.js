/* ==========================================================================
   TELA 5 — EVENTOS CLIMÁTICOS E AMBIENTAIS
   Observado, alerta oficial e previsão nunca são misturados.
   ========================================================================== */
IOA.views.clima = (function () {
  const U = IOA.utils, R = IOA.ref, S = IOA.store, ui = IOA.ui, D = IOA.details;
  let tab = 'observado';

  /** Pearson + reta de mínimos quadrados (para o gráfico histórico). */
  function regression(pts) {
    const n = pts.length; if (n < 3) return null;
    const mx = U.avg(pts, (p) => p.x), my = U.avg(pts, (p) => p.y);
    let sxy = 0, sxx = 0, syy = 0;
    pts.forEach((p) => { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; });
    const b = sxy / (sxx || 1), a = my - b * mx;
    const xs = pts.map((p) => p.x); const x0 = Math.min(...xs), x1 = Math.max(...xs);
    return { r: sxy / Math.sqrt((sxx || 1) * (syy || 1)), line: [{ x: x0, y: a + b * x0 }, { x: x1, y: a + b * x1 }] };
  }

  function render(el) {
    const v = S.view();
    const w = v.events.filter((e) => e.category === 'clima');
    const obs = w.filter((e) => e.evidence_type === 'observado');
    const alerts = w.filter((e) => e.evidence_type === 'alerta_oficial');
    const fc = w.filter((e) => e.evidence_type === 'previsao');
    const nonFc = w.filter((e) => e.evidence_type !== 'previsao' && e.event_status !== 'resolvido');
    const heavy = obs.filter((e) => ['chuva_forte', 'tempestade'].includes(e.subcategory) && e.event_status !== 'resolvido');
    const inside = U.uniq(nonFc.flatMap((e) => S.impact(e.event_id).nearby)).filter((c) => v.pset.has(c));
    const withInc = U.uniq(nonFc.flatMap((e) => S.impact(e.event_id).affected)).filter((c) => v.pset.has(c));
    const weatherOcc = v.occurrences.filter((o) => o.rule === 'R3');
    const weatherInc = U.uniq(weatherOcc.flatMap((o) => o.incidents));
    const noImpact = nonFc.filter((e) => !S.impact(e.event_id).affected.length);

    const mk = (id, label, value, tone, extra) => { const s = S.series('w' + id + S.state.filters.uf, value); return Object.assign({ id, label, value, tone, series: s, prev: s[s.length - 2], prevLabel: 'vs. ontem' }, extra || {}); };
    const kpis = [
      mk('alerts', 'Alertas meteorológicos ativos', alerts.filter((e) => e.event_status !== 'resolvido').length, '#6D3FD8'),
      mk('heavy', 'Locais sob chuva forte', U.uniq(heavy.map((e) => e.city)).length, '#2563EB', { hint: 'Cidades com chuva forte ou tempestade observada' }),
      mk('inside', 'Conveniados em áreas afetadas', inside.length, '#E0620B'),
      mk('withInc', 'Conveniados com incidente no evento', withInc.length, '#D92D20'),
      mk('inc', 'Incidentes relacionados ao clima', weatherInc.length, '#0F1D36'),
      mk('noimp', 'Eventos sem impacto operacional', noImpact.length, '#0E9F6E', { higherIsBad: false })
    ];

    const tabRows = { observado: obs, alerta_oficial: alerts, previsao: fc }[tab];
    el.innerHTML = `${IOA.app.sourceBanner('clima')}
      <div class="kpis">${kpis.map(ui.kpi).join('')}</div>
      <div class="grid g-2 mt">
        <div class="card"><div class="card-head"><h3>Cidades com maior chuva acumulada</h3><span class="sub">somente observado</span></div><div class="card-body"><div class="chart-box"><canvas id="wCity"></canvas></div></div></div>
        <div class="card"><div class="card-head"><h3>Histórico: chuva × incidentes de conectividade</h3><span class="sub" id="rTxt"></span></div><div class="card-body"><div class="chart-box"><canvas id="wScatter"></canvas></div></div></div>
      </div>
      <div class="card mt">
        <div class="tabs">
          <button data-tab="observado" class="${tab === 'observado' ? 'on' : ''}">Observado ${ui.badge(obs.length, 'info')}</button>
          <button data-tab="alerta_oficial" class="${tab === 'alerta_oficial' ? 'on' : ''}">Alertas oficiais ${ui.badge(alerts.length, 'ana')}</button>
          <button data-tab="previsao" class="${tab === 'previsao' ? 'on' : ''}">Previsões ${ui.badge(fc.length, 'outline')}</button>
        </div>
        ${tab === 'previsao' ? '<div class="card-body" style="padding-bottom:0"><div class="note warn"><b>Previsões não são eventos observados.</b> Servem para preparação da operação e nunca são usadas como evidência de causa de incidentes.</div></div>' : ''}
        ${tab === 'alerta_oficial' ? '<div class="card-body" style="padding-bottom:0"><div class="note">Alertas emitidos por órgão oficial (ex.: INMET, CEMADEN — fontes planejadas, respostas simuladas). Indicam risco na área; não equivalem a medição local.</div></div>' : ''}
        <div id="wTable"></div>
      </div>`;

    el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(el); }));
    el.querySelectorAll('[data-kpi]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.kpi;
      if (k === 'alerts') { tab = 'alerta_oficial'; render(el); }
      else if (k === 'inc' || k === 'withInc') IOA.app.go('correlacao', { category: 'clima' });
      else if (k === 'inside') IOA.app.go('mapa', { category: 'clima' });
      else { tab = 'observado'; render(el); }
    }));

    const byCity = new Map();
    obs.forEach((e) => { if (e.accumulated_mm != null) byCity.set(e.city + '/' + e.state, Math.max(byCity.get(e.city + '/' + e.state) || 0, e.accumulated_mm)); });
    const cities = [...byCity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    ui.charts.bar('wCity', cities.map((c) => c[0]), [{ label: 'Chuva acumulada (mm)', data: cities.map((c) => c[1]), colors: cities.map((c) => (c[1] >= 50 ? '#2563EB' : '#93B4F5')) }], { horizontal: true });

    const f = S.state.filters;
    const pts = S.state.data.history.monthly.filter((m) => (!f.uf || m.state === f.uf) && m.partners > 0).map((m) => ({ x: m.rain_mm, y: +(m.conn_incidents / m.partners * 10).toFixed(2), label: m.state + ' ' + m.month }));
    const reg = regression(pts);
    ui.charts.scatter('wScatter', pts, { xLabel: 'Chuva mensal (mm)', yLabel: 'Incidentes de conectividade por 10 conveniados', color: '#6D3FD8', trend: reg && reg.line });
    el.querySelector('#rTxt').textContent = reg ? `correlação de Pearson r = ${reg.r.toFixed(2).replace('.', ',')} (não implica causalidade)` : '';

    new ui.DataTable(el.querySelector('#wTable'), {
      rows: tabRows, pageSize: 8, csvName: 'clima_' + tab, sort: { key: 'start', dir: tab === 'previsao' ? 'asc' : 'desc' }, onRowClick: (e) => D.openEvent(e.event_id),
      emptyTitle: 'Nenhum evento nesta categoria', emptyText: 'Sem eventos climáticos para os filtros atuais.',
      columns: [
        { key: 'type', label: 'Tipo', value: (e) => R.WEATHER_SUB[e.subcategory], render: (e) => `<b>${R.WEATHER_SUB[e.subcategory]}</b><div class="small muted">${e.event_id} ${ui.sim()}</div>` },
        { key: 'title', label: 'Área geográfica', value: (e) => e.city + '/' + e.state + ' · raio ' + e.affected_radius + ' km' },
        { key: 'coords', label: 'Coordenadas', sortable: false, value: (e) => e.latitude + ', ' + e.longitude, render: (e) => `<span class="mono">${e.latitude}, ${e.longitude}</span>` },
        { key: 'start', label: 'Início', value: (e) => U.dt(e.start_time), sortValue: (e) => Date.parse(e.start_time) },
        { key: 'end', label: 'Fim previsto', value: (e) => U.dt(e.estimated_end) },
        { key: 'prec', label: 'Precip. atual', num: true, value: (e) => (e.precipitation_mm_h != null ? e.precipitation_mm_h + ' mm/h' : '—'), sortValue: (e) => e.precipitation_mm_h },
        { key: 'acc', label: 'Acumulado', num: true, value: (e) => (e.accumulated_mm != null ? e.accumulated_mm + ' mm' : '—'), sortValue: (e) => e.accumulated_mm },
        { key: 'wind', label: 'Vento / rajada', value: (e) => (e.wind_kmh != null ? e.wind_kmh : '—') + ' / ' + (e.gust_kmh != null ? e.gust_kmh : '—') + ' km/h', sortValue: (e) => e.gust_kmh },
        { key: 'sev', label: 'Severidade', render: (e) => ui.sev(e.severity), sortValue: (e) => R.SEVERITIES[e.severity].rank, value: (e) => R.SEVERITIES[e.severity].label },
        { key: 'provider', label: 'Fonte' },
        { key: 'near', label: 'Conv. próximos', num: true, value: (e) => S.impact(e.event_id).nearby.length },
        { key: 'inc', label: 'Incidentes', num: true, value: (e) => S.impact(e.event_id).incidents.length }
      ]
    });
  }

  return { subtitle: 'Chuva, tempestades, raios, vento e alertas — observado × previsto', render };
})();
