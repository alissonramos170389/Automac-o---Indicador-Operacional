/* ==========================================================================
   TELA 4 — INTELIGÊNCIA DE ENERGIA ELÉTRICA
   ========================================================================== */
IOA.views.energia = (function () {
  const U = IOA.utils, R = IOA.ref, S = IOA.store, ui = IOA.ui, D = IOA.details;
  let tab = 'rt';

  function render(el) {
    const v = S.view();
    const all = v.events.filter((e) => e.category === 'energia');
    const rt = all.filter((e) => e.realtime !== false);
    // registros históricos são contexto: não dependem do período operacional selecionado
    const hist = S.state.data.events.filter((e) => e.category === 'energia' && e.realtime === false && (!S.state.filters.uf || e.state === S.state.filters.uf) && (!S.state.filters.city || e.city === S.state.filters.city));
    const active = rt.filter((e) => e.event_status !== 'resolvido' && ['oficial', 'alerta_distribuidora'].includes(e.evidence_type));
    const affected = U.uniq(rt.flatMap((e) => S.impact(e.event_id).affected)).filter((c) => v.pset.has(c));
    const offDuring = U.uniq(rt.flatMap((e) => S.impact(e.event_id).offline)).filter((c) => v.pset.has(c));
    const closed = rt.filter((e) => e.end_time);
    const hEnergy = S.state.data.history.events.filter((e) => e.category === 'energia' && (!S.state.filters.uf || e.state === S.state.filters.uf));
    const avgDur = U.avg([...closed.map((e) => (Date.parse(e.end_time) - Date.parse(e.start_time)) / 60000), ...hEnergy.map((e) => e.ttr_min)]);
    // falhas inferidas: ocorrências regionais multi-operadora sem evento de energia
    const inferred = v.occurrences.filter((o) => (o.rule === 'R6' || (o.supporting.includes('R4') && o.rule !== 'R2')) && o.status !== 'resolvido');
    const byCityHist = U.groupCount(hEnergy, (e) => e.city + '/' + e.state);
    const repeated = byCityHist.filter((x) => x[1] >= 4);

    const mk = (id, label, value, tone, extra) => { const s = S.series('e' + id + S.state.filters.uf, value); return Object.assign({ id, label, value, tone, series: s, prev: s[s.length - 2], prevLabel: 'vs. ontem' }, extra || {}); };
    const kpis = [
      mk('act', 'Quedas de energia ativas', active.length, '#D97706', { hint: 'Somente oficiais ou alertas de distribuidora' }),
      mk('aff', 'Conveniados potencialmente afetados', affected.length, '#E0620B'),
      mk('off', 'Offline durante evento elétrico', offDuring.length, '#D92D20'),
      mk('dur', 'Duração média da interrupção', Math.round(avgDur || 0), '#0F1D36', { display: U.duration(avgDur) }),
      mk('inf', 'Falhas de energia inferidas', inferred.length, '#C27803', { hint: 'Agrupamentos multi-operadora sem fonte externa' }),
      mk('rep', 'Cidades com interrupção repetida', repeated.length, '#6D3FD8', { hint: '4+ interrupções no histórico de 12 meses', prev: null, series: null })
    ];
    const types = ['oficial', 'alerta_distribuidora', 'historico', 'inferido', 'nao_confirmado'];
    const typeCount = { oficial: rt.filter((e) => e.evidence_type === 'oficial').length, alerta_distribuidora: rt.filter((e) => e.evidence_type === 'alerta_distribuidora').length, historico: hist.length, inferido: inferred.length, nao_confirmado: rt.filter((e) => e.evidence_type === 'nao_confirmado').length };

    el.innerHTML = `${IOA.app.sourceBanner('energia')}
      <div class="kpis">${kpis.map(ui.kpi).join('')}</div>
      <div class="card mt"><div class="card-head"><h3>Natureza da informação</h3><span class="sub">cada tipo tem peso diferente na correlação</span></div>
        <div class="card-body"><div class="grid" style="grid-template-columns:repeat(5,minmax(0,1fr));gap:10px">${types.map((t) => `<div class="note" style="background:var(--surface)"><div style="font-size:20px;font-weight:650">${typeCount[t]}</div>${ui.evidence(t)}<div class="small muted" style="margin-top:4px">${{
          oficial: 'Informada pela distribuidora como interrupção. Pode confirmar a Regra 2.',
          alerta_distribuidora: 'Aviso de oscilação ou desligamento ainda em apuração.',
          historico: 'Consolidado mensal (ex.: ANEEL DEC/FEC). Nunca tratado como notificação em tempo real.',
          inferido: 'Hipótese do motor: operadoras diferentes caíram juntas, sem fonte externa.',
          nao_confirmado: 'Relato sem validação. Não confirma correlação.'
        }[t]}</div></div>`).join('')}</div></div></div>
      <div class="grid g-2 mt">
        <div class="card"><div class="card-head"><h3>Eventos por distribuidora</h3><span class="sub">grupos citados são exemplos, não integrações confirmadas</span></div><div class="card-body"><div class="chart-box"><canvas id="eDist"></canvas></div></div></div>
        <div class="card"><div class="card-head"><h3>Cidades com mais interrupções (12 meses)</h3><span class="sub">histórico simulado</span></div><div class="card-body"><div class="chart-box"><canvas id="eCity"></canvas></div></div></div>
      </div>
      <div class="card mt">
        <div class="tabs"><button data-tab="rt" class="${tab === 'rt' ? 'on' : ''}">Ocorrências em tempo real ${ui.badge(rt.length, 'outline')}</button><button data-tab="inf" class="${tab === 'inf' ? 'on' : ''}">Falhas inferidas ${ui.badge(inferred.length, 'outline')}</button><button data-tab="hist" class="${tab === 'hist' ? 'on' : ''}">Registros históricos ${ui.badge(hist.length, 'outline')}</button></div>
        <div id="eTable"></div>
      </div>`;

    el.querySelectorAll('[data-kpi]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.kpi;
      if (k === 'inf') { tab = 'inf'; render(el); el.querySelector('#eTable').scrollIntoView({ behavior: 'smooth' }); }
      else if (k === 'off' || k === 'aff') IOA.app.go('mapa', { category: 'energia' });
      else el.querySelector('#eTable').scrollIntoView({ behavior: 'smooth' });
    }));
    el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(el); }));

    const groups = ['Enel', 'CPFL', 'Neoenergia', 'Energisa', 'Cemig', 'Equatorial', 'Outras regionais'];
    const histByGroup = (g) => hEnergy.filter((e) => { const p = S.state.data.partners.find((x) => x.state === e.state && x.city === e.city); return p && R.DISTRIBUTOR_GROUP(p.distributor) === g; }).length;
    ui.charts.bar('eDist', groups, [
      { label: 'Eventos atuais', data: groups.map((g) => rt.filter((e) => R.DISTRIBUTOR_GROUP(e.distributor || '') === g).length), colors: '#D97706' },
      { label: 'Histórico 12 meses', data: groups.map(histByGroup), colors: '#F3C98B' }
    ], { horizontal: true });
    const topCities = byCityHist.slice(0, 10);
    ui.charts.bar('eCity', topCities.map((x) => x[0]), [{ label: 'Interrupções', data: topCities.map((x) => x[1]), colors: topCities.map((x) => (x[1] >= 4 ? '#6D3FD8' : '#B9A4EE')) }], { horizontal: true });

    const tEl = el.querySelector('#eTable');
    if (tab === 'rt') {
      new ui.DataTable(tEl, {
        rows: rt, pageSize: 8, csvName: 'energia_eventos', sort: { key: 'start', dir: 'desc' }, onRowClick: (e) => D.openEvent(e.event_id),
        emptyTitle: 'Nenhuma ocorrência de energia', emptyText: 'Sem eventos de energia para os filtros atuais.',
        columns: [
          { key: 'title', label: 'Ocorrência', cls: 'wide', render: (e) => `<b>${U.esc(e.title)}</b><div class="small muted">${e.event_id} ${ui.sim()}</div>` },
          { key: 'distributor', label: 'Distribuidora' },
          { key: 'area', label: 'Área estimada', value: (e) => (e.estimated_area || '—') + ' · ' + e.affected_radius + ' km' },
          { key: 'start', label: 'Início', value: (e) => U.dt(e.start_time), sortValue: (e) => Date.parse(e.start_time) },
          { key: 'eta', label: 'Restab. previsto', value: (e) => U.dt(e.estimated_end), sortValue: (e) => Date.parse(e.estimated_end || 0) },
          { key: 'end', label: 'Restab. real', value: (e) => (e.end_time ? U.dt(e.end_time) : 'Em andamento') },
          { key: 'cause', label: 'Causa' },
          { key: 'aff', label: 'Conv. afetados', num: true, value: (e) => S.impact(e.event_id).affected.length },
          { key: 'inc', label: 'Incidentes', num: true, value: (e) => S.impact(e.event_id).incidents.length },
          { key: 'evid', label: 'Natureza', render: (e) => ui.evidence(e.evidence_type), value: (e) => R.EVIDENCE[e.evidence_type].label },
          { key: 'status', label: 'Status', render: (e) => ui.evStatus(e.event_status), value: (e) => R.EVENT_STATUS[e.event_status] }
        ]
      });
    } else if (tab === 'inf') {
      new ui.DataTable(tEl, {
        rows: inferred, pageSize: 8, csvName: 'energia_inferidas', onRowClick: (o) => D.openOccurrence(o.id),
        emptyTitle: 'Nenhuma falha inferida', emptyText: 'Nenhum agrupamento multi-operadora sem fonte externa.',
        columns: [
          { key: 'title', label: 'Ocorrência', render: (o) => `<b>${U.esc(o.title)}</b><div class="small muted">${o.id}</div>` },
          { key: 'rule', label: 'Regras', render: (o) => ui.ruleChip(o.rule) + ' ' + o.supporting.map((r) => ui.ruleChip(r, true)).join(' '), value: (o) => [o.rule, ...o.supporting].join('+') },
          { key: 'ops', label: 'Operadoras', value: (o) => o.operators.map((x) => x[0]).join(', ') },
          { key: 'n', label: 'Conveniados', num: true, value: (o) => o.partners.length },
          { key: 'first', label: 'Primeira falha', value: (o) => U.dt(o.first_seen) },
          { key: 'conf', label: 'Confiança', render: (o) => ui.conf(o.confidence), value: (o) => (R.CONFIDENCE[o.confidence] || {}).label },
          { key: 'acao', label: 'Ação sugerida', value: (o) => o.fha.acao[0] }
        ]
      });
    } else {
      new ui.DataTable(tEl, {
        rows: hist, pageSize: 8, csvName: 'energia_historico', onRowClick: (e) => D.openEvent(e.event_id),
        emptyTitle: 'Nenhum registro histórico',
        columns: [
          { key: 'title', label: 'Registro', render: (e) => `<b>${U.esc(e.title)}</b><div class="small muted">${e.event_id} ${ui.sim()}</div>` },
          { key: 'distributor', label: 'Distribuidora' }, { key: 'subcategory', label: 'Tipo' },
          { key: 'period', label: 'Período de referência', value: (e) => U.d(e.start_time) + ' a ' + U.d(e.end_time) },
          { key: 'provider', label: 'Fonte' },
          { key: 'note', label: 'Uso no motor', value: () => 'Contexto histórico — não entra na correlação em tempo real' }
        ]
      });
    }
  }

  return { subtitle: 'Distribuidoras, interrupções e conveniados afetados', render };
})();
