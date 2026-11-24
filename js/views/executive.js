/* ==========================================================================
   TELA 1 — VISÃO EXECUTIVA
   ========================================================================== */
IOA.views.executiva = (function () {
  const U = IOA.utils, R = IOA.ref, S = IOA.store, ui = IOA.ui, D = IOA.details;

  /** Agrupa as ocorrências ativas para responder: isolado ou regional? */
  function questionGroups(occs) {
    const act = occs.filter((o) => o.status !== 'resolvido' && o.rule !== 'R5');
    const g = {
      regional_ext: act.filter((o) => o.regional && o.primary_event),
      regional_unexpl: act.filter((o) => o.regional && !o.primary_event),
      single_ext: act.filter((o) => !o.regional && o.primary_event),
      isolated: act.filter((o) => !o.regional && !o.primary_event)
    };
    g.partners = (k) => U.uniq(g[k].flatMap((o) => o.partners)).length;
    return g;
  }

  function computeKpis(v) {
    const now = S.state.data.now;
    const offline = v.partners.filter((p) => p.operational_status === 'offline');
    const activeEv = v.events.filter((e) => e.realtime !== false && (e.event_status === 'ativo' || e.event_status === 'monitorando'));
    const affected = new Set();
    v.events.forEach((e) => S.impact(e.event_id).affected.forEach((c) => { if (v.pset.has(c)) affected.add(c); }));
    v.occurrences.filter((o) => o.regional && o.rule !== 'R5' && o.status !== 'resolvido').forEach((o) => o.partners.forEach((c) => v.pset.has(c) && affected.add(c)));
    const relInc = U.uniq(v.occurrences.filter((o) => o.primary_event || (o.regional && o.rule !== 'R5')).flatMap((o) => o.incidents)).filter((id) => v.incidents.some((i) => i.incident_id === id));
    const critReg = v.occurrences.filter((o) => o.regional && o.rule !== 'R5' && o.status !== 'resolvido' && o.severity === 'critica');
    const conn = v.incidents.filter((i) => i.category === 'conectividade' && i.status !== 'resolvido');
    const energy = v.incidents.filter((i) => i.category === 'energia' && i.status !== 'resolvido');
    const weather = v.events.filter((e) => e.category === 'clima' && e.evidence_type !== 'previsao' && e.event_status !== 'resolvido');
    const mk = (id, label, value, tone, prevFactor, extra) => {
      const series = S.series(id + S.state.filters.uf + S.state.filters.operator, value);
      return Object.assign({ id, label, value, tone, series, prev: series[series.length - 2], prevLabel: 'vs. ontem' }, extra || {});
    };
    return [
      mk('total', 'Conveniados monitorados', v.partners.length, '#2563EB', 0, { prev: v.partners.length, series: Array(14).fill(v.partners.length), higherIsBad: false, prevLabel: 'sem variação no cadastro' }),
      mk('offline', 'Conveniados offline', offline.length, '#D92D20'),
      mk('events', 'Eventos externos ativos', activeEv.length, '#6D3FD8'),
      mk('affected', 'Potencialmente afetados', affected.size, '#E0620B'),
      mk('related', 'Incidentes SN relacionados', relInc.length, '#0F1D36'),
      mk('critical', 'Eventos regionais críticos', critReg.length, '#D92D20'),
      mk('conn', 'Incidentes de conectividade', conn.length, '#2563EB'),
      mk('energy', 'Incidentes de energia', energy.length, '#D97706'),
      mk('weather', 'Eventos climáticos', weather.length, '#7C3AED')
    ];
  }

  const KPI_NAV = {
    total: () => IOA.app.go('mapa'), offline: () => IOA.app.go('mapa', null, { onlyOffline: true }), events: () => IOA.app.go('mapa'),
    affected: () => IOA.app.go('correlacao'), related: () => IOA.app.go('correlacao'), critical: () => IOA.app.go('correlacao', { severity: 'critica' }),
    conn: () => IOA.app.go('conectividade'), energy: () => IOA.app.go('energia'), weather: () => IOA.app.go('clima')
  };

  /* ---------------- Ranking regional ---------------- */
  function ranking(v) {
    const byCity = new Map();
    const get = (st, city) => { const k = st + '|' + city; if (!byCity.has(k)) byCity.set(k, { state: st, city, cats: new Map(), partners: new Set(), offline: new Set(), incidents: new Set(), ops: new Map(), first: Infinity, last: 0, sev: 0, conf: 0 }); return byCity.get(k); };
    v.occurrences.filter((o) => o.rule !== 'ISO' && o.status !== 'resolvido').forEach((o) => {
      const r = get(o.state, o.city);
      const catKey = o.rule === 'R2' ? 'energia' : o.rule === 'R3' ? 'clima' : o.rule === 'R5' ? 'recorrencia' : o.rule === 'R6' ? 'nao_explicado' : 'telecom';
      r.cats.set(catKey, (r.cats.get(catKey) || 0) + o.partners.length);
      o.partners.forEach((c) => { r.partners.add(c); const p = S.partner(c); if (p.operational_status === 'offline') r.offline.add(c); r.ops.set(p.telecom_operator, (r.ops.get(p.telecom_operator) || 0) + 1); });
      o.incidents.forEach((i) => r.incidents.add(i));
      r.first = Math.min(r.first, Date.parse(o.first_seen)); r.last = Math.max(r.last, Date.parse(o.last_seen));
      r.sev = Math.max(r.sev, R.SEVERITIES[o.severity].rank);
    });
    v.events.filter((e) => e.realtime !== false && e.event_status !== 'resolvido' && e.evidence_type !== 'previsao').forEach((e) => {
      const r = get(e.state, e.city);
      const catKey = e.category === 'energia' ? 'energia' : e.category === 'clima' ? 'clima' : 'telecom';
      if (!r.cats.has(catKey)) r.cats.set(catKey, 0);
      r.first = Math.min(r.first, Date.parse(e.start_time)); r.last = Math.max(r.last, Date.parse(e.last_updated));
      r.sev = Math.max(r.sev, Math.min(2, R.SEVERITIES[e.severity].rank));
    });
    const CAT_L = { telecom: 'Conectividade', energia: 'Energia', clima: 'Clima', recorrencia: 'Recorrência', nao_explicado: 'Não explicado' };
    return [...byCity.values()].map((r) => {
      const riskScore = r.partners.size * 2 + r.offline.size * 2 + r.incidents.size + r.sev * 3;
      const risk = riskScore >= 40 ? 'critica' : riskScore >= 22 ? 'alta' : riskScore >= 10 ? 'media' : 'baixa';
      const cat = [...r.cats.entries()].sort((a, b) => b[1] - a[1])[0];
      const op = [...r.ops.entries()].sort((a, b) => b[1] - a[1])[0];
      return { state: r.state, city: r.city, category: cat ? CAT_L[cat[0]] : '—', affected: r.partners.size, offline: r.offline.size, incidents: r.incidents.size, operator: op ? op[0] : '—', risk, riskScore, first: r.first, last: r.last };
    }).sort((a, b) => b.riskScore - a.riskScore).slice(0, 10);
  }

  /* ---------------- Render ---------------- */
  function render(el) {
    const v = S.view();
    const kpis = computeKpis(v);
    const g = questionGroups(v.occurrences);
    const total = g.regional_ext.length + g.regional_unexpl.length + g.single_ext.length + g.isolated.length;
    const segs = [['regional_ext', 'Regional com evento externo', '#6D3FD8'], ['regional_unexpl', 'Regional sem explicação', '#D92D20'], ['single_ext', 'Individual com evento próximo', '#E0620B'], ['isolated', 'Problema isolado', '#2563EB']];
    const crit = v.occurrences.filter((o) => o.status !== 'resolvido' && o.rule !== 'ISO')
      .sort((a, b) => R.SEVERITIES[b.severity].rank - R.SEVERITIES[a.severity].rank || (b.score ? b.score.total : 0) - (a.score ? a.score.total : 0)).slice(0, 7);

    el.innerHTML = `
      ${S.state.loadErrors.length ? `<div class="err-banner">${ui.icon('alert')} ${S.state.loadErrors.length} fonte(s) simulada(s) com falha na carga: ${S.state.loadErrors.map((e) => U.esc(e.source)).join(', ')} (demonstração de estado de erro). As demais fontes seguem funcionando. <a href="#/config" style="margin-left:auto">Ver integrações →</a></div>` : ''}
      <div class="kpis">${kpis.map(ui.kpi).join('')}</div>

      <div class="card mt question">
        <div><h2>Este incidente é um problema isolado ou um evento externo afetando vários conveniados?</h2>
        <p>${total} situação(ões) ativa(s) nos filtros atuais. ${g.regional_ext.length + g.regional_unexpl.length} são regionais (${g.partners('regional_ext') + g.partners('regional_unexpl')} conveniados).</p></div>
        <div><div class="q-bar">${segs.map(([k, , c]) => (g[k].length ? `<div style="width:${(g[k].length / Math.max(1, total)) * 100}%;background:${c}" title="${g[k].length}"></div>` : '')).join('')}</div>
        <div class="q-legend">${segs.map(([k, l, c]) => `<button data-q="${k}"><b style="color:${c}">${g[k].length}</b><span>${l} · ${g.partners(k)} conv.</span></button>`).join('')}</div></div>
      </div>

      <div class="grid g-12 mt">
        <div class="card span-7">
          <div class="card-head"><h3>Eventos críticos ativos</h3><span class="sub">priorizados por severidade e evidência</span><div class="actions"><a href="#/correlacao" class="btn sm">Ver correlações</a></div></div>
          <div class="ev-list">${crit.length ? crit.map((o) => {
            const ev = o.primary_event && S.event(o.primary_event);
            const catKey = ev ? ev.category : o.rule === 'R2' ? 'energia' : o.rule === 'R3' ? 'clima' : null;
            return `<button class="ev-item" data-occ="${o.id}"><span class="ev-bar" style="background:${ui.SEV_COLOR[o.severity]}"></span>
              <span style="min-width:0"><div class="ev-title">${U.esc(o.title)}</div>
              <div class="ev-meta"><span>${ui.icon('pin', '')}${U.esc(o.city)}/${o.state}</span>${catKey ? ui.cat(catKey) : ui.badge(IOA.engine.RULES[o.rule].name, 'outline')} ${ui.sev(o.severity)} ${ui.conf(o.confidence)} <span>${ui.icon('clock', '')}${U.hm(o.first_seen)} · ${U.ago(o.first_seen, S.state.data.now)}</span></div>
              <div class="ev-action">→ ${U.esc(o.fha.acao[0])}</div></span>
              <span class="ev-side"><span class="ev-num">${o.partners.length}</span>conveniados<span>${o.incidents.length} incidente(s)</span></span></button>`;
          }).join('') : ui.empty('Nenhum evento crítico ativo', 'Não há ocorrências regionais ou correlacionadas para os filtros atuais.', 'check')}</div>
        </div>
        <div class="span-5 grid" style="gap:14px">
          <div class="card"><div class="card-head"><h3>Eventos externos por categoria</h3><span class="sub">clique para filtrar</span></div><div class="card-body"><div class="chart-box sm"><canvas id="chCat"></canvas></div></div></div>
          <div class="card"><div class="card-head"><h3>Eventos externos por severidade</h3></div><div class="card-body"><div class="chart-box sm"><canvas id="chSev"></canvas></div></div></div>
        </div>
      </div>

      <div class="grid g-4 mt">
        <div class="card"><div class="card-head"><h3>Eventos por UF</h3></div><div class="card-body"><div class="chart-box"><canvas id="chUf"></canvas></div></div></div>
        <div class="card"><div class="card-head"><h3>Eventos por operadora</h3></div><div class="card-body"><div class="chart-box"><canvas id="chOp"></canvas></div></div></div>
        <div class="card"><div class="card-head"><h3>Offline por tecnologia</h3></div><div class="card-body"><div class="chart-box"><canvas id="chTech"></canvas></div></div></div>
        <div class="card"><div class="card-head"><h3>Incidentes por categoria de evento</h3></div><div class="card-body"><div class="chart-box"><canvas id="chIncCat"></canvas></div></div></div>
      </div>

      <div class="card mt">
        <div class="card-head"><h3>TOP 10 — regiões com maior risco</h3><span class="sub">cidades com ocorrências e eventos ativos</span></div>
        <div id="rankTable"></div>
      </div>
      <p class="small muted" style="margin-top:12px">Comparativos “vs. ontem” e minigráficos usam série histórica simulada. Correlações indicam relação geográfica e temporal, não comprovam causa.</p>`;

    el.querySelectorAll('[data-kpi]').forEach((b) => b.addEventListener('click', () => KPI_NAV[b.dataset.kpi]()));
    el.querySelectorAll('[data-occ]').forEach((b) => b.addEventListener('click', () => D.openOccurrence(b.dataset.occ)));
    el.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => IOA.app.go('correlacao', null, { group: b.dataset.q })));

    // gráficos
    const evs = v.events.filter((e) => e.realtime !== false);
    const cats = Object.keys(R.EVENT_CATEGORIES);
    ui.charts.doughnut('chCat', cats.map((c) => R.EVENT_CATEGORIES[c].short), cats.map((c) => evs.filter((e) => e.category === c).length), cats.map((c) => ui.CAT_COLOR[c]),
      { onClick: (label) => { const c = cats.find((k) => R.EVENT_CATEGORIES[k].short === label); S.setFilters({ category: S.state.filters.category === c ? '' : c }); } });
    const sevs = Object.keys(R.SEVERITIES);
    ui.charts.bar('chSev', sevs.map((s) => R.SEVERITIES[s].label), [{ label: 'Eventos', data: sevs.map((s) => evs.filter((e) => e.severity === s).length), colors: sevs.map((s) => ui.SEV_COLOR[s]) }],
      { horizontal: true, onClick: (label) => { const s = sevs.find((k) => R.SEVERITIES[k].label === label); S.setFilters({ severity: S.state.filters.severity === s ? '' : s }); } });
    const byUf = U.groupCount(evs, (e) => e.state).slice(0, 10);
    ui.charts.bar('chUf', byUf.map((x) => x[0]), [{ label: 'Eventos', data: byUf.map((x) => x[1]), colors: '#2C4677' }], { horizontal: true, onClick: (uf) => S.setFilters({ uf: S.state.filters.uf === uf ? '' : uf }) });
    const telEv = U.groupCount(evs.filter((e) => e.operator), (e) => e.operator);
    const r1 = U.groupCount(v.occurrences.filter((o) => o.rule === 'R1' && o.regional), (o) => o.dominant_operator);
    const opLabels = U.uniq([...telEv.map((x) => x[0]), ...r1.map((x) => x[0])]);
    ui.charts.bar('chOp', opLabels, [
      { label: 'Eventos de operadora', data: opLabels.map((o) => (telEv.find((x) => x[0] === o) || [0, 0])[1]), colors: opLabels.map((o) => ui.OP_COLOR[o]) },
      { label: 'Quedas regionais (R1)', data: opLabels.map((o) => (r1.find((x) => x[0] === o) || [0, 0])[1]), colors: '#A3AEC2' }
    ], { onClick: (op) => S.setFilters({ operator: S.state.filters.operator === op ? '' : op }) });
    const offTech = U.groupCount(v.partners.filter((p) => p.operational_status === 'offline'), (p) => p.connectivity_type);
    ui.charts.bar('chTech', offTech.map((x) => x[0]), [{ label: 'Offline', data: offTech.map((x) => x[1]), colors: '#D92D20' }], { onClick: (t) => S.setFilters({ technology: S.state.filters.technology === t ? '' : t }) });
    const incCat = { 'Conectividade': 0, 'Energia': 0, 'Clima': 0, 'Sem evento externo': 0 };
    v.incidents.forEach((i) => {
      const d = S.diag(i.partner_code); const o = d && S.occurrence(d.occurrence);
      const ev = o && o.primary_event && S.event(o.primary_event);
      const k = !ev ? 'Sem evento externo' : ev.category === 'energia' ? 'Energia' : ev.category === 'clima' ? 'Clima' : 'Conectividade';
      incCat[k]++;
    });
    ui.charts.bar('chIncCat', Object.keys(incCat), [{ label: 'Incidentes', data: Object.values(incCat), colors: ['#2563EB', '#D97706', '#7C3AED', '#A3AEC2'] }]);

    new ui.DataTable(el.querySelector('#rankTable'), {
      rows: ranking(v), pageSize: 10, csvName: 'ranking_regional', sort: { key: 'riskScore', dir: 'desc' },
      emptyTitle: 'Nenhuma região em risco', emptyText: 'Sem ocorrências ou eventos ativos para os filtros atuais.',
      onRowClick: (r) => IOA.app.go('mapa', { uf: r.state, city: r.city }),
      columns: [
        { key: 'state', label: 'UF' }, { key: 'city', label: 'Cidade', render: (r) => `<b>${U.esc(r.city)}</b>` },
        { key: 'category', label: 'Categoria' }, { key: 'affected', label: 'Conv. afetados', num: true }, { key: 'offline', label: 'Equip. offline', num: true },
        { key: 'incidents', label: 'Incidentes', num: true }, { key: 'operator', label: 'Operadora principal' },
        { key: 'riskScore', label: 'Risco', render: (r) => ui.sev(r.risk), csv: (r) => R.SEVERITIES[r.risk].label },
        { key: 'first', label: 'Primeira detecção', render: (r) => U.dt(r.first), csv: (r) => U.dt(r.first) },
        { key: 'last', label: 'Última atualização', render: (r) => U.dt(r.last), csv: (r) => U.dt(r.last) }
      ]
    });
  }

  return { subtitle: 'Saúde operacional, eventos externos e impacto regional', render };
})();
