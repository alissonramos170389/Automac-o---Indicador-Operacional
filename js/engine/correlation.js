/* ==========================================================================
   MOTOR DE CORRELAÇÃO — regras transparentes, sem IA e sem probabilidade.
   Entrada: conveniados, incidentes, Zabbix e eventos externos normalizados.
   Saída : ocorrências (com FATO / HIPÓTESE / AÇÃO), linhas CORRELATIONS,
           impacto por evento e diagnóstico por conveniado.

   Correlação não prova causalidade: as saídas são hipóteses para a operação
   validar, com o nível de confiança e as evidências usadas.
   ========================================================================== */
IOA.engine = (function () {
  const U = IOA.utils, R = IOA.ref;
  const MIN = 60000;

  const DEFAULT_CONFIG = {
    radius_km: 15,            // raio de agrupamento de falhas próximas
    window_min: 30,           // janela temporal entre falhas encadeadas
    min_partners: 3,          // mínimo de conveniados para ocorrência regional
    dominant_share: 0.7,      // fatia mínima de uma operadora para a Regra 1
    event_buffer_km: 8,       // tolerância somada ao raio do evento externo
    event_tolerance_min: 60,  // tolerância temporal em relação ao evento
    lookback_h: 24,           // horizonte de análise de falhas atuais
    repeat_days: 30,          // janela de recorrência (Regra 5)
    repeat_min: 3,            // ocorrências mínimas para recorrência
    rules: { R1: true, R2: true, R3: true, R4: true, R5: true, R6: true }
  };

  const RULES = {
    R1: { code: 'R1', name: 'Queda regional de operadora', desc: 'Vários conveniados da mesma operadora indisponíveis no mesmo raio e janela de tempo.' },
    R2: { code: 'R2', name: 'Interrupção de energia', desc: 'Conveniados próximos indisponíveis com interrupção de energia informada na mesma área e período.' },
    R3: { code: 'R3', name: 'Impacto climático', desc: 'Chuva forte, tempestade, vento ou alagamento observados/alertados perto de conveniados com incidentes.' },
    R4: { code: 'R4', name: 'Múltiplas operadoras', desc: 'Operadoras diferentes indisponíveis ao mesmo tempo na mesma área: investigar causa comum (energia, infraestrutura local, rota compartilhada).' },
    R5: { code: 'R5', name: 'Incidentes recorrentes', desc: 'Locais e regiões com incidentes repetidos da mesma categoria.' },
    R6: { code: 'R6', name: 'Sem evidência externa', desc: 'Vários conveniados offline sem evento externo identificado: incidente regional não explicado.' },
    ISO: { code: 'ISO', name: 'Problema individual', desc: 'Falha de um conveniado sem vizinhos afetados nem evento externo próximo.' }
  };

  const FAILURE_CATS = new Set(['conectividade', 'energia', 'hardware']);
  const confRank = (c) => (R.CONFIDENCE[c] ? R.CONFIDENCE[c].rank : 0);
  const reliability = (ev) => (ev && R.EVIDENCE[ev.evidence_type] ? R.EVIDENCE[ev.evidence_type].reliability : 0);

  /* ------------------------------------------------------------------ */
  function run(data, cfgIn) {
    const cfg = Object.assign({}, DEFAULT_CONFIG, cfgIn || {});
    cfg.rules = Object.assign({}, DEFAULT_CONFIG.rules, (cfgIn && cfgIn.rules) || {});
    const on = (r) => cfg.rules[r] !== false;
    const t0 = performance.now();
    const now = data.now;
    const pByCode = new Map(data.partners.map((p) => [p.partner_code, p]));
    const incByPartner = U.groupBy(data.incidents, (i) => i.partner_code);
    const zEvByPartner = U.groupBy(data.zabbixEvents || [], (z) => z.partner_code);
    const since = now - cfg.lookback_h * 3600000;

    /* 1. Sinais de falha por conveniado ------------------------------- */
    const signals = [];
    data.partners.forEach((p) => {
      const incs = (incByPartner.get(p.partner_code) || []).filter((i) => FAILURE_CATS.has(i.category) && Date.parse(i.start_time) >= since);
      const zev = (zEvByPartner.get(p.partner_code) || []).filter((z) => Date.parse(z.event_start) >= since);
      let t = null, kind = null, resolved = false;
      if (p.operational_status === 'offline' && p.offline_since) { t = Date.parse(p.offline_since); kind = 'offline'; }
      else if (p.operational_status === 'degradado' && zev.length) { t = Date.parse(zev[0].event_start); kind = 'degradado'; }
      else if (zev.length && zev[0].event_recovery) { t = Date.parse(zev[0].event_start); kind = 'offline'; resolved = true; }
      if (incs.length) {
        const ti = Math.min(...incs.map((i) => Date.parse(i.start_time)));
        if (t == null) { t = ti; kind = 'incidente'; resolved = incs.every((i) => i.status === 'resolvido'); }
      }
      if (t != null) signals.push({ p, t, kind, resolved, incidents: incs });
    });

    /* 2. Agrupamento espaço-temporal (grade + união) ------------------ */
    const cellDeg = cfg.radius_km / 111;
    const grid = new Map();
    const ck = (la, lo) => Math.floor(la / cellDeg) + ':' + Math.floor(lo / cellDeg);
    signals.forEach((s, i) => { const k = ck(s.p.latitude, s.p.longitude); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); });
    const parent = signals.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    signals.forEach((s, i) => {
      const cx = Math.floor(s.p.latitude / cellDeg), cy = Math.floor(s.p.longitude / cellDeg);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        (grid.get((cx + dx) + ':' + (cy + dy)) || []).forEach((j) => {
          if (j <= i) return;
          const o = signals[j];
          if (Math.abs(o.t - s.t) > cfg.window_min * MIN) return;
          if (U.haversineKm(s.p.latitude, s.p.longitude, o.p.latitude, o.p.longitude) > cfg.radius_km) return;
          parent[find(i)] = find(j);
        });
      }
    });
    const groups = [...U.groupBy(signals.map((s, i) => ({ s, root: find(i) })), (x) => x.root).values()].map((g) => g.map((x) => x.s));

    /* 3. Eventos externos candidatos (somente tempo real) ------------ */
    const rtEvents = data.events.filter((e) => e.realtime !== false);
    function eventMatches(ev, sigs) {
      const evStart = Date.parse(ev.start_time);
      const evEnd = ev.end_time ? Date.parse(ev.end_time) : now;
      const tol = cfg.event_tolerance_min * MIN;
      const inside = [];
      sigs.forEach((s) => {
        const dist = U.haversineKm(s.p.latitude, s.p.longitude, ev.latitude, ev.longitude);
        if (dist > ev.affected_radius + cfg.event_buffer_km) return;
        if (ev.evidence_type !== 'previsao' && (s.t < evStart - tol || s.t > evEnd + tol)) return;
        if (ev.category === 'telecom_movel' && (ev.operator !== s.p.telecom_operator || !R.isMobile(s.p.connectivity_type))) return;
        if (ev.category === 'telecom_fixa' && (ev.operator !== s.p.telecom_operator || R.isMobile(s.p.connectivity_type))) return;
        inside.push({ s, dist });
      });
      return inside;
    }

    /* 4. Classificação por grupo ------------------------------------- */
    const occurrences = [];
    let occSeq = 1;
    groups.forEach((sigs) => {
      const regional = sigs.length >= cfg.min_partners;
      const parts = sigs.map((s) => s.p);
      const ops = U.groupCount(parts, (p) => p.telecom_operator);
      const dominantShare = ops[0][1] / parts.length;
      const distinctOps = ops.length;
      const matches = rtEvents.map((ev) => ({ ev, inside: eventMatches(ev, sigs) })).filter((m) => m.inside.length);
      const best = (cat, filt) => matches.filter((m) => cat(m.ev) && (!filt || filt(m.ev))).sort((a, b) => reliability(b.ev) - reliability(a.ev) || b.inside.length - a.inside.length)[0];
      const energy = best((e) => e.category === 'energia');
      const telecom = best((e) => e.category.startsWith('telecom'));
      const weatherAll = matches.filter((m) => m.ev.category === 'clima');
      const weatherObs = weatherAll.filter((m) => m.ev.evidence_type !== 'previsao');
      const weatherStrong = weatherObs.filter((m) => R.SEVERITIES[m.ev.severity].rank >= 2);
      const forecasts = weatherAll.filter((m) => m.ev.evidence_type === 'previsao');

      let rule, classification, confidence, primary = null;
      const supporting = [];
      if (on('R2') && energy && reliability(energy.ev) >= 1) {
        rule = 'R2'; primary = energy.ev;
        confidence = energy.ev.evidence_type === 'oficial' ? 'confirmada' : energy.ev.evidence_type === 'alerta_distribuidora' ? 'alta' : 'media';
        if (!regional && confidence === 'confirmada') confidence = 'alta';
        classification = energy.ev.evidence_type === 'oficial' ? 'Interrupção de energia oficialmente informada' : 'Provável impacto de energia (alerta da distribuidora)';
        if (regional && distinctOps >= 2 && on('R4')) supporting.push('R4');
      } else if (on('R1') && regional && dominantShare >= cfg.dominant_share) {
        rule = 'R1';
        if (telecom && telecom.ev.evidence_type === 'confirmado_operadora') { primary = telecom.ev; confidence = 'confirmada'; classification = 'Queda regional confirmada'; }
        else if (telecom && telecom.ev.evidence_type === 'degradacao_reportada') { primary = telecom.ev; confidence = 'alta'; classification = 'Suspeita de degradação da operadora'; }
        else { confidence = 'media'; classification = 'Possível queda regional'; }
      } else if (on('R3') && weatherStrong.length) {
        rule = 'R3';
        const isObs = (e) => (e.evidence_type === 'observado' ? 1 : 0);
        weatherStrong.sort((a, b) => R.SEVERITIES[b.ev.severity].rank - R.SEVERITIES[a.ev.severity].rank || isObs(b.ev) - isObs(a.ev) || reliability(b.ev) - reliability(a.ev));
        primary = weatherStrong[0].ev;
        const hasObs = weatherStrong.some((m) => m.ev.evidence_type === 'observado');
        const hasAlert = weatherStrong.some((m) => m.ev.evidence_type === 'alerta_oficial');
        confidence = regional && hasObs && hasAlert ? 'alta' : 'media';
        if (!regional && R.SEVERITIES[primary.severity].rank < 3) confidence = 'baixa';
        classification = 'Possível impacto climático';
        if (regional && distinctOps >= 2 && on('R4')) supporting.push('R4');
      } else if (on('R6') && regional && distinctOps >= 2) {
        rule = 'R6'; confidence = 'nao_verificada'; classification = 'Incidente regional não explicado';
        if (on('R4')) supporting.push('R4');
      } else if (regional) {
        rule = 'R1'; confidence = 'baixa'; classification = 'Evidência insuficiente';
      } else if (telecom) {
        rule = 'R1'; primary = telecom.ev; confidence = 'baixa'; classification = 'Problema individual com evento da operadora próximo';
      } else {
        rule = 'ISO'; confidence = null;
        const conn = sigs.some((s) => s.incidents.some((i) => i.category === 'conectividade')) || R.isMobile(parts[0].connectivity_type);
        classification = conn ? 'Problema individual de conectividade' : 'Problema isolado de equipamento';
      }
      // Evidências fracas de clima (chuva fraca, previsões) entram só como contexto
      const weatherContext = weatherObs.filter((m) => m.ev !== primary);
      if (on('R3') && weatherContext.length && rule !== 'R3') supporting.push('R3');

      // Índice de evidência (0–100) — NÃO é probabilidade
      const centroid = { lat: U.avg(parts, (p) => p.latitude), lon: U.avg(parts, (p) => p.longitude) };
      const times = sigs.map((s) => s.t);
      const first = Math.min(...times), last = Math.max(...times);
      const spreadMin = (last - first) / MIN;
      const meanDist = U.avg(parts, (p) => U.haversineKm(p.latitude, p.longitude, centroid.lat, centroid.lon));
      const primMatch = primary ? matches.find((m) => m.ev === primary) : null;
      const score = {
        geo: Math.round(primMatch ? 25 * (primMatch.inside.length / parts.length) : regional ? Math.max(5, 25 * (1 - meanDist / cfg.radius_km)) : 0),
        temporal: Math.round(primary ? Math.max(5, 25 * (1 - Math.min(1, Math.abs(first - Date.parse(primary.start_time)) / (cfg.event_tolerance_min * MIN)))) : regional ? Math.max(5, 25 * (1 - Math.min(1, spreadMin / (cfg.window_min * 3)))) : 0),
        source: primary ? [0, 10, 20, 30][reliability(primary)] : 0,
        volume: Math.min(10, parts.length),
        homogeneity: rule === 'R1' ? Math.round(dominantShare * 10) : (rule === 'R2' || rule === 'R6' || supporting.includes('R4')) ? Math.min(10, distinctOps * 3) : 0
      };
      score.total = score.geo + score.temporal + score.source + score.volume + score.homogeneity;

      const incidents = sigs.flatMap((s) => s.incidents);
      const offlineNow = parts.filter((p) => p.operational_status === 'offline').length;
      const active = sigs.some((s) => !s.resolved) || (primary && primary.event_status !== 'resolvido' && sigs.some((s) => s.kind !== 'incidente' && !s.resolved));
      const severity = parts.length >= 10 || (confidence === 'confirmada' && parts.length >= 5) ? 'critica' : parts.length >= 5 ? 'alta' : parts.length >= cfg.min_partners ? 'media' : 'baixa';
      const cityMain = U.groupCount(parts, (p) => p.city)[0][0];
      const occ = {
        id: 'OC-' + String(occSeq++).padStart(4, '0'),
        rule, supporting: U.uniq(supporting), regional, classification, confidence, severity,
        status: active ? 'ativo' : 'resolvido',
        partners: parts.map((p) => p.partner_code), signals: sigs.map((s) => ({ code: s.p.partner_code, t: s.t, kind: s.kind, resolved: s.resolved })),
        incidents: incidents.map((i) => i.incident_id), offline_now: offlineNow,
        state: parts[0].state, city: cityMain, centroid, first_seen: new Date(first).toISOString(), last_seen: new Date(last).toISOString(), spread_min: Math.round(spreadMin),
        operators: ops, dominant_operator: ops[0][0], dominant_share: dominantShare, distinct_operators: distinctOps,
        primary_event: primary ? primary.event_id : null, related_events: matches.map((m) => m.ev.event_id),
        forecasts: forecasts.map((m) => m.ev.event_id), weather_context: weatherContext.map((m) => m.ev.event_id),
        score, recurrent: false
      };
      occ.title = buildTitle(occ, primary);
      occ.fha = buildFHA(occ, parts, sigs, primary, weatherContext.map((m) => m.ev), forecasts.map((m) => m.ev), cfg);
      occurrences.push(occ);
    });

    /* 5. Recorrência (Regra 5) ---------------------------------------- */
    const recSince = now - cfg.repeat_days * 86400000;
    const recurrences = [];
    incByPartner.forEach((list, code) => {
      const recent = list.filter((i) => Date.parse(i.start_time) >= recSince);
      U.groupCount(recent, (i) => i.category).forEach(([cat, n]) => {
        if (n >= cfg.repeat_min) recurrences.push({ partner_code: code, category: cat, count: n, city: pByCode.get(code).city, state: pByCode.get(code).state });
      });
    });
    const recByCityCat = U.groupBy(recurrences, (x) => x.state + '|' + x.city + '|' + x.category);
    if (on('R5')) recByCityCat.forEach((list) => {
      const parts = list.map((x) => pByCode.get(x.partner_code));
      const total = U.sum(list, (x) => x.count);
      const incIds = list.flatMap((x) => (incByPartner.get(x.partner_code) || []).filter((i) => i.category === x.category && Date.parse(i.start_time) >= recSince).map((i) => i.incident_id));
      const occ = {
        id: 'OC-' + String(occSeq++).padStart(4, '0'), rule: 'R5', supporting: [], regional: parts.length >= 2,
        classification: parts.length >= 2 ? 'Recorrência regional' : 'Recorrência no conveniado', confidence: parts.length >= 2 ? 'media' : 'baixa',
        severity: total >= 12 ? 'alta' : 'media', status: parts.some((p) => p.operational_status !== 'online') ? 'ativo' : 'monitorando',
        partners: parts.map((p) => p.partner_code), signals: [], incidents: incIds, offline_now: parts.filter((p) => p.operational_status === 'offline').length,
        state: list[0].state, city: list[0].city, centroid: { lat: U.avg(parts, (p) => p.latitude), lon: U.avg(parts, (p) => p.longitude) },
        first_seen: new Date(recSince).toISOString(), last_seen: new Date(now).toISOString(), spread_min: null,
        operators: U.groupCount(parts, (p) => p.telecom_operator), dominant_operator: null, distinct_operators: 0,
        primary_event: null, related_events: [], forecasts: [], weather_context: [], recurrent: true,
        score: null, category: list[0].category, total_incidents: total
      };
      occ.title = (parts.length >= 2 ? 'Recorrência de ' : 'Recorrência de ') + R.INCIDENT_CATEGORIES[occ.category].toLowerCase() + ' — ' + occ.city + '/' + occ.state;
      occ.fha = {
        fato: [
          `${parts.length} conveniado(s) com ${total} incidentes de ${R.INCIDENT_CATEGORIES[occ.category].toLowerCase()} nos últimos ${cfg.repeat_days} dias.`,
          ...list.map((x) => `${x.partner_code} — ${pByCode.get(x.partner_code).partner_name}: ${x.count} incidentes.`),
          `Operadora(s): ${occ.operators.map((o) => o[0] + ' (' + o[1] + ')').join(', ')}.`
        ],
        hipotese: [parts.length >= 2 ? 'Fragilidade recorrente da infraestrutura local (cobertura, rede elétrica ou rota de rede) na região.' : 'Problema crônico no conveniado (equipamento, instalação ou cobertura do ponto).'],
        acao: ['Abrir problema (problem management) agrupando os incidentes recorrentes.', 'Avaliar troca de tecnologia/operadora ou link redundante.', 'Verificar instalação elétrica e aterramento no local.']
      };
      occurrences.push(occ);
      parts.forEach((p) => {
        occurrences.forEach((o) => {
          if (o.rule === 'R5' || o.recurrent || !o.partners.includes(p.partner_code)) return;
          o.recurrent = true;
          o.fha.fato.push(`${p.partner_code} tem incidentes recorrentes de ${R.INCIDENT_CATEGORIES[occ.category].toLowerCase()} nos últimos ${cfg.repeat_days} dias (${occ.id}).`);
          o.fha.acao.push('Conveniado com recorrência: avaliar ação estrutural (problem management).');
        });
      });
    });

    /* 6. Impacto por evento externo ------------------------------------ */
    const eventImpact = new Map();
    const sigByCode = new Map(signals.map((s) => [s.p.partner_code, s]));
    data.events.forEach((ev) => {
      const nearby = data.partners.filter((p) => U.haversineKm(p.latitude, p.longitude, ev.latitude, ev.longitude) <= ev.affected_radius + cfg.event_buffer_km);
      const affected = ev.realtime === false || ev.evidence_type === 'previsao' ? [] : eventMatches(ev, nearby.map((p) => sigByCode.get(p.partner_code)).filter(Boolean)).map((x) => x.s.p);
      const occs = occurrences.filter((o) => o.related_events.includes(ev.event_id)).map((o) => o.id);
      eventImpact.set(ev.event_id, {
        nearby: nearby.map((p) => p.partner_code),
        affected: affected.map((p) => p.partner_code),
        offline: affected.filter((p) => p.operational_status === 'offline').map((p) => p.partner_code),
        incidents: affected.flatMap((p) => (sigByCode.get(p.partner_code) || { incidents: [] }).incidents.map((i) => i.incident_id)),
        occurrences: occs
      });
    });

    /* 7. Linhas CORRELATIONS + diagnóstico por conveniado --------------- */
    const correlations = [];
    const partnerDiag = new Map();
    const evById = new Map(data.events.map((e) => [e.event_id, e]));
    let corrSeq = 1;
    occurrences.forEach((o) => {
      const ev = o.primary_event ? evById.get(o.primary_event) : null;
      o.partners.forEach((code) => {
        const p = pByCode.get(code);
        const sig = sigByCode.get(code);
        const inc = sig && sig.incidents[0];
        if (o.rule !== 'R5' || !partnerDiag.has(code)) {
          if (!partnerDiag.has(code) || partnerDiag.get(code).rule === 'R5') partnerDiag.set(code, { occurrence: o.id, rule: o.rule, classification: o.classification, confidence: o.confidence, regional: o.regional });
        }
        correlations.push({
          correlation_id: 'CR-' + String(corrSeq++).padStart(5, '0'),
          occurrence_id: o.id,
          external_event_id: ev ? ev.event_id : null,
          incident_id: inc ? inc.incident_id : null,
          partner_code: code,
          correlation_type: o.rule,
          geographical_distance: ev ? +U.haversineKm(p.latitude, p.longitude, ev.latitude, ev.longitude).toFixed(1) : +U.haversineKm(p.latitude, p.longitude, o.centroid.lat, o.centroid.lon).toFixed(1),
          temporal_difference: ev && sig ? Math.round((sig.t - Date.parse(ev.start_time)) / MIN) : null,
          confidence_level: o.confidence,
          evidence: o.fha.fato.slice(0, 3).join(' '),
          hypothesis: o.fha.hipotese[0],
          recommended_action: o.fha.acao[0]
        });
      });
    });

    return {
      config: cfg, ranAt: Date.now(), elapsedMs: Math.round(performance.now() - t0),
      signals: signals.length, occurrences, correlations, eventImpact, partnerDiag, recurrences
    };
  }

  /* ------------------------------------------------------------------ */
  function buildTitle(o, ev) {
    const where = o.city + '/' + o.state;
    switch (o.rule) {
      case 'R1': return (o.regional ? o.classification + ' ' + o.dominant_operator : o.classification) + ' — ' + where;
      case 'R2': return 'Interrupção de energia afetando ' + o.partners.length + ' conveniado(s) — ' + where;
      case 'R3': return 'Possível impacto climático (' + (R.WEATHER_SUB[ev.subcategory] || 'clima').toLowerCase() + ') — ' + where;
      case 'R6': return 'Incidente regional não explicado — ' + where;
      default: return o.classification + ' — ' + where;
    }
  }

  function buildFHA(o, parts, sigs, ev, wctx, fc, cfg) {
    const fato = [], hip = [], acao = [];
    const n = parts.length;
    const offline = parts.filter((p) => p.operational_status === 'offline').length;
    const opsTxt = o.operators.map((x) => x[0] + ' (' + x[1] + ')').join(', ');
    const nInc = sigs.reduce((s, x) => s + x.incidents.length, 0);
    if (o.regional) {
      fato.push(`${n} conveniados com falha num raio de ${cfg.radius_km} km${offline ? `, ${offline} offline agora` : ''}.`);
      fato.push(`Falhas concentradas em ${o.spread_min} min (${U.hm(o.first_seen)} a ${U.hm(o.last_seen)}).`);
      fato.push(o.distinct_operators === 1 ? `Todos usam a mesma operadora: ${o.dominant_operator}.` : `Operadoras envolvidas: ${opsTxt}.`);
    } else {
      const p = parts[0];
      fato.push(`${p.partner_code} — ${p.partner_name} com ${sigs[0].kind === 'offline' ? 'perda de comunicação' : sigs[0].kind === 'degradado' ? 'degradação de rede' : 'incidente aberto'} desde ${U.hm(sigs[0].t)}.`);
      fato.push(`Operadora ${p.telecom_operator} (${p.connectivity_type}). Nenhum outro conveniado próximo com falha na mesma janela.`);
    }
    if (nInc) fato.push(`${nInc} incidente(s) ServiceNow relacionados.`);
    if (ev) fato.push(`Evento externo: "${ev.title}" — ${R.EVIDENCE[ev.evidence_type].label.toLowerCase()} (${ev.provider}, dados simulados).`);
    else if (o.regional) fato.push('Nenhum evento externo (telecom, energia ou clima) identificado na área e no período.');
    wctx.forEach((w) => fato.push(`Contexto climático: ${w.title} (${R.EVIDENCE[w.evidence_type].label.toLowerCase()}, severidade ${R.SEVERITIES[w.severity].label.toLowerCase()}).`));
    fc.forEach((w) => fato.push(`Há previsão (não observada) de ${R.WEATHER_SUB[w.subcategory].toLowerCase()} para a área — não usada como evidência.`));

    switch (o.rule) {
      case 'R1':
        if (o.classification === 'Queda regional confirmada') hip.push(`Queda regional na rede da ${o.dominant_operator}, confirmada pela operadora.`);
        else if (o.classification === 'Suspeita de degradação da operadora') hip.push(`Possível degradação regional da rede ${o.dominant_operator}, reportada por fonte externa e coerente com as falhas.`);
        else if (o.regional) hip.push(`Possível queda regional da ${o.dominant_operator}. Sem confirmação externa: pode também ser causa local comum.`);
        else hip.push('Falha individual; o evento da operadora próximo pode ou não ter relação.');
        acao.push(`Acionar a ${o.dominant_operator} com a lista de conveniados e horários.`, 'Agrupar os incidentes numa ocorrência regional (evitar atendimento individual em campo).', 'Monitorar a recuperação dos conveniados pelo Zabbix.');
        if (!ev) acao.push('Confirmar com o canal da operadora antes de classificar como queda confirmada.');
        break;
      case 'R2':
        hip.push(`Indisponibilidade provavelmente relacionada à interrupção de energia${ev.distributor ? ' da ' + ev.distributor : ''}${o.supporting.includes('R4') ? '; operadoras diferentes caindo juntas reforça causa comum' : ''}.`);
        acao.push(`Acompanhar a previsão de restabelecimento${ev.estimated_end ? ' (' + U.hm(ev.estimated_end) + ')' : ''} junto à distribuidora.`, 'Não despachar técnico para troca de equipamento antes do restabelecimento.', 'Após o retorno, validar se todos os conveniados voltaram; tratar como individual quem não voltar.');
        break;
      case 'R3':
        hip.push(`Possível impacto de ${R.WEATHER_SUB[ev.subcategory].toLowerCase()} na infraestrutura local (energia, antenas ou cabeamento). Correlação geográfica e temporal, não comprovação.`);
        acao.push('Verificar com os conveniados se houve queda de energia ou dano físico.', 'Checar alertas das distribuidoras e operadoras na mesma área.', 'Priorizar atendimento após o fim do evento climático e com segurança da equipe.');
        break;
      case 'R6':
        hip.push('Causa comum não identificada: possível falha de energia local não informada, infraestrutura compartilhada ou rota de rede.');
        acao.push('Investigar como incidente regional: contatar os conveniados para confirmar energia no local.', 'Consultar distribuidora e operadoras da região.', 'Verificar rota/VPN e o autorizador central para descartar causa interna.');
        break;
      default:
        hip.push(o.classification === 'Problema isolado de equipamento' ? 'Falha local de equipamento (NUC, fonte, automação).' : 'Falha local de conectividade (chip, roteador, link ou cobertura no ponto).');
        acao.push('Tratar como incidente individual: diagnóstico remoto e, se necessário, visita técnica.', 'Verificar reinício do roteador/NUC e sinal da operadora no local.');
    }
    return { fato, hipotese: hip, acao };
  }

  return { DEFAULT_CONFIG, RULES, run };
})();
