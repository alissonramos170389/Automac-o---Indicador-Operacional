/* ==========================================================================
   TELA 8 — CONFIGURAÇÕES E INTEGRAÇÕES
   ========================================================================== */
IOA.views.config = (function () {
  const U = IOA.utils, S = IOA.store, ui = IOA.ui, I = IOA.integrations;
  const DOMAIN = { interno: 'Interno', telecom: 'Telecom', clima: 'Clima', energia: 'Energia' };

  const MODEL = {
    PARTNERS: ['partner_id', 'partner_code', 'partner_name', 'state', 'city', 'postal_code', 'latitude', 'longitude', 'telecom_operator', 'connectivity_type', 'distributor', 'operational_status'],
    INTERNAL_INCIDENTS: ['incident_id', 'partner_code', 'source', 'category', 'description', 'start_time', 'end_time', 'status', 'severity', '+ sn_class', '+ integration_id', '+ duration_min'],
    EXTERNAL_EVENTS: ['event_id', 'provider', 'category', 'subcategory', 'state', 'city', 'latitude', 'longitude', 'affected_radius', 'start_time', 'end_time', 'severity', 'event_status', 'source_timestamp', 'last_updated', '+ evidence_type', '+ realtime', '+ simulated'],
    CORRELATIONS: ['correlation_id', 'external_event_id', 'incident_id', 'partner_code', 'correlation_type', 'geographical_distance', 'temporal_difference', 'confidence_level', 'evidence', 'hypothesis', 'recommended_action'],
    API_MONITORING: ['provider', 'endpoint', 'last_success', 'last_attempt', 'response_status', 'error_message', 'records_received', 'data_freshness']
  };

  function statusBadge(st) { const s = I.STATUS[st]; return `<span class="badge ${s.cls}">${s.label}</span>`; }

  function openSource(src) {
    const m = I.monitoring.get(src.id);
    const body = `
      ${src.planned ? '<div class="note warn" style="margin-bottom:12px"><b>Fonte planejada, não validada.</b> Endpoint, autenticação e disponibilidade ainda precisam de validação técnica e contratual. No V0 a resposta é simulada.</div>' : '<div class="note sim" style="margin-bottom:12px">Fonte interna existente; no V0 os dados vêm do simulador com a mesma estrutura normalizada.</div>'}
      ${src.note ? `<div class="note" style="margin-bottom:12px">${U.esc(src.note)}</div>` : ''}
      <div class="section-title">Configuração do adapter</div>
      ${IOA.details.kv([['Identificador', `<span class="mono">${src.id}</span>`], ['Domínio', DOMAIN[src.domain]], ['Provedor', U.esc(src.provider)], ['Endpoint', `<span class="mono">${U.esc(src.endpoint)}</span>`], ['Autenticação', U.esc(src.auth)], ['Parâmetros de consulta', U.esc(src.params)], ['Coordenadas', src.domain === 'interno' ? 'Não se aplica' : 'Por célula regional de ' + I.CELL_DEG + '° (centroide)'], ['Frequência', U.duration(src.frequency_min)], ['Política de retentativa', U.esc(src.retry)], ['Status', statusBadge(m.status)]])}
      <div class="section-title">Monitoramento (API_MONITORING)</div>
      <div id="monBox">${monKV(m)}</div>
      <div style="margin-top:14px;display:flex;gap:8px;align-items:center"><button class="btn primary" id="testBtn">${ui.icon('refresh')} Testar consulta (simulada)</button><span class="small muted" id="testOut"></span></div>`;
    ui.drawer.open({
      kicker: 'Integração · ' + DOMAIN[src.domain], title: U.esc(src.name), badges: `${statusBadge(m.status)} ${src.planned ? ui.badge('Planejada', 'outline') : ui.badge('Existente', 'info')} ${ui.sim()}`, body,
      onMount: (el) => el.querySelector('#testBtn').addEventListener('click', async () => {
        const out = el.querySelector('#testOut'); out.textContent = 'Consultando…';
        try { const r = await I.adapters[src.id].fetch({ teste: Date.now() }); out.textContent = r.meta.status === 'nao_configurado' ? 'Fonte não configurada: nada consultado.' : `OK (simulado): ${r.records.length} registro(s).`; }
        catch (e) { out.innerHTML = `<span style="color:var(--crit)">Erro: ${U.esc(e.message)}</span>`; }
        el.querySelector('#monBox').innerHTML = monKV(I.monitoring.get(src.id));
      })
    });
  }
  const monKV = (m) => IOA.details.kv([['Última consulta com sucesso', U.dt(m.last_success)], ['Última tentativa', U.dt(m.last_attempt)], ['Status da resposta', m.response_status ? `<span class="mono">${m.response_status}</span>` : '—'], ['Mensagem de erro', U.esc(m.error_message || '—')], ['Registros recebidos', U.num(m.records_received)], ['Atualidade dos dados', U.esc(m.data_freshness || '—')]]);

  function render(el) {
    const cells = I.regionalCells(S.state.data.partners);
    const extSources = I.SOURCES.filter((s) => s.domain !== 'interno' && s.status !== 'nao_configurado').length;
    el.innerHTML = `
      <div class="note sim" style="margin-bottom:14px"><b>V0 — todas as integrações são simuladas.</b> Nenhuma API externa é chamada e nenhuma resposta é apresentada como real. Fontes externas listadas são <b>planejadas</b>: endpoints e disponibilidade ainda não foram validados.</div>
      <div class="card"><div class="card-head"><h3>Fontes de dados e adapters</h3><span class="sub">clique para ver configuração e testar (simulado)</span></div><div id="srcTable"></div></div>
      <div class="grid g-2 mt">
        <div class="card"><div class="card-head"><h3>Cache e consultas regionais</h3></div><div class="card-body">
          <p style="margin-top:0">Consultas externas são feitas por <b>célula geográfica</b> (${I.CELL_DEG}° ≈ 55 km), não por conveniado, e reaproveitadas até vencer a frequência configurada.</p>
          <div class="grid g-3"><div class="note"><div class="small muted">Conveniados</div><b style="font-size:20px">${S.state.data.partners.length}</b></div><div class="note"><div class="small muted">Células regionais</div><b style="font-size:20px">${cells.length}</b></div><div class="note"><div class="small muted">Consultas por ciclo</div><b style="font-size:20px">${cells.length * extSources}</b><div class="small muted">em vez de ${U.num(S.state.data.partners.length * extSources)}</div></div></div>
          <p class="small muted">Com 3.000+ conveniados o número de células cresce pouco (a rede se concentra nas mesmas regiões). Em produção: filas assíncronas, agendamento por fonte, atualização incremental e histórico separado dos eventos atuais.</p>
        </div></div>
        <div class="card"><div class="card-head"><h3>Como conectar uma API real</h3></div><div class="card-body">
          <ol style="margin:0;padding-left:18px;line-height:1.7">
            <li>Validar endpoint, contrato e autenticação do provedor.</li>
            <li>Em <span class="mono">js/integrations/adapters.js</span>, trocar o <span class="mono">transport</span> simulado do adapter por uma chamada HTTP (de preferência via backend, para guardar credenciais).</li>
            <li>Implementar a normalização para o modelo <span class="mono">EXTERNAL_EVENTS</span> (incluindo <span class="mono">evidence_type</span> e <span class="mono">realtime</span>).</li>
            <li>Mudar o status da fonte para <span class="mono">ok</span> somente após validação. As telas não mudam.</li>
          </ol>
          <p class="small muted">Horários normalizados em ISO 8601 (UTC) e exibidos em America/Sao_Paulo.</p>
        </div></div>
      </div>
      <div class="card mt"><div class="card-head"><h3>Mapeamento de campos das fontes internas</h3><span class="sub">o que ainda precisa ser confirmado nas exportações existentes</span></div>
        <div class="card-body"><div class="grid g-2">${Object.entries(I.FIELD_MAPPING).map(([src, rows]) => `<div><div class="section-title" style="margin-top:0">${U.esc(src)}</div><table class="dt"><thead><tr><th>Campo normalizado</th><th>Origem esperada</th><th>Situação</th></tr></thead><tbody>${rows.map(([a, b, c]) => `<tr><td class="mono">${a}</td><td>${U.esc(b)}</td><td>${ui.badge(c, c === 'confirmado' ? 'ok' : 'warn')}</td></tr>`).join('')}</tbody></table></div>`).join('')}</div>
        <div class="note" style="margin-top:12px">Classificação ServiceNow preservada do Cockpit: <b>Problema Geral</b>, <b>Parcial</b> e <b>Outros</b> (arquivos <span class="mono">wm_order_DD-MM.xlsx</span>).</div></div></div>
      <div class="card mt"><div class="card-head"><h3>Modelo de dados normalizado</h3><span class="sub">“+” = campo adicional do V0</span></div>
        <div class="card-body"><div class="grid g-3">${Object.entries(MODEL).map(([k, f]) => `<div class="note" style="background:var(--surface)"><b class="mono">${k}</b><div class="small" style="margin-top:6px;line-height:1.7">${f.map((x) => `<span class="mono" style="color:${x.startsWith('+') ? 'var(--ana)' : 'inherit'}">${x}</span>`).join(' · ')}</div></div>`).join('')}</div></div></div>
      <div class="card mt"><div class="card-head"><h3>Motor de correlação</h3><div class="actions"><a href="#/correlacao" class="btn sm">Ajustar regras e parâmetros →</a></div></div>
        <div class="card-body small">Parâmetros atuais: raio ${S.state.engine.config.radius_km} km · janela ${S.state.engine.config.window_min} min · mínimo ${S.state.engine.config.min_partners} conveniados · fatia da operadora ${Math.round(S.state.engine.config.dominant_share * 100)}% · horizonte ${S.state.engine.config.lookback_h} h. Parâmetros alterados ficam salvos neste navegador.</div></div>`;

    new ui.DataTable(el.querySelector('#srcTable'), {
      rows: I.SOURCES, pageSize: 20, csvName: 'api_monitoring', onRowClick: openSource,
      columns: [
        { key: 'name', label: 'Fonte', render: (s) => `<b>${U.esc(s.name)}</b><div class="small muted">${U.esc(s.provider)}</div>` },
        { key: 'domain', label: 'Domínio', value: (s) => DOMAIN[s.domain] },
        { key: 'status', label: 'Status', value: (s) => I.STATUS[I.monitoring.get(s.id).status].label, render: (s) => statusBadge(I.monitoring.get(s.id).status) + (s.planned ? ' ' + ui.badge('Planejada', 'outline') : '') },
        { key: 'endpoint', label: 'Endpoint', render: (s) => `<span class="small mono">${U.esc(s.endpoint)}</span>` },
        { key: 'frequency_min', label: 'Frequência', num: true, value: (s) => U.duration(s.frequency_min), sortValue: (s) => s.frequency_min },
        { key: 'last_success', label: 'Último sucesso', value: (s) => U.dt(I.monitoring.get(s.id).last_success), sortValue: (s) => I.monitoring.get(s.id).last_success },
        { key: 'resp', label: 'Resposta', value: (s) => I.monitoring.get(s.id).response_status || '—', render: (s) => `<span class="mono small">${I.monitoring.get(s.id).response_status || '—'}</span>` },
        { key: 'records', label: 'Registros', num: true, value: (s) => I.monitoring.get(s.id).records_received },
        { key: 'fresh', label: 'Atualidade / erro', render: (s) => { const m = I.monitoring.get(s.id); return `<span class="small ${m.error_message ? '' : 'muted'}" style="${m.status === 'indisponivel' ? 'color:var(--crit)' : ''}">${U.esc(m.error_message || m.data_freshness || '—')}</span>`; }, value: (s) => { const m = I.monitoring.get(s.id); return m.error_message || m.data_freshness || ''; } }
      ]
    });
  }

  return { subtitle: 'Fontes, adapters simulados, mapeamentos e modelo de dados', render };
})();
