/* ==========================================================================
   TELA 6 — MOTOR DE CORRELAÇÃO DE INCIDENTES
   ========================================================================== */
IOA.views.correlacao = (function () {
  const U = IOA.utils, R = IOA.ref, S = IOA.store, ui = IOA.ui, D = IOA.details;
  const local = { rule: '', conf: '', status: 'ativas', group: '', selected: null };
  let mini = null;

  const GROUPS = {
    regional_ext: ['Regional com evento externo', (o) => o.regional && o.primary_event],
    regional_unexpl: ['Regional sem explicação', (o) => o.regional && !o.primary_event && o.rule !== 'R5'],
    single_ext: ['Individual com evento próximo', (o) => !o.regional && o.primary_event],
    isolated: ['Problema isolado', (o) => !o.regional && !o.primary_event && o.rule !== 'R5']
  };

  function filtered(v) {
    return v.occurrences.filter((o) =>
      (!local.rule || o.rule === local.rule || o.supporting.includes(local.rule)) &&
      (!local.conf || o.confidence === local.conf) &&
      (local.status === 'todas' || o.status !== 'resolvido') &&
      (!local.group || GROUPS[local.group][1](o)))
      .sort((a, b) => (a.rule === 'ISO') - (b.rule === 'ISO') || R.SEVERITIES[b.severity].rank - R.SEVERITIES[a.severity].rank || (b.score ? b.score.total : 0) - (a.score ? a.score.total : 0));
  }

  function render(el, params) {
    params = params || {};
    if (params.occ) { local.selected = params.occ; local.rule = ''; local.conf = ''; local.group = ''; const o = S.occurrence(params.occ); if (o && o.status === 'resolvido') local.status = 'todas'; }
    if (params.group) { local.group = params.group; local.rule = ''; local.conf = ''; }
    const v = S.view();
    const list = filtered(v);
    if (!list.find((o) => o.id === local.selected)) local.selected = list.length ? list[0].id : null;
    const ruleCounts = Object.keys(IOA.engine.RULES).map((r) => [r, v.occurrences.filter((o) => (o.rule === r || o.supporting.includes(r)) && (local.status === 'todas' || o.status !== 'resolvido')).length]);
    const eng = S.state.engine;

    el.innerHTML = `
      <div class="info-banner">${ui.icon('info')}<span>Regras determinísticas e auditáveis: cada ocorrência mostra <b>FATO</b> (observado), <b>HIPÓTESE</b> (explicação possível) e <b>AÇÃO</b>. Correlação geográfica e temporal <b>não prova causa</b>. Motor executado às ${U.time(eng.ranAt)} em ${eng.elapsedMs} ms sobre ${eng.signals} sinais de falha.</span></div>
      <div class="card" style="margin-bottom:14px"><div class="card-body" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
        <span class="small muted" style="margin-right:4px">Regra:</span>
        <div class="seg" id="ruleSeg"><button data-r="" class="${!local.rule ? 'on' : ''}">Todas</button>${ruleCounts.map(([r, n]) => `<button data-r="${r}" class="${local.rule === r ? 'on' : ''}" title="${U.esc(IOA.engine.RULES[r].name)}">${r} <span class="muted">${n}</span></button>`).join('')}</div>
        <span class="small muted" style="margin:0 4px 0 10px">Confiança:</span>
        <div class="seg" id="confSeg"><button data-c="" class="${!local.conf ? 'on' : ''}">Todas</button>${Object.entries(R.CONFIDENCE).map(([k, c]) => `<button data-c="${k}" class="${local.conf === k ? 'on' : ''}">${c.label}</button>`).join('')}</div>
        <div class="seg" id="stSeg" style="margin-left:auto"><button data-s="ativas" class="${local.status === 'ativas' ? 'on' : ''}">Ativas</button><button data-s="todas" class="${local.status === 'todas' ? 'on' : ''}">Incluir resolvidas</button></div>
        ${local.group ? `<span class="badge ana">${GROUPS[local.group][0]} <a href="#" id="clrGroup" style="margin-left:4px">✕</a></span>` : ''}
      </div></div>
      <div class="corr-layout">
        <div class="card"><div class="card-head"><h3>Ocorrências</h3><span class="sub">${list.length}</span></div>
          <div class="occ-list" id="occList">${list.length ? list.map((o) => `<button class="occ-item ${o.id === local.selected ? 'sel' : ''}" data-id="${o.id}">
            <div class="t">${U.esc(o.title)}</div>
            <div class="m">${ui.ruleChip(o.rule)}${o.supporting.map((r) => ui.ruleChip(r, true)).join('')} ${ui.sev(o.severity)} ${ui.conf(o.confidence)}</div>
            <div class="m" style="margin-top:4px"><span>${o.partners.length} conv.</span><span>· ${o.incidents.length} incid.</span><span>· ${U.hm(o.first_seen)}</span>${o.status === 'resolvido' ? ui.badge('Resolvida', 'ok') : ''}${o.score ? `<span style="margin-left:auto" title="Índice de evidência (não é probabilidade)">IE ${o.score.total}</span>` : ''}</div></button>`).join('')
            : ui.empty('Nenhuma ocorrência', 'Ajuste os filtros globais ou os filtros acima.', 'filter')}</div></div>
        <div id="occDetail"></div>
      </div>
      <div class="card mt" id="rulesCard"></div>
      <div class="card mt"><div class="card-head"><h3>Tabela CORRELATIONS</h3><span class="sub">uma linha por conveniado × ocorrência (entidade normalizada)</span></div><div id="corrTable"></div></div>`;

    el.querySelectorAll('#ruleSeg [data-r]').forEach((b) => b.addEventListener('click', () => { local.rule = b.dataset.r; render(el); }));
    el.querySelectorAll('#confSeg [data-c]').forEach((b) => b.addEventListener('click', () => { local.conf = b.dataset.c; render(el); }));
    el.querySelectorAll('#stSeg [data-s]').forEach((b) => b.addEventListener('click', () => { local.status = b.dataset.s; render(el); }));
    const cg = el.querySelector('#clrGroup'); if (cg) cg.addEventListener('click', (e) => { e.preventDefault(); local.group = ''; render(el); });
    el.querySelectorAll('#occList [data-id]').forEach((b) => b.addEventListener('click', () => {
      local.selected = b.dataset.id;
      el.querySelectorAll('#occList .occ-item').forEach((x) => x.classList.toggle('sel', x.dataset.id === local.selected));
      detail(el.querySelector('#occDetail'));
    }));
    detail(el.querySelector('#occDetail'));
    if (params.occ) { const s = el.querySelector('#occList .sel'); if (s) s.scrollIntoView({ block: 'nearest' }); }
    rulesPanel(el.querySelector('#rulesCard'), 'correlacao');

    new ui.DataTable(el.querySelector('#corrTable'), {
      rows: v.correlations, pageSize: 10, csvName: 'correlations', sort: { key: 'occurrence_id', dir: 'asc' },
      onRowClick: (c) => D.openOccurrence(c.occurrence_id),
      columns: [
        { key: 'correlation_id', label: 'correlation_id', render: (c) => `<span class="mono">${c.correlation_id}</span>` },
        { key: 'occurrence_id', label: 'Ocorrência', render: (c) => `<span class="mono">${c.occurrence_id}</span>` },
        { key: 'external_event_id', label: 'external_event_id', value: (c) => c.external_event_id || '—' },
        { key: 'incident_id', label: 'incident_id', value: (c) => c.incident_id || '—' },
        { key: 'partner_code', label: 'partner_code', render: (c) => `<span class="mono">${c.partner_code}</span>` },
        { key: 'correlation_type', label: 'Tipo', render: (c) => ui.ruleChip(c.correlation_type) },
        { key: 'geographical_distance', label: 'Distância (km)', num: true },
        { key: 'temporal_difference', label: 'Δ tempo (min)', num: true, value: (c) => (c.temporal_difference == null ? '—' : c.temporal_difference) , sortValue: (c) => c.temporal_difference },
        { key: 'confidence_level', label: 'Confiança', render: (c) => ui.conf(c.confidence_level), sortValue: (c) => (R.CONFIDENCE[c.confidence_level] || { rank: 0 }).rank, csv: (c) => (R.CONFIDENCE[c.confidence_level] || { label: 'sem correlação externa' }).label },
        { key: 'hypothesis', label: 'Hipótese', cls: 'wide', render: (c) => `<span class="small">${U.esc(c.hypothesis)}</span>` },
        { key: 'evidence', label: 'Evidência', cls: 'wide', csv: (c) => c.evidence, render: (c) => `<span class="small muted">${U.esc(c.evidence.slice(0, 90))}…</span>` },
        { key: 'recommended_action', label: 'Ação recomendada', cls: 'wide', render: (c) => `<span class="small">${U.esc(c.recommended_action)}</span>` }
      ]
    });
  }

  function detail(box) {
    if (mini) { mini.remove(); mini = null; }
    const o = local.selected && S.occurrence(local.selected);
    if (!o) { box.innerHTML = `<div class="card">${ui.empty('Selecione uma ocorrência', 'Os detalhes aparecem aqui.', 'link')}</div>`; return; }
    box.innerHTML = `<div class="card">
      <div class="card-head" style="align-items:flex-start"><div style="min-width:0"><div class="small muted">${o.id} · ${U.esc(IOA.engine.RULES[o.rule].name)}</div><h3 style="font-size:15px;margin-top:2px">${U.esc(o.title)}</h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${ui.ruleChip(o.rule)} ${o.supporting.map((r) => ui.ruleChip(r, true)).join(' ')} ${ui.sev(o.severity)} ${ui.conf(o.confidence)} ${o.recurrent ? ui.badge('Recorrente', 'warn') : ''}</div></div>
        <div class="actions"><button class="btn sm" id="occOpen">${ui.icon('layers')} Abrir painel</button></div></div>
      <div class="card-body">
        <div id="miniMap" style="height:200px;border-radius:6px;border:1px solid var(--border);margin-bottom:12px"></div>
        ${D.occurrenceBody(o, { row: true })}
      </div></div>`;
    D.wire(box, false);
    box.querySelector('#occOpen').addEventListener('click', () => D.openOccurrence(o.id));
    if (!window.L) return;
    mini = L.map(box.querySelector('#miniMap'), { zoomControl: false, attributionControl: true, scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' }).addTo(mini);
    const pts = [];
    o.related_events.map(S.event).forEach((e) => {
      const c = L.circle([e.latitude, e.longitude], { radius: e.affected_radius * 1000, color: ui.CAT_COLOR[e.category], weight: e.event_id === o.primary_event ? 2.5 : 1, dashArray: e.event_id === o.primary_event ? null : '4 4', fillOpacity: 0.1 }).addTo(mini);
      c.bindTooltip(U.esc(e.title)); pts.push([e.latitude, e.longitude]);
    });
    o.partners.map(S.partner).forEach((p) => {
      L.circleMarker([p.latitude, p.longitude], { radius: 6, color: '#fff', weight: 1.5, fillColor: p.operational_status === 'offline' ? '#D92D20' : p.operational_status === 'degradado' ? '#C27803' : '#0E9F6E', fillOpacity: 1 })
        .bindTooltip(p.partner_code + ' · ' + U.esc(p.partner_name) + ' · ' + p.telecom_operator).on('click', () => D.openPartner(p.partner_code)).addTo(mini);
      pts.push([p.latitude, p.longitude]);
    });
    if (pts.length === 1) mini.setView(pts[0], 12); else mini.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 13 });
  }

  /* ---------------- Painel de regras (reutilizado em Conectividade) ---------------- */
  function rulesPanel(card, context) {
    const cfg = S.state.engine.config;
    const detection = [
      ['Várias unidades próximas da mesma operadora indisponíveis em curto período', 'R1', 'raio, janela, mínimo e fatia da operadora'],
      ['Falhas simultâneas de conectividade em conveniados diferentes', 'R4 / R6', 'raio e janela'],
      ['Aumento de incidentes numa cidade', 'R5', 'janela de recorrência'],
      ['Falhas repetidas de conectividade na mesma área', 'R5', 'janela e mínimo de ocorrências'],
      ['Degradação de rede reportada por fonte externa', 'R1', 'evento de operadora na área (fonte simulada)']
    ];
    const params = [
      ['radius_km', 'Raio de agrupamento (km)', 1, 100], ['window_min', 'Janela entre falhas (min)', 5, 240], ['min_partners', 'Mínimo de conveniados (regional)', 2, 20],
      ['dominant_share', 'Fatia mínima da operadora (R1)', 0.5, 1, 0.05], ['event_buffer_km', 'Tolerância ao raio do evento (km)', 0, 50], ['event_tolerance_min', 'Tolerância temporal ao evento (min)', 0, 360],
      ['lookback_h', 'Horizonte de análise (h)', 1, 168], ['repeat_days', 'Janela de recorrência (dias)', 7, 90], ['repeat_min', 'Mínimo para recorrência', 2, 10]
    ];
    card.innerHTML = `<div class="card-head"><h3>${context === 'conectividade' ? 'Regras de detecção de conectividade' : 'Regras de correlação e parâmetros'}</h3><span class="sub">configuráveis · reprocessa o motor localmente</span>
      <div class="actions"><button class="btn sm" id="rpReset">Restaurar padrão</button><button class="btn sm ana" id="rpApply">${ui.icon('refresh')} Aplicar e reprocessar</button></div></div>
      <div class="card-body">
        ${context === 'conectividade' ? `<table class="dt" style="margin-bottom:12px"><thead><tr><th>Regra de detecção</th><th>Regra do motor</th><th>Parâmetros</th></tr></thead><tbody>${detection.map((d) => `<tr><td>${d[0]}</td><td><span class="rule-chip">${d[1]}</span></td><td class="small muted">${d[2]}</td></tr>`).join('')}</tbody></table>` : ''}
        <table class="dt rules-table" style="margin-bottom:12px"><thead><tr><th>Ativa</th><th>Regra</th><th>Critério</th></tr></thead><tbody>
        ${['R1', 'R2', 'R3', 'R4', 'R5', 'R6'].map((r) => `<tr><td><label class="toggle"><input type="checkbox" data-rule="${r}" ${cfg.rules[r] !== false ? 'checked' : ''}></label></td><td>${ui.ruleChip(r)} <b>${IOA.engine.RULES[r].name}</b></td><td class="small">${U.esc(IOA.engine.RULES[r].desc)}</td></tr>`).join('')}
        </tbody></table>
        <div class="param-grid">${params.map(([k, l, mn, mx, st]) => `<div><label>${l}</label><input type="number" data-p="${k}" min="${mn}" max="${mx}" step="${st || 1}" value="${cfg[k]}"></div>`).join('')}</div>
        <div class="grid g-2" style="margin-top:14px">
          <div class="note"><b>Níveis de confiança</b><br>${Object.values(R.CONFIDENCE).map((c) => `${c.label}: ${U.esc(c.desc)}`).join('<br>')}</div>
          <div class="note"><b>Índice de evidência (IE)</b><br>Soma de pontos: proximidade geográfica (até 25), alinhamento temporal (25), confiabilidade da fonte externa (30), volume de conveniados (10) e homogeneidade de operadora ou causa comum (10). Ordena ocorrências; <b>não é probabilidade estatística</b> nem prova de causa.</div>
        </div>
      </div>`;
    card.querySelector('#rpApply').addEventListener('click', () => {
      const next = Object.assign({}, cfg, { rules: {} });
      card.querySelectorAll('[data-p]').forEach((i) => { const n = parseFloat(i.value); if (!isNaN(n)) next[i.dataset.p] = Math.min(+i.max, Math.max(+i.min, n)); });
      card.querySelectorAll('[data-rule]').forEach((c) => { next.rules[c.dataset.rule] = c.checked; });
      S.runEngine(next);
      ui.toast('Motor reprocessado: ' + S.state.engine.occurrences.length + ' ocorrências.');
    });
    card.querySelector('#rpReset').addEventListener('click', () => { S.runEngine(JSON.parse(JSON.stringify(IOA.engine.DEFAULT_CONFIG))); ui.toast('Parâmetros padrão restaurados.'); });
  }

  function destroy() { if (mini) { mini.remove(); mini = null; } }

  return { subtitle: 'Regras transparentes: Fato, Hipótese e Ação para cada ocorrência', render, destroy, rulesPanel };
})();
