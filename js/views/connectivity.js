/* ==========================================================================
   TELA 3 — INTELIGÊNCIA DE CONECTIVIDADE
   ========================================================================== */
IOA.views.conectividade = (function () {
  const U = IOA.utils, R = IOA.ref, S = IOA.store, ui = IOA.ui, D = IOA.details;

  const CLASSES = [
    ['Problema individual de conectividade', 'info', 'Um conveniado, sem vizinhos afetados nem evento da operadora.'],
    ['Possível queda regional', 'warn', 'Vários conveniados da mesma operadora no mesmo raio e janela, sem fonte externa.'],
    ['Suspeita de degradação da operadora', 'high', 'Agrupamento coerente com degradação reportada por fonte externa.'],
    ['Queda regional confirmada', 'ana', 'Confirmada pela própria operadora.'],
    ['Evidência insuficiente', 'muted', 'Agrupamento sem padrão de operadora nem evento externo; inclui incidentes regionais não explicados.']
  ];
  function connClass(o) {
    if (o.classification === 'Incidente regional não explicado') return 'Evidência insuficiente';
    if (o.classification === 'Problema individual com evento da operadora próximo') return 'Problema individual de conectividade';
    return CLASSES.find((c) => c[0] === o.classification) ? o.classification : null;
  }

  function render(el) {
    const v = S.view();
    const now = S.state.data.now;
    const mobileOff = v.partners.filter((p) => p.operational_status === 'offline' && R.isMobile(p.connectivity_type)).length;
    const fixedOff = v.partners.filter((p) => p.operational_status === 'offline' && !R.isMobile(p.connectivity_type)).length;
    const connInc = v.incidents.filter((i) => i.category === 'conectividade');
    const resolved = connInc.filter((i) => i.status === 'resolvido');
    const avgDur = U.avg(resolved, (i) => i.duration_min);
    const connOcc = v.occurrences.filter((o) => connClass(o));
    const regional = connOcc.filter((o) => o.regional && o.status !== 'resolvido' && o.rule === 'R1');
    const affectedLoc = U.uniq(v.occurrences.filter((o) => o.regional && ['R1', 'R6'].includes(o.rule) && o.status !== 'resolvido').flatMap((o) => o.partners)).length;
    const repeated = S.state.engine.recurrences.filter((r) => r.category === 'conectividade' && v.pset.has(r.partner_code));
    const telEvents = v.events.filter((e) => e.category.startsWith('telecom'));
    const mk = (id, label, value, tone, extra) => { const s = S.series('c' + id + S.state.filters.uf, value); return Object.assign({ id, label, value, tone, series: s, prev: s[s.length - 2], prevLabel: 'vs. ontem' }, extra || {}); };
    const kpis = [
      mk('off', 'Conveniados offline', mobileOff + fixedOff, '#D92D20', { hint: `${mobileOff} móveis · ${fixedOff} fixos` }),
      mk('inc', 'Incidentes de conectividade', connInc.filter((i) => i.status !== 'resolvido').length, '#2563EB'),
      mk('reg', 'Quedas regionais (R1)', regional.length, '#6D3FD8'),
      mk('aff', 'Locais potencialmente afetados', affectedLoc, '#E0620B'),
      mk('rep', 'Falhas repetidas (30 d)', repeated.length, '#C27803', { hint: 'Conveniados com 3+ incidentes de conectividade em 30 dias' }),
      mk('dur', 'Duração média do incidente', Math.round(avgDur || 0), '#0F1D36', { display: U.duration(avgDur), higherIsBad: true }),
      mk('ev', 'Eventos de operadora', telEvents.filter((e) => e.event_status !== 'resolvido').length, '#0891B2')
    ];

    el.innerHTML = `${IOA.app.sourceBanner('telecom')}
      <div class="kpis">${kpis.map(ui.kpi).join('')}</div>
      <div class="grid g-2 mt">
        <div class="card"><div class="card-head"><h3>Conveniados por tecnologia</h3><span class="sub">clique para filtrar</span></div><div class="card-body"><div class="chart-box"><canvas id="cTech"></canvas></div></div></div>
        <div class="card"><div class="card-head"><h3>Conveniados por operadora</h3><span class="sub">clique para filtrar</span></div><div class="card-body"><div class="chart-box"><canvas id="cOp"></canvas></div></div></div>
      </div>
      <div class="card mt">
        <div class="card-head"><h3>Classificação das falhas de conectividade</h3><span class="sub">um agrupamento de offline nunca vira “queda confirmada” sem fonte da operadora</span></div>
        <div class="card-body"><div class="grid" style="grid-template-columns:repeat(5,minmax(0,1fr));gap:10px" id="classStrip"></div></div>
        <div id="occTable"></div>
      </div>
      <div class="card mt">
        <div class="card-head"><h3>Eventos de conectividade</h3><span class="sub">operadoras e fontes externas (simuladas)</span></div>
        <div id="evTable"></div>
      </div>
      <div class="card mt" id="rulesCard"></div>`;

    el.querySelectorAll('[data-kpi]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.kpi;
      if (k === 'off') IOA.app.go('mapa', null, { onlyOffline: true });
      else if (k === 'reg' || k === 'aff' || k === 'rep') IOA.app.go('correlacao');
      else el.querySelector(k === 'ev' ? '#evTable' : '#occTable').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));

    const techs = R.TECHNOLOGIES.filter((t) => v.partners.some((p) => p.connectivity_type === t));
    const stack = (key, labels) => [
      { label: 'Online', data: labels.map((l) => v.partners.filter((p) => p[key] === l && p.operational_status === 'online').length), colors: '#0E9F6E' },
      { label: 'Degradado', data: labels.map((l) => v.partners.filter((p) => p[key] === l && p.operational_status === 'degradado').length), colors: '#E0A526' },
      { label: 'Offline', data: labels.map((l) => v.partners.filter((p) => p[key] === l && p.operational_status === 'offline').length), colors: '#D92D20' }
    ];
    ui.charts.bar('cTech', techs, stack('connectivity_type', techs), { stacked: true, onClick: (t) => S.setFilters({ technology: S.state.filters.technology === t ? '' : t }) });
    const ops = R.OPERATORS.filter((o) => v.partners.some((p) => p.telecom_operator === o));
    ui.charts.bar('cOp', ops, stack('telecom_operator', ops), { stacked: true, onClick: (o) => S.setFilters({ operator: S.state.filters.operator === o ? '' : o }) });

    const counts = CLASSES.map((c) => connOcc.filter((o) => connClass(o) === c[0] && o.status !== 'resolvido').length);
    el.querySelector('#classStrip').innerHTML = CLASSES.map((c, i) => `<div class="note" style="background:var(--surface)" title="${U.esc(c[2])}"><div style="font-size:20px;font-weight:650">${counts[i]}</div>${ui.badge(c[0], c[1])}<div class="small muted" style="margin-top:4px">${U.esc(c[2])}</div></div>`).join('');

    new ui.DataTable(el.querySelector('#occTable'), {
      rows: connOcc, pageSize: 8, csvName: 'conectividade_ocorrencias', sort: { key: 'sev', dir: 'desc' },
      onRowClick: (o) => D.openOccurrence(o.id),
      columns: [
        { key: 'id', label: 'Ocorrência', render: (o) => `<span class="mono">${o.id}</span>` },
        { key: 'cls', label: 'Classificação', value: (o) => connClass(o), render: (o) => ui.badge(connClass(o), (CLASSES.find((c) => c[0] === connClass(o)) || [])[1]) },
        { key: 'city', label: 'Local', value: (o) => o.city + '/' + o.state },
        { key: 'op', label: 'Operadora(s)', value: (o) => o.operators.map((x) => x[0]).join(', ') },
        { key: 'n', label: 'Conveniados', num: true, value: (o) => o.partners.length },
        { key: 'off', label: 'Offline', num: true, value: (o) => o.offline_now },
        { key: 'inc', label: 'Incidentes', num: true, value: (o) => o.incidents.length },
        { key: 'conf', label: 'Confiança', sortValue: (o) => (R.CONFIDENCE[o.confidence] || { rank: 0 }).rank, render: (o) => ui.conf(o.confidence), csv: (o) => (R.CONFIDENCE[o.confidence] || { label: '—' }).label },
        { key: 'sev', label: 'Severidade', sortValue: (o) => R.SEVERITIES[o.severity].rank, render: (o) => ui.sev(o.severity), csv: (o) => R.SEVERITIES[o.severity].label },
        { key: 'first', label: 'Detecção', value: (o) => U.dt(o.first_seen), sortValue: (o) => Date.parse(o.first_seen) }
      ]
    });

    new ui.DataTable(el.querySelector('#evTable'), {
      rows: telEvents, pageSize: 8, csvName: 'conectividade_eventos', sort: { key: 'start', dir: 'desc' },
      emptyTitle: 'Nenhum evento de conectividade', onRowClick: (e) => D.openEvent(e.event_id),
      columns: [
        { key: 'event_id', label: 'Evento', render: (e) => `<span class="mono">${e.event_id}</span> ${ui.sim()}` , csv: (e) => e.event_id },
        { key: 'operator', label: 'Operadora' }, { key: 'technology', label: 'Tecnologia' },
        { key: 'loc', label: 'UF / cidade', value: (e) => e.state + ' · ' + e.city },
        { key: 'coords', label: 'Coordenadas', sortable: false, value: (e) => e.latitude + ', ' + e.longitude, render: (e) => `<span class="mono">${e.latitude}, ${e.longitude}</span>` },
        { key: 'start', label: 'Detecção', value: (e) => U.dt(e.start_time), sortValue: (e) => Date.parse(e.start_time) },
        { key: 'upd', label: 'Atualização', value: (e) => U.dt(e.last_updated), sortValue: (e) => Date.parse(e.last_updated) },
        { key: 'status', label: 'Status', render: (e) => ui.evStatus(e.event_status), value: (e) => R.EVENT_STATUS[e.event_status] },
        { key: 'area', label: 'Área estimada', value: (e) => (e.estimated_area || '') + ' (' + e.affected_radius + ' km)' },
        { key: 'near', label: 'Próximos', num: true, value: (e) => S.impact(e.event_id).nearby.length },
        { key: 'off', label: 'Offline', num: true, value: (e) => S.impact(e.event_id).offline.length },
        { key: 'inc', label: 'Incid. SN', num: true, value: (e) => S.impact(e.event_id).incidents.length },
        { key: 'provider', label: 'Fonte externa' },
        { key: 'evid', label: 'Evidência', render: (e) => ui.evidence(e.evidence_type), value: (e) => R.EVIDENCE[e.evidence_type].label },
        { key: 'conf', label: 'Confiança', render: (e) => { const o = S.impact(e.event_id).occurrences.map(S.occurrence)[0]; return o ? ui.conf(o.confidence) : '<span class="muted small">sem impacto</span>'; }, value: (e) => { const o = S.impact(e.event_id).occurrences.map(S.occurrence)[0]; return o && R.CONFIDENCE[o.confidence] ? R.CONFIDENCE[o.confidence].label : 'sem impacto'; } }
      ]
    });

    IOA.views.correlacao.rulesPanel(el.querySelector('#rulesCard'), 'conectividade');
  }

  return { subtitle: 'Operadoras, tecnologias e quedas regionais de conectividade', render };
})();
