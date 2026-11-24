/* ==========================================================================
   Painéis de detalhe (drawers): conveniado, evento externo, incidente e
   ocorrência correlacionada. Compartilhados por todas as telas.
   ========================================================================== */
IOA.details = (function () {
  const U = IOA.utils, R = IOA.ref, S = IOA.store, ui = IOA.ui;
  const kv = (pairs, cls) => `<dl class="kv ${cls || ''}">${pairs.map(([k, v]) => `<div><dt>${U.esc(k)}</dt><dd>${v == null || v === '' ? '—' : v}</dd></div>`).join('')}</dl>`;
  const link = (type, id, text) => `<a href="#" data-open="${type}" data-id="${U.esc(id)}">${U.esc(text || id)}</a>`;

  /** Liga os links internos [data-open] de um container a drawers. */
  function wire(root, push) {
    root.querySelectorAll('[data-open]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      const fn = { partner: openPartner, event: openEvent, incident: openIncident, occurrence: openOccurrence }[a.dataset.open];
      if (fn) fn(a.dataset.id, push !== false);
    }));
  }

  function fhaHTML(fha, row) {
    const li = (arr) => arr.map((x) => `<li>${U.esc(x)}</li>`).join('');
    return `<div class="fha ${row ? 'row' : ''}">
      <div class="fha-block fha-fato"><h4>${ui.icon('check', '')} Fato</h4><ul>${li(fha.fato)}</ul></div>
      <div class="fha-block fha-hip"><h4>${ui.icon('spark', '')} Hipótese</h4><ul>${li(fha.hipotese)}</ul></div>
      <div class="fha-block fha-acao"><h4>${ui.icon('target', '')} Ação</h4><ul>${li(fha.acao)}</ul></div></div>`;
  }

  function scoreHTML(o) {
    if (!o.score) return '<div class="note">Recorrência não usa índice de evidência: o critério é a contagem de incidentes da mesma categoria na janela configurada.</div>';
    const s = o.score;
    const rows = [['Proximidade geográfica', s.geo, 25], ['Alinhamento temporal', s.temporal, 25], ['Fonte externa', s.source, 30], ['Volume de conveniados', s.volume, 10], ['Homogeneidade / causa comum', s.homogeneity, 10]];
    return `<div class="score"><div style="display:flex;justify-content:space-between;align-items:baseline"><b>Índice de evidência: ${s.total}/100</b><span class="small muted">não é probabilidade</span></div>
      <div class="score-bars">${rows.map(([l, v, m]) => `<span>${l}</span><div class="score-bar"><div style="width:${(v / m) * 100}%"></div></div><span class="small tnum right">${v}/${m}</span>`).join('')}</div>
      <p class="small muted" style="margin:8px 0 0">Soma de pontos por critério observável (distância ao evento, diferença de horário, confiabilidade da fonte, nº de conveniados e mesma operadora/operadoras diferentes). Serve para ordenar e comparar ocorrências; <b>não</b> representa a chance estatística de a causa estar correta. A classificação de confiança ao lado é definida pelas regras, não pelo índice.</p></div>`;
  }

  /* ------------------------------------------------------------------ */
  function diagnosisHTML(p) {
    const d = S.diag(p.partner_code);
    if (!d) {
      if (p.operational_status === 'online') return `<div class="diag none">${ui.icon('check')}<div><h4>Operando normalmente</h4><p>Sem falha registrada nas últimas ${S.state.engine.config.lookback_h} h.</p></div></div>`;
      return `<div class="diag iso">${ui.icon('info')}<div><h4>Sem diagnóstico</h4><p>Falha fora da janela de análise.</p></div></div>`;
    }
    const o = S.occurrence(d.occurrence);
    const regional = d.regional && o.rule !== 'ISO';
    return `<div class="diag ${regional ? 'reg' : 'iso'}">${ui.icon(regional ? 'users' : 'pin')}<div>
      <h4>${regional ? 'Evento regional — ' : ''}${U.esc(d.classification)}</h4>
      <p>${regional ? `Faz parte da ocorrência ${link('occurrence', o.id)} com ${o.partners.length} conveniados.` : o.rule === 'ISO' ? 'Nenhum vizinho afetado e nenhum evento externo próximo: tratar como problema isolado.' : `Ocorrência ${link('occurrence', o.id)}.`}</p>
      <div style="margin-top:6px">${ui.ruleChip(o.rule)} ${ui.conf(o.confidence)}</div></div></div>`;
  }

  function openPartner(code, push) {
    const p = S.partner(code); if (!p) return;
    const z = S.partnerZabbix(code);
    const incs = S.partnerIncidents(code).slice().sort((a, b) => Date.parse(b.start_time) - Date.parse(a.start_time));
    const open = incs.filter((i) => i.status !== 'resolvido');
    const near = S.eventsNear(p);
    const cmdb = S.partnerCmdb(code);
    const d = S.diag(code);
    const causes = [];
    if (d) { const o = S.occurrence(d.occurrence); causes.push(...o.fha.hipotese); }
    if (!causes.length && near.length) causes.push('Eventos externos ativos próximos podem afetar o conveniado — monitorar.');
    const body = `
      ${diagnosisHTML(p)}
      <div class="section-title">Identificação</div>
      ${kv([['Código', `<span class="mono">${p.partner_code}</span>`], ['Nome', U.esc(p.partner_name)], ['UF / Cidade', `${p.state} · ${U.esc(p.city)}`], ['CEP', p.postal_code], ['Latitude / longitude', `<span class="mono">${p.latitude}, ${p.longitude}</span>`], ['Tipo de serviço', p.service_type], ['Status Base OPC', p.opc_status], ['Distribuidora (exemplo)', p.distributor]])}
      <div class="section-title">Conectividade e disponibilidade</div>
      ${kv([['Operadora', p.telecom_operator], ['Tecnologia', p.connectivity_type], ['Status atual', ui.partnerStatus(p.operational_status)], ['Disponibilidade (24h)', U.pct(p.availability_24h)], ['Última comunicação', `${U.dt(p.last_communication)} <span class="muted small">(${U.ago(p.last_communication, S.state.data.now)})</span>`], ['Offline desde', p.offline_since ? U.dt(p.offline_since) : '—'], ['Zabbix', z ? `${U.esc(z.monitoring_status)}${z.trigger ? ' · ' + U.esc(z.trigger) : ''}` : '—'], ['Incidentes abertos', open.length]], '')}
      <div class="section-title">Eventos externos ativos próximos (${near.length})</div>
      ${near.length ? `<div class="ev-list card">${near.map(({ e, dist }) => `<button class="ev-item" data-open="event" data-id="${e.event_id}"><span class="ev-bar" style="background:${ui.CAT_COLOR[e.category]}"></span><span><div class="ev-title">${U.esc(e.title)}</div><div class="ev-meta">${ui.cat(e.category)} ${ui.evidence(e.evidence_type)} <span>${dist.toFixed(1)} km</span></div></span><span class="ev-side">${ui.sev(e.severity)}</span></button>`).join('')}</div>` : '<div class="note">Nenhum evento externo ativo dentro do raio de influência.</div>'}
      <div class="section-title">Possíveis causas</div>
      ${causes.length ? `<ul style="margin:0;padding-left:18px">${causes.map((c) => `<li>${U.esc(c)}</li>`).join('')}</ul>` : '<div class="note">Sem falha atual.</div>'}
      <div class="section-title">Incidentes (${incs.length})</div>
      ${incs.length ? `<table class="dt"><thead><tr><th>ID</th><th>Classe</th><th>Categoria</th><th>Abertura</th><th>Status</th></tr></thead><tbody>${incs.slice(0, 12).map((i) => `<tr><td>${link('incident', i.incident_id)}</td><td>${U.esc(i.sn_class)}</td><td>${U.esc(R.INCIDENT_CATEGORIES[i.category])}</td><td class="nowrap">${U.dt(i.start_time)}</td><td>${ui.incStatus(i.status)}</td></tr>`).join('')}</tbody></table>` : '<div class="note">Sem incidentes registrados.</div>'}
      <div class="section-title">Equipamentos (CMDB)</div>
      <table class="dt"><thead><tr><th>Equipamento</th><th>Tipo</th><th>SO / modem</th><th>Última coleta</th></tr></thead><tbody>${cmdb.map((c) => `<tr><td class="mono">${c.equipment_id}</td><td>${U.esc(c.equipment_type)}</td><td>${U.esc(c.operating_system || c.modem || '—')}</td><td class="nowrap">${U.dt(c.last_collection)}</td></tr>`).join('')}</tbody></table>
      <p class="small muted" style="margin-top:14px">${ui.sim('DADOS SIMULADOS')} Conveniado, CMDB, Zabbix e incidentes gerados para demonstração.</p>`;
    ui.drawer.open({ kicker: 'Conveniado', title: `${p.partner_code} · ${U.esc(p.partner_name)}`, badges: `${ui.partnerStatus(p.operational_status)} ${ui.badge(p.telecom_operator + ' · ' + p.connectivity_type, 'outline')} ${ui.badge(p.city + '/' + p.state, 'outline')}`, body, onMount: (el) => wire(el) }, push);
  }

  /* ------------------------------------------------------------------ */
  function openEvent(id, push) {
    const e = S.event(id); if (!e) return;
    const imp = S.impact(id);
    const isWeather = e.category === 'clima';
    const fields = [
      ['Identificação', `<span class="mono">${e.event_id}</span>`], ['Categoria', R.EVENT_CATEGORIES[e.category].label + (e.subcategory ? ' · ' + U.esc(isWeather ? R.WEATHER_SUB[e.subcategory] : e.subcategory) : '')],
      ['UF / Cidade', `${e.state} · ${U.esc(e.city)}`], ['Coordenadas (centro)', `<span class="mono">${e.latitude}, ${e.longitude}</span>`],
      ['Área afetada', `Raio estimado de ${e.affected_radius} km${e.estimated_area ? '<br><span class="small muted">' + U.esc(e.estimated_area) + '</span>' : ''}`], ['Severidade', ui.sev(e.severity)],
      ['Início', U.dt(e.start_time)], [isWeather ? 'Fim previsto' : 'Restabelecimento previsto', U.dt(e.estimated_end)],
      ['Fim / restabelecimento real', e.end_time ? U.dt(e.end_time) : (e.event_status === 'resolvido' ? '—' : 'Em andamento')], ['Status', ui.evStatus(e.event_status)],
      ['Fonte de dados', U.esc(e.provider)], ['Natureza da informação', ui.evidence(e.evidence_type)],
      ['Horário na fonte', U.dt(e.source_timestamp)], ['Última atualização', U.dt(e.last_updated)]
    ];
    if (e.operator) fields.push(['Operadora', e.operator], ['Tecnologia', e.technology]);
    if (e.distributor) fields.push(['Distribuidora (exemplo)', e.distributor], ['Causa informada', U.esc(e.cause || '—')]);
    if (e.customers_affected_est) fields.push(['Clientes afetados (estimado)', U.num(e.customers_affected_est)]);
    if (isWeather) fields.push(['Precipitação atual', e.precipitation_mm_h != null ? e.precipitation_mm_h + ' mm/h' : '—'], ['Chuva acumulada', e.accumulated_mm != null ? e.accumulated_mm + ' mm' : '—'], ['Vento / rajadas', (e.wind_kmh != null ? e.wind_kmh + ' km/h' : '—') + ' / ' + (e.gust_kmh != null ? e.gust_kmh + ' km/h' : '—')]);
    if (e.strikes_last_hour) fields.push(['Raios na última hora', U.num(e.strikes_last_hour)]);
    const warn = e.evidence_type === 'previsao' ? '<div class="note warn" style="margin-bottom:12px"><b>Previsão.</b> Este evento ainda não foi observado e não é usado como evidência de causa.</div>'
      : e.evidence_type === 'historico' ? '<div class="note warn" style="margin-bottom:12px"><b>Registro histórico.</b> Consolidado mensal (ex.: ANEEL). Não é notificação em tempo real e não entra na correlação.</div>'
      : e.evidence_type === 'nao_confirmado' ? '<div class="note warn" style="margin-bottom:12px"><b>Não confirmado.</b> Relato sem validação da distribuidora.</div>' : '';
    const affected = imp.affected.map(S.partner);
    const body = `${warn}
      <div class="grid g-3" style="margin-bottom:12px">
        <div class="card card-body"><div class="small muted">Conveniados próximos</div><div class="kpi-value">${imp.nearby.length}</div></div>
        <div class="card card-body"><div class="small muted">Com falha no período</div><div class="kpi-value" style="color:${affected.length ? 'var(--crit)' : 'inherit'}">${affected.length}</div></div>
        <div class="card card-body"><div class="small muted">Incidentes relacionados</div><div class="kpi-value">${imp.incidents.length}</div></div></div>
      ${!affected.length && e.realtime !== false && e.evidence_type !== 'previsao' ? '<div class="note" style="margin-bottom:12px">Evento ativo <b>sem impacto operacional</b> identificado nos conveniados da área.</div>' : ''}
      <div class="section-title">Dados do evento</div>${kv(fields)}
      ${e.evidence_note ? `<div class="section-title">Evidência</div><div class="note">${U.esc(e.evidence_note)}</div>` : ''}
      ${imp.occurrences.length ? `<div class="section-title">Ocorrências correlacionadas</div>${imp.occurrences.map((oid) => { const o = S.occurrence(oid); return `<div style="margin-bottom:6px">${ui.ruleChip(o.rule)} ${link('occurrence', o.id, o.title)} ${ui.conf(o.confidence)}</div>`; }).join('')}` : ''}
      ${affected.length ? `<div class="section-title">Conveniados com falha na área</div><table class="dt"><thead><tr><th>Código</th><th>Nome</th><th>Operadora</th><th>Status</th></tr></thead><tbody>${affected.map((p) => `<tr><td>${link('partner', p.partner_code)}</td><td>${U.esc(p.partner_name)}</td><td>${p.telecom_operator}</td><td>${ui.partnerStatus(p.operational_status)}</td></tr>`).join('')}</tbody></table>` : ''}
      <p class="small muted" style="margin-top:14px">${ui.sim('EVENTO SIMULADO')} Resposta simulada do adapter “${U.esc(e.provider)}”. Nenhuma API real foi consultada.</p>`;
    ui.drawer.open({ kicker: 'Evento externo · ' + R.EVENT_CATEGORIES[e.category].short, title: U.esc(e.title), badges: `${ui.sim()} ${ui.sev(e.severity)} ${ui.evStatus(e.event_status)} ${ui.evidence(e.evidence_type)}`, body, onMount: (el) => wire(el) }, push);
  }

  /* ------------------------------------------------------------------ */
  function openIncident(id, push) {
    const i = S.incident(id); if (!i) return;
    const p = S.partner(i.partner_code);
    const d = S.diag(i.partner_code);
    const o = d && S.occurrence(d.occurrence);
    const corr = o && o.incidents.includes(i.incident_id);
    const body = `
      ${kv([['Incidente', `<span class="mono">${i.incident_id}</span>`], ['Fonte', i.source], ['Conveniado', link('partner', p.partner_code, p.partner_code + ' · ' + p.partner_name)], ['UF / Cidade', `${p.state} · ${U.esc(p.city)}`],
        ['Classificação (Cockpit)', ui.badge(i.sn_class, i.sn_class === 'Problema Geral' ? 'crit' : i.sn_class === 'Parcial' ? 'warn' : 'muted')], ['Categoria', R.INCIDENT_CATEGORIES[i.category]],
        ['Abertura', U.dt(i.start_time)], ['Encerramento', U.dt(i.end_time)], ['Duração', U.duration(i.duration_min)], ['Status', ui.incStatus(i.status)],
        ['Severidade', ui.sev(i.severity)], ['ID de integração', `<span class="mono">${i.integration_id}</span>`]])}
      <div class="section-title">Descrição</div><div class="note">${U.esc(i.description)}</div>
      <div class="section-title">Correlação</div>
      ${corr ? `<div style="margin-bottom:8px">${ui.ruleChip(o.rule)} ${link('occurrence', o.id, o.title)}</div>${ui.conf(o.confidence)}` : '<div class="note">Incidente não vinculado a ocorrência regional ou evento externo.</div>'}
      <p class="small muted" style="margin-top:14px">${ui.sim('INCIDENTE SIMULADO')} Estrutura equivalente à exportação wm_order_DD-MM.xlsx (campos a confirmar).</p>`;
    ui.drawer.open({ kicker: 'Incidente ServiceNow', title: i.incident_id + ' · ' + U.esc(i.description), badges: `${ui.incStatus(i.status)} ${ui.sev(i.severity)}`, body, onMount: (el) => wire(el) }, push);
  }

  /* ------------------------------------------------------------------ */
  function occurrenceBody(o, opts) {
    opts = opts || {};
    const ev = o.primary_event && S.event(o.primary_event);
    const parts = o.partners.map(S.partner);
    const related = o.related_events.filter((id) => id !== o.primary_event).map(S.event);
    return `
      ${fhaHTML(o.fha, opts.row)}
      <div class="grid ${opts.row ? 'g-2' : ''}" style="margin-top:12px;gap:12px">
        <div>
          <div class="section-title">Classificação</div>
          ${kv([['Regra principal', `${ui.ruleChip(o.rule)} ${U.esc(IOA.engine.RULES[o.rule].name)}`], ['Regras de apoio', o.supporting.length ? o.supporting.map((r) => ui.ruleChip(r, true) + ' ' + IOA.engine.RULES[r].name).join('<br>') : '—'],
            ['Classificação', U.esc(o.classification)], ['Confiança', ui.conf(o.confidence)], ['Severidade', ui.sev(o.severity)], ['Status', ui.badge(o.status === 'ativo' ? 'Ativa' : o.status === 'resolvido' ? 'Resolvida' : 'Em monitoramento', o.status === 'ativo' ? 'crit' : o.status === 'resolvido' ? 'ok' : 'warn')],
            ['Primeira falha', U.dt(o.first_seen)], ['Última falha', U.dt(o.last_seen)], ['Conveniados', o.partners.length + (o.offline_now ? ` (${o.offline_now} offline agora)` : '')], ['Incidentes', o.incidents.length]])}
          ${o.confidence ? `<p class="small muted" style="margin:8px 0 0">${U.esc(R.CONFIDENCE[o.confidence].desc)}</p>` : ''}
        </div>
        <div>
          <div class="section-title">Evidência externa</div>
          ${ev ? `<div class="card" style="padding:10px 12px"><div style="font-weight:600;margin-bottom:4px">${link('event', ev.event_id, ev.title)}</div><div class="ev-meta">${ui.cat(ev.category)} ${ui.evidence(ev.evidence_type)} ${ui.sim()}</div></div>` : '<div class="note">Nenhum evento externo usado como evidência principal.</div>'}
          ${related.length ? `<div class="small muted" style="margin-top:8px">Outros eventos na área: ${related.map((e) => link('event', e.event_id, e.title)).join(' · ')}</div>` : ''}
          <div class="section-title">Índice de evidência</div>${scoreHTML(o)}
        </div>
      </div>
      <div class="section-title">Conveniados envolvidos (${parts.length})</div>
      <table class="dt"><thead><tr><th>Código</th><th>Nome</th><th>Operadora</th><th>Tecnologia</th><th>Status</th><th>Falha</th></tr></thead><tbody>
      ${parts.map((p) => { const sg = o.signals.find((s) => s.code === p.partner_code); return `<tr><td>${link('partner', p.partner_code)}</td><td>${U.esc(p.partner_name)}</td><td>${p.telecom_operator}</td><td>${p.connectivity_type}</td><td>${ui.partnerStatus(p.operational_status)}</td><td class="nowrap">${sg ? U.hm(sg.t) : '—'}</td></tr>`; }).join('')}</tbody></table>
      ${o.incidents.length ? `<div class="section-title">Incidentes relacionados</div><div>${o.incidents.map((id) => link('incident', id)).join(' · ')}</div>` : ''}`;
  }

  function openOccurrence(id, push) {
    const o = S.occurrence(id); if (!o) return;
    ui.drawer.open({ kicker: 'Ocorrência correlacionada · ' + o.id, title: U.esc(o.title), badges: `${ui.ruleChip(o.rule)} ${ui.conf(o.confidence)} ${ui.sev(o.severity)}`, body: occurrenceBody(o), onMount: (el) => wire(el) }, push);
  }

  return { openPartner, openEvent, openIncident, openOccurrence, occurrenceBody, fhaHTML, scoreHTML, wire, link, kv };
})();
