/* ==========================================================================
   SIMULADOR DE DADOS — V0
   Gera, de forma determinística (semente fixa), um conjunto realista de
   conveniados, CMDB, Zabbix, incidentes ServiceNow, eventos externos e
   histórico. TODOS OS DADOS SÃO SIMULADOS.

   Os horários são relativos ao momento da carga, para que os cenários
   pareçam "ao vivo". Os adapters (js/integrations) são a única porta de
   entrada desses dados nas telas: trocar o simulador por APIs reais não
   exige mudar as telas.
   ========================================================================== */
IOA.simulator = (function () {
  const U = IOA.utils, R = IOA.ref;
  const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;

  const NAME_A = ['Auto Posto', 'Posto', 'Centro Automotivo', 'Auto Posto', 'Posto', 'Rede', 'Estacionamento', 'Park'];
  const NAME_B = ['São Jorge', 'Avenida', 'Bandeirantes', 'Primavera', 'Rodovia', 'Central', 'Boa Vista', 'Santa Luzia', 'Nova Era', 'Triângulo', 'Estrela', 'Aliança', 'Portal', 'Ipê', 'Jardim', 'Imperial', 'Horizonte', 'Litoral', 'Serrano', 'Cruzeiro', 'Planalto', 'Atlântico', 'Pioneiro', 'Real', 'Vitória', 'Paineiras', 'Monte Verde', 'Bela Vista', 'Sol Nascente', 'Floresta'];
  const NAME_C = ['', '', '', ' II', ' Express', ' Centro', ' Norte', ' Sul', ' Leste', ' Oeste', ' 24h'];

  function generate(nowMs) {
    const now = Math.floor(nowMs / MIN) * MIN;
    const r = U.rng(20261124);
    const iso = (ms) => new Date(ms).toISOString();

    /* ------------------------------------------------------------------
       1. Conveniados (Base OPC) + CMDB + Zabbix
       ------------------------------------------------------------------ */
    const partners = [];
    const usedCodes = new Set();
    const cityByName = new Map(R.CITIES.map((c) => [c[1], c]));

    function newCode() {
      let c;
      do { c = String(r.int(1200, 98999)).padStart(5, '0'); } while (usedCodes.has(c));
      usedCodes.add(c); return c;
    }

    function chooseTech(uf) {
      const north = ['AM', 'AC', 'RR', 'RO', 'AP', 'PA', 'TO'].includes(uf);
      return r.weighted([
        ['4G', 44], ['3G', north ? 12 : 5], ['2G', north ? 4 : 1], ['5G', north ? 1 : 6],
        ['Fibra', north ? 12 : 26], ['ADSL', 7], ['Rádio', north ? 10 : 4], ['Outro fixo', 4]
      ]);
    }
    function chooseOperator(uf, city, tech) {
      const algarZone = ['Uberlândia'].includes(city);
      if (R.isMobile(tech)) {
        return r.weighted([['Vivo', 34], ['Claro', 30], ['TIM', 28], ['Algar', algarZone ? 30 : 1], ['Oi', 2]]);
      }
      if (tech === 'Rádio') return r.weighted([['Provedor regional', 80], ['Outros', 20]]);
      return r.weighted([['Vivo', 26], ['Claro', 20], ['Oi', 18], ['Algar', algarZone ? 30 : 2], ['Provedor regional', 26], ['Outros', 8]]);
    }

    function makePartner(cityRow, overrides) {
      const [uf, city, lat, lon, weight, distributor, cepBase] = cityRow;
      const spread = Math.min(0.03 + weight * 0.004, 0.16);
      const tech = (overrides && overrides.connectivity_type) || chooseTech(uf);
      const op = (overrides && overrides.telecom_operator) || chooseOperator(uf, city, tech);
      const code = newCode();
      const p = Object.assign({
        partner_id: 'P' + code,
        partner_code: code,
        partner_name: r.pick(NAME_A) + ' ' + r.pick(NAME_B) + r.pick(NAME_C),
        state: uf,
        city: city,
        postal_code: cepBase + '-' + String(r.int(0, 999)).padStart(3, '0'),
        latitude: +r.jitter(lat, spread).toFixed(5),
        longitude: +r.jitter(lon, spread).toFixed(5),
        telecom_operator: op,
        connectivity_type: tech,
        distributor: distributor,
        operational_status: 'online',
        service_type: r.weighted([['Posto', 82], ['Estacionamento', 9], ['Pedágio', 5], ['Drive thru', 4]]),
        opc_status: r.weighted([['Ativo', 96], ['Suspenso', 4]]),
        last_communication: iso(now - r.int(0, 4) * MIN - r.int(0, 59) * 1000),
        offline_since: null,
        availability_24h: +(0.985 + r() * 0.015).toFixed(4)
      }, overrides || {});
      partners.push(p);
      return p;
    }

    // um por cidade (garante as 27 UFs) + distribuição ponderada
    R.CITIES.forEach((c) => makePartner(c));
    const weighted = R.CITIES.map((c) => [c, c[4]]);
    while (partners.length < 380) makePartner(r.weighted(weighted));

    const inCity = (city) => partners.filter((p) => p.city === city);
    function ensureInCity(city, n, overrides) {
      const list = inCity(city);
      while (list.length < n) list.push(makePartner(cityByName.get(city), overrides && overrides()));
      return list;
    }

    /* ------------------------------------------------------------------
       2. Incidentes internos (ServiceNow) e eventos Zabbix
       ------------------------------------------------------------------ */
    const incidents = [];
    const zabbixEvents = [];
    let incSeq = 4810231;

    function setOffline(p, sinceMs) {
      p.operational_status = 'offline';
      p.offline_since = iso(sinceMs);
      p.last_communication = iso(sinceMs - r.int(1, 3) * MIN);
      zabbixEvents.push({
        partner_code: p.partner_code, host: p.partner_code + '1', monitoring_status: 'PROBLEM',
        trigger: 'Sem comunicação com o host (ICMP) — ' + p.partner_code + '1',
        event_start: iso(sinceMs), event_recovery: null
      });
    }
    function setDegraded(p, sinceMs) {
      p.operational_status = 'degradado';
      zabbixEvents.push({
        partner_code: p.partner_code, host: p.partner_code + '1', monitoring_status: 'PROBLEM',
        trigger: 'Perda de pacotes > 20% na VPN', event_start: iso(sinceMs), event_recovery: null
      });
    }

    const DESC = {
      conectividade: ['Conveniado sem comunicação com o autorizador', 'NUC sem resposta ao ICMP', 'Roteador sem sinal de dados', 'Link fixo inoperante', 'Transações em contingência por falta de rede'],
      energia: ['Equipamentos desligados no conveniado', 'NUC desligada sem shutdown', 'Posto informa queda de energia', 'Nobreak descarregado'],
      hardware: ['Antena RFID sem leitura', 'Câmera OCR sem imagem', 'Concentrador sem resposta', 'Fonte da NUC danificada'],
      automacao: ['Bomba sem integração com o concentrador', 'Bico sem leitura de encerrante', 'Falha de comunicação com a automação'],
      aplicacao: ['Serviço Abastece parado', 'Erro de sincronização DS', 'Versão divergente do Abastece', 'Fila de transações acumulada']
    };

    function addIncident(p, o) {
      const start = o.start;
      const end = o.end || null;
      const status = o.status || (end ? 'resolvido' : 'aberto');
      const cat = o.category || 'conectividade';
      const inc = {
        incident_id: 'INC' + (incSeq++),
        partner_code: p.partner_code,
        source: o.source || 'ServiceNow',
        category: cat,
        description: o.description || r.pick(DESC[cat]),
        start_time: iso(start),
        end_time: end ? iso(end) : null,
        status: status,
        severity: o.severity || (o.sn_class === 'Problema Geral' ? 'alta' : o.sn_class === 'Parcial' ? 'media' : 'baixa'),
        sn_class: o.sn_class || 'Problema Geral',
        integration_id: 'WMO' + String(r.int(1000000, 9999999)),
        duration_min: Math.round(((end || now) - start) / MIN)
      };
      incidents.push(inc);
      return inc;
    }

    /* ------------------------------------------------------------------
       3. Eventos externos (todos simulados) — vêm "dos adapters"
       ------------------------------------------------------------------ */
    const events = [];
    let evSeq = 1;
    function addEvent(o) {
      const c = cityByName.get(o.city);
      const ev = Object.assign({
        event_id: 'EXT-' + String(evSeq++).padStart(4, '0'),
        provider: o.provider,
        adapter_id: o.adapter_id,
        category: o.category,
        subcategory: o.subcategory || null,
        state: c[0], city: c[1],
        latitude: +(c[2] + (o.dLat || 0)).toFixed(4),
        longitude: +(c[3] + (o.dLon || 0)).toFixed(4),
        affected_radius: o.radius,
        start_time: iso(o.start),
        end_time: o.end ? iso(o.end) : null,
        estimated_end: o.estimated_end ? iso(o.estimated_end) : null,
        severity: o.severity,
        event_status: o.status || 'ativo',
        source_timestamp: iso(o.source_ts || o.start + 4 * MIN),
        last_updated: iso(o.updated || Math.min(now, (o.end || now)) - r.int(1, 9) * MIN),
        evidence_type: o.evidence,
        realtime: o.realtime !== false,
        simulated: true
      }, o.extra || {});
      ev.title = o.title;
      events.push(ev);
      return ev;
    }

    /* ---------------- Cenário 1: mesma operadora, mesma região (Campinas / Vivo 4G) ---------------- */
    const camp = ensureInCity('Campinas', 18);
    camp.slice(0, 14).forEach((p) => { p.telecom_operator = 'Vivo'; p.connectivity_type = r.pick(['4G', '4G', '4G', '3G']); });
    camp.slice(14).forEach((p) => { p.telecom_operator = r.pick(['Claro', 'TIM']); p.connectivity_type = r.pick(['4G', 'Fibra']); });
    const c1Start = now - 48 * MIN;
    camp.slice(0, 12).forEach((p, i) => {
      const t = c1Start + Math.round(i * 0.8) * MIN;
      setOffline(p, t);
      if (i < 9) addIncident(p, { category: 'conectividade', sn_class: 'Problema Geral', start: t + r.int(8, 22) * MIN, status: i < 3 ? 'em_atendimento' : 'aberto', description: 'Conveniado sem comunicação com o autorizador' });
    });
    addEvent({
      title: 'Degradação de dados móveis Vivo — Região de Campinas', provider: 'Portal/API da operadora (planejado)', adapter_id: 'telecom_operadoras',
      category: 'telecom_movel', subcategory: '4G', city: 'Campinas', dLat: 0.01, dLon: -0.02, radius: 18, start: now - 45 * MIN,
      severity: 'alta', evidence: 'degradacao_reportada', extra: { operator: 'Vivo', technology: '4G', estimated_area: 'Campinas, Hortolândia, Sumaré e Valinhos (estimado)', evidence_note: 'Status page da operadora indica instabilidade de dados móveis na região (simulado).' }
    });

    /* ---------------- Cenário 1b: operadora única sem fonte externa (Recife / TIM) ---------------- */
    const rec = ensureInCity('Recife', 10);
    const recT = rec.slice(0, 5);
    recT.forEach((p) => { p.telecom_operator = 'TIM'; p.connectivity_type = '4G'; });
    recT.slice(0, 4).forEach((p, i) => {
      const t = now - 70 * MIN + i * 4 * MIN;
      setOffline(p, t);
      if (i < 3) addIncident(p, { category: 'conectividade', sn_class: 'Problema Geral', start: t + 15 * MIN });
    });
    addEvent({
      title: 'Chuva moderada observada — Recife', provider: 'INMET (planejado)', adapter_id: 'clima_inmet', category: 'clima', subcategory: 'chuva',
      city: 'Recife', dLat: 0.05, dLon: -0.04, radius: 12, start: now - 2 * HOUR, estimated_end: now + 1 * HOUR, severity: 'baixa', evidence: 'observado',
      extra: { precipitation_mm_h: 4.2, accumulated_mm: 11.6, wind_kmh: 18, gust_kmh: 31, observation_type: 'observado' }
    });

    /* ---------------- Cenário 1c: interrupção de fibra confirmada (Rio de Janeiro / Oi) ---------------- */
    const rio = ensureInCity('Rio de Janeiro', 20);
    const rioF = rio.slice(0, 6);
    rioF.forEach((p) => { p.telecom_operator = 'Oi'; p.connectivity_type = r.pick(['Fibra', 'Fibra', 'ADSL']); p.latitude = +r.jitter(-22.885, 0.03).toFixed(5); p.longitude = +r.jitter(-43.29, 0.03).toFixed(5); });
    rioF.slice(0, 5).forEach((p, i) => {
      const t = now - 2 * HOUR - 10 * MIN + i * 2 * MIN;
      setOffline(p, t);
      addIncident(p, { category: 'conectividade', sn_class: 'Problema Geral', start: t + 12 * MIN, status: 'em_atendimento', description: 'Link fixo inoperante' });
    });
    addEvent({
      title: 'Rompimento de cabo óptico Oi — Zona Norte do Rio', provider: 'Portal/API da operadora (planejado)', adapter_id: 'telecom_operadoras',
      category: 'telecom_fixa', subcategory: 'Fibra', city: 'Rio de Janeiro', dLat: 0.022, dLon: -0.117, radius: 7, start: now - 2 * HOUR - 15 * MIN,
      estimated_end: now + 3 * HOUR, severity: 'critica', evidence: 'confirmado_operadora',
      extra: { operator: 'Oi', technology: 'Fibra', estimated_area: 'Méier, Engenho Novo, Cachambi (estimado)', evidence_note: 'Comunicado da operadora com protocolo de manutenção corretiva (simulado).' }
    });

    /* ---------------- Cenário 2: várias operadoras + queda de energia oficial (Contagem / Cemig) ---------------- */
    const cont = ensureInCity('Contagem', 12);
    const ops2 = ['Claro', 'Vivo', 'TIM', 'Oi', 'Provedor regional', 'Claro', 'Vivo', 'TIM', 'Vivo', 'Claro'];
    cont.slice(0, 10).forEach((p, i) => {
      p.telecom_operator = ops2[i];
      p.connectivity_type = ops2[i] === 'Oi' || ops2[i] === 'Provedor regional' ? 'Fibra' : '4G';
      p.latitude = +r.jitter(-19.935, 0.035).toFixed(5); p.longitude = +r.jitter(-44.06, 0.035).toFixed(5);
      const t = now - 95 * MIN + r.int(0, 6) * MIN;
      setOffline(p, t);
      if (i < 7) addIncident(p, { category: i % 2 ? 'energia' : 'conectividade', sn_class: 'Problema Geral', start: t + r.int(10, 25) * MIN, description: i % 2 ? 'Posto informa queda de energia' : 'Conveniado sem comunicação com o autorizador' });
    });
    addEvent({
      title: 'Interrupção de energia — Contagem (subestação)', provider: 'Portal da distribuidora Cemig (planejado)', adapter_id: 'energia_distribuidoras',
      category: 'energia', subcategory: 'Interrupção não programada', city: 'Contagem', dLat: -0.004, dLon: -0.006, radius: 9, start: now - 100 * MIN,
      estimated_end: now + 70 * MIN, severity: 'critica', evidence: 'oficial',
      extra: { distributor: 'Cemig', cause: 'Falha em equipamento de subestação (informado)', customers_affected_est: 41000, estimated_area: 'Região industrial de Contagem e Eldorado (estimado)' }
    });

    /* ---------------- Cenário 2b: alerta de distribuidora (São Paulo / Enel SP) ---------------- */
    const sp = ensureInCity('São Paulo', 40);
    const spL = sp.slice(0, 5);
    spL.forEach((p, i) => { p.latitude = +r.jitter(-23.545, 0.02).toFixed(5); p.longitude = +r.jitter(-46.47, 0.025).toFixed(5); p.telecom_operator = ['Claro', 'TIM', 'Vivo', 'Claro', 'Provedor regional'][i]; });
    spL.slice(0, 4).forEach((p, i) => {
      const t = now - 35 * MIN + i * 3 * MIN;
      setOffline(p, t);
      if (i < 2) addIncident(p, { category: 'energia', sn_class: 'Problema Geral', start: t + 14 * MIN });
    });
    addEvent({
      title: 'Alerta de oscilação na rede — Zona Leste de São Paulo', provider: 'Portal da distribuidora Enel SP (planejado)', adapter_id: 'energia_distribuidoras',
      category: 'energia', subcategory: 'Oscilação / desligamento', city: 'São Paulo', dLat: 0.005, dLon: 0.163, radius: 6, start: now - 40 * MIN,
      severity: 'alta', evidence: 'alerta_distribuidora',
      extra: { distributor: 'Enel SP', cause: 'Em apuração pela distribuidora', estimated_area: 'Itaquera, Penha e Tatuapé (estimado)' }
    });

    /* ---------------- Cenário 3: tempestade perto de conveniados com incidentes (Porto Alegre) ---------------- */
    const poa = ensureInCity('Porto Alegre', 12);
    poa.slice(0, 8).forEach((p, i) => {
      const t = now - 150 * MIN + i * 9 * MIN;
      if (i < 3) setOffline(p, t); else if (i < 5) setDegraded(p, t);
      addIncident(p, {
        category: i < 3 ? 'conectividade' : i < 6 ? 'conectividade' : 'hardware',
        sn_class: i < 3 ? 'Problema Geral' : 'Parcial', start: t + 10 * MIN,
        status: i === 7 ? 'resolvido' : 'aberto', end: i === 7 ? now - 20 * MIN : null,
        description: i >= 6 ? 'Antena RFID sem leitura' : undefined
      });
    });
    addEvent({
      title: 'Tempestade com rajadas — Porto Alegre e região metropolitana', provider: 'INMET (planejado)', adapter_id: 'clima_inmet', category: 'clima', subcategory: 'tempestade',
      city: 'Porto Alegre', radius: 30, start: now - 3 * HOUR, estimated_end: now + 4 * HOUR, severity: 'alta', evidence: 'observado',
      extra: { precipitation_mm_h: 38.4, accumulated_mm: 92.1, wind_kmh: 46, gust_kmh: 78, observation_type: 'observado' }
    });
    addEvent({
      title: 'Alerta "Perigo" de tempestade — RS (metropolitana)', provider: 'INMET Alertas (planejado)', adapter_id: 'clima_inmet', category: 'clima', subcategory: 'alerta_extremo',
      city: 'Porto Alegre', dLat: 0.12, dLon: 0.05, radius: 60, start: now - 5 * HOUR, estimated_end: now + 10 * HOUR, severity: 'alta', evidence: 'alerta_oficial',
      extra: { observation_type: 'alerta_oficial', precipitation_mm_h: null, accumulated_mm: null, wind_kmh: null, gust_kmh: 90, alert_level: 'Perigo' }
    });
    addEvent({
      title: 'Descargas atmosféricas — Canoas', provider: 'Rede de detecção de raios (planejado)', adapter_id: 'clima_openmeteo', category: 'clima', subcategory: 'raios',
      city: 'Canoas', radius: 15, start: now - 2 * HOUR, estimated_end: now + 1 * HOUR, severity: 'media', evidence: 'observado',
      extra: { observation_type: 'observado', strikes_last_hour: 214, precipitation_mm_h: 22, accumulated_mm: 40, wind_kmh: 30, gust_kmh: 61 }
    });

    /* ---------------- Cenário 4: clima sem impacto operacional ---------------- */
    addEvent({
      title: 'Chuva forte observada — Manaus', provider: 'Open-Meteo (planejado)', adapter_id: 'clima_openmeteo', category: 'clima', subcategory: 'chuva_forte',
      city: 'Manaus', radius: 20, start: now - 80 * MIN, estimated_end: now + 2 * HOUR, severity: 'media', evidence: 'observado',
      extra: { observation_type: 'observado', precipitation_mm_h: 26.5, accumulated_mm: 48.3, wind_kmh: 21, gust_kmh: 44 }
    });
    addEvent({
      title: 'Previsão de temporais — Curitiba (amanhã à tarde)', provider: 'Open-Meteo (planejado)', adapter_id: 'clima_openmeteo', category: 'clima', subcategory: 'tempestade',
      city: 'Curitiba', radius: 35, start: now + 18 * HOUR, estimated_end: now + 24 * HOUR, severity: 'media', evidence: 'previsao', status: 'previsto',
      extra: { observation_type: 'previsao', precipitation_mm_h: 30, accumulated_mm: 55, wind_kmh: 35, gust_kmh: 70 }
    });
    addEvent({
      title: 'Vento forte observado — Florianópolis', provider: 'INMET (planejado)', adapter_id: 'clima_inmet', category: 'clima', subcategory: 'vento',
      city: 'Florianópolis', radius: 25, start: now - 4 * HOUR, estimated_end: now + 3 * HOUR, severity: 'media', evidence: 'observado',
      extra: { observation_type: 'observado', precipitation_mm_h: 1.2, accumulated_mm: 3.0, wind_kmh: 52, gust_kmh: 84 }
    });
    addEvent({
      title: 'Alerta de granizo — Oeste catarinense', provider: 'INMET Alertas (planejado)', adapter_id: 'clima_inmet', category: 'clima', subcategory: 'granizo',
      city: 'Chapecó', dLat: -0.32, dLon: 0.36, radius: 18, start: now - 1 * HOUR, estimated_end: now + 5 * HOUR, severity: 'alta', evidence: 'alerta_oficial',
      extra: { observation_type: 'alerta_oficial', precipitation_mm_h: null, accumulated_mm: null, wind_kmh: null, gust_kmh: 75, alert_level: 'Perigo potencial' }
    });

    /* ---------------- Cenário 5: offline sem evidência externa (Goiânia) ---------------- */
    const goi = ensureInCity('Goiânia', 10);
    const ops5 = ['Claro', 'TIM', 'Vivo', 'Provedor regional', 'Claro'];
    goi.slice(0, 5).forEach((p, i) => {
      p.telecom_operator = ops5[i]; p.connectivity_type = ops5[i] === 'Provedor regional' ? 'Fibra' : '4G';
      p.latitude = +r.jitter(-16.70, 0.03).toFixed(5); p.longitude = +r.jitter(-49.27, 0.03).toFixed(5);
      const t = now - 55 * MIN + r.int(0, 14) * MIN;
      setOffline(p, t);
      if (i < 3) addIncident(p, { category: 'conectividade', sn_class: 'Problema Geral', start: t + 18 * MIN });
    });

    /* ---------------- Cenário 6: evento externo ativo sem conveniado afetado ---------------- */
    addEvent({
      title: 'Interrupção de energia em área rural — Sinop', provider: 'Portal da distribuidora Energisa (planejado)', adapter_id: 'energia_distribuidoras',
      category: 'energia', subcategory: 'Interrupção não programada', city: 'Sinop', dLat: 0.28, dLon: -0.22, radius: 8, start: now - 3 * HOUR,
      estimated_end: now + 2 * HOUR, severity: 'media', evidence: 'oficial',
      extra: { distributor: 'Energisa MT', cause: 'Árvore sobre a rede (informado)', customers_affected_est: 2300, estimated_area: 'Zona rural a nordeste de Sinop (estimado)' }
    });
    addEvent({
      title: 'Instabilidade de dados móveis Claro — Boa Vista', provider: 'Portal/API da operadora (planejado)', adapter_id: 'telecom_operadoras',
      category: 'telecom_movel', subcategory: '4G', city: 'Boa Vista', radius: 12, start: now - 65 * MIN, severity: 'media', evidence: 'degradacao_reportada',
      extra: { operator: 'Claro', technology: '4G', estimated_area: 'Boa Vista (estimado)', evidence_note: 'Fonte colaborativa de medição de rede (simulado).' }
    });
    // garante que os conveniados de Boa Vista não usem Claro (evento sem impacto)
    inCity('Boa Vista').forEach((p) => { if (p.telecom_operator === 'Claro') p.telecom_operator = 'Vivo'; });

    /* ---------------- Cenário 7: evento já resolvido (Salvador / Coelba) ---------------- */
    const ssa = ensureInCity('Salvador', 10);
    ssa.slice(0, 4).forEach((p, i) => {
      p.latitude = +r.jitter(-12.93, 0.02).toFixed(5); p.longitude = +r.jitter(-38.45, 0.02).toFixed(5);
      p.telecom_operator = ['Claro', 'Vivo', 'TIM', 'Oi'][i];
      const t = now - 9 * HOUR + i * 4 * MIN;
      zabbixEvents.push({ partner_code: p.partner_code, host: p.partner_code + '1', monitoring_status: 'OK', trigger: 'Sem comunicação com o host (ICMP) — ' + p.partner_code + '1', event_start: iso(t), event_recovery: iso(now - 5 * HOUR + i * 3 * MIN) });
      p.availability_24h = +(0.80 + r() * 0.03).toFixed(4);
      p.last_offline_window = { start: iso(t), end: iso(now - 5 * HOUR + i * 3 * MIN) };
      addIncident(p, { category: 'energia', sn_class: 'Problema Geral', start: t + 15 * MIN, end: now - 5 * HOUR + 20 * MIN, status: 'resolvido', description: 'Equipamentos desligados no conveniado' });
    });
    addEvent({
      title: 'Interrupção de energia — Salvador (Pituaçu / Paralela)', provider: 'Portal da distribuidora Neoenergia Coelba (planejado)', adapter_id: 'energia_distribuidoras',
      category: 'energia', subcategory: 'Interrupção não programada', city: 'Salvador', dLat: 0.045, dLon: 0.05, radius: 6, start: now - 9 * HOUR - 5 * MIN,
      end: now - 5 * HOUR, estimated_end: now - 5 * HOUR - 30 * MIN, severity: 'alta', evidence: 'oficial', status: 'resolvido',
      extra: { distributor: 'Neoenergia Coelba', cause: 'Descarga atmosférica na rede de média tensão (informado)', customers_affected_est: 18500, estimated_area: 'Pituaçu, Paralela e Imbuí (estimado)' }
    });

    /* ---------------- Cenário 8: recorrência regional (Fortaleza) ---------------- */
    const for_ = ensureInCity('Fortaleza', 10);
    for_.slice(0, 3).forEach((p, i) => {
      p.telecom_operator = 'Claro'; p.connectivity_type = '3G';
      for (let k = 0; k < 4 + i; k++) {
        const st = now - r.int(2, 28) * DAY - r.int(0, 20) * HOUR;
        addIncident(p, { category: 'conectividade', sn_class: r.pick(['Problema Geral', 'Parcial']), start: st, end: st + r.int(40, 300) * MIN, status: 'resolvido', description: 'Roteador sem sinal de dados' });
      }
    });
    setOffline(for_[0], now - 25 * MIN);
    addIncident(for_[0], { category: 'conectividade', sn_class: 'Problema Geral', start: now - 12 * MIN, description: 'Roteador sem sinal de dados' });

    /* ---------------- Cenário 9: alagamento (Belém) ---------------- */
    const bel = ensureInCity('Belém', 5);
    setOffline(bel[0], now - 110 * MIN);
    addIncident(bel[0], { category: 'energia', sn_class: 'Problema Geral', start: now - 95 * MIN, description: 'Equipamentos desligados no conveniado' });
    addIncident(bel[1], { category: 'automacao', sn_class: 'Parcial', start: now - 80 * MIN, description: 'Bomba sem integração com o concentrador' });
    addEvent({
      title: 'Alerta de alagamento — Belém', provider: 'CEMADEN (planejado)', adapter_id: 'clima_cemaden', category: 'clima', subcategory: 'alagamento',
      city: 'Belém', radius: 14, start: now - 2 * HOUR - 20 * MIN, estimated_end: now + 3 * HOUR, severity: 'alta', evidence: 'alerta_oficial',
      extra: { observation_type: 'alerta_oficial', precipitation_mm_h: null, accumulated_mm: 71.0, wind_kmh: null, gust_kmh: null, alert_level: 'Alto' }
    });

    /* ---------------- Cenário 10: raios com 1 conveniado afetado (Brasília) ---------------- */
    const bsb = ensureInCity('Brasília', 6);
    addIncident(bsb[0], { category: 'hardware', sn_class: 'Parcial', start: now - 50 * MIN, description: 'Fonte da NUC danificada' });
    setDegraded(bsb[0], now - 58 * MIN);
    addEvent({
      title: 'Descargas atmosféricas — Plano Piloto', provider: 'Rede de detecção de raios (planejado)', adapter_id: 'clima_openmeteo', category: 'clima', subcategory: 'raios',
      city: 'Brasília', radius: 16, start: now - 75 * MIN, estimated_end: now + 45 * MIN, severity: 'media', evidence: 'observado',
      extra: { observation_type: 'observado', strikes_last_hour: 96, precipitation_mm_h: 14, accumulated_mm: 19, wind_kmh: 25, gust_kmh: 52 }
    });

    /* ---------------- Outros eventos (energia não confirmada, históricos, resolvidos) ---------------- */
    addEvent({
      title: 'Relato de falta de energia — São Luís (não confirmado)', provider: 'Relato de campo / redes sociais (planejado)', adapter_id: 'energia_distribuidoras',
      category: 'energia', subcategory: 'Relato', city: 'São Luís', dLat: 0.02, dLon: 0.03, radius: 5, start: now - 30 * MIN, severity: 'baixa', evidence: 'nao_confirmado',
      extra: { distributor: 'Equatorial Maranhão', cause: 'Não informado', estimated_area: 'Centro (relato)' }
    });
    addEvent({
      title: 'Interrupção de energia — Juiz de Fora (encerrada)', provider: 'Portal da distribuidora Cemig (planejado)', adapter_id: 'energia_distribuidoras',
      category: 'energia', subcategory: 'Interrupção programada', city: 'Juiz de Fora', radius: 5, start: now - 30 * HOUR, end: now - 26 * HOUR,
      estimated_end: now - 26 * HOUR, severity: 'media', evidence: 'oficial', status: 'resolvido',
      extra: { distributor: 'Cemig', cause: 'Manutenção programada (informado)', customers_affected_est: 5200, estimated_area: 'Bairro Benfica (estimado)' }
    });
    addEvent({
      title: 'Degradação de fibra Algar — Uberlândia (normalizada)', provider: 'Portal/API da operadora (planejado)', adapter_id: 'telecom_operadoras',
      category: 'telecom_fixa', subcategory: 'Fibra', city: 'Uberlândia', radius: 10, start: now - 40 * HOUR, end: now - 37 * HOUR, severity: 'media',
      evidence: 'confirmado_operadora', status: 'resolvido', extra: { operator: 'Algar', technology: 'Fibra', estimated_area: 'Uberlândia (estimado)', evidence_note: 'Normalizado pela operadora.' }
    });
    addEvent({
      title: 'Vento forte — Caxias do Sul (monitoramento)', provider: 'Open-Meteo (planejado)', adapter_id: 'clima_openmeteo', category: 'clima', subcategory: 'vento',
      city: 'Caxias do Sul', radius: 20, start: now - 6 * HOUR, estimated_end: now + 1 * HOUR, severity: 'baixa', evidence: 'observado', status: 'monitorando',
      extra: { observation_type: 'observado', precipitation_mm_h: 0.4, accumulated_mm: 1.1, wind_kmh: 38, gust_kmh: 63 }
    });
    addEvent({
      title: 'Registro histórico ANEEL — interrupções em Teresina (mês anterior)', provider: 'ANEEL Dados Abertos (planejado)', adapter_id: 'energia_aneel',
      category: 'energia', subcategory: 'Indicador mensal (DEC/FEC)', city: 'Teresina', radius: 15, start: now - 40 * DAY, end: now - 10 * DAY, severity: 'baixa',
      evidence: 'historico', status: 'resolvido', realtime: false, extra: { distributor: 'Equatorial Piauí', cause: 'Consolidado mensal — não é notificação em tempo real', estimated_area: 'Município' }
    });
    addEvent({
      title: 'Registro histórico ANEEL — interrupções em Natal (mês anterior)', provider: 'ANEEL Dados Abertos (planejado)', adapter_id: 'energia_aneel',
      category: 'energia', subcategory: 'Indicador mensal (DEC/FEC)', city: 'Natal', radius: 15, start: now - 40 * DAY, end: now - 10 * DAY, severity: 'baixa',
      evidence: 'historico', status: 'resolvido', realtime: false, extra: { distributor: 'Neoenergia Cosern', cause: 'Consolidado mensal — não é notificação em tempo real', estimated_area: 'Município' }
    });

    /* ---------------- Problemas individuais (isolados) e incidentes de fundo ---------------- */
    const busy = new Set(partners.filter((p) => p.operational_status !== 'online').map((p) => p.partner_code));
    const evCities = new Set(events.map((e) => e.city));
    const calm = partners.filter((p) => !busy.has(p.partner_code) && !evCities.has(p.city));
    for (let i = 0; i < 9; i++) {
      const p = calm.splice(r.int(0, calm.length - 1), 1)[0];
      const t = now - r.int(20, 600) * MIN;
      setOffline(p, t);
      addIncident(p, { category: r.pick(['conectividade', 'conectividade', 'energia', 'hardware']), sn_class: 'Problema Geral', start: t + r.int(10, 40) * MIN });
    }
    for (let i = 0; i < 46; i++) {
      const p = r.pick(partners);
      const st = now - r.int(30, 7 * 24 * 60) * MIN;
      const resolved = r() < 0.78;
      const cat = r.weighted([['aplicacao', 30], ['automacao', 25], ['hardware', 20], ['conectividade', 18], ['energia', 7]]);
      addIncident(p, { category: cat, sn_class: r.weighted([['Problema Geral', 15], ['Parcial', 45], ['Outros', 40]]), start: st, end: resolved ? st + r.int(25, 900) * MIN : null, status: resolved ? 'resolvido' : r.pick(['aberto', 'em_atendimento']) });
    }

    /* ---------------- Zabbix e CMDB por conveniado ---------------- */
    const zabbix = partners.map((p) => {
      const off = p.operational_status === 'offline';
      return {
        partner_code: p.partner_code, host: p.partner_code + '1',
        monitoring_status: off ? 'PROBLEM' : p.operational_status === 'degradado' ? 'PROBLEM' : 'OK',
        availability: off ? +(p.availability_24h - (now - Date.parse(p.offline_since)) / DAY).toFixed(4) : p.availability_24h,
        last_check: iso(now - r.int(0, 2) * MIN),
        downtime_min: off ? Math.round((now - Date.parse(p.offline_since)) / MIN) : 0,
        trigger: off ? 'Sem comunicação com o host (ICMP)' : p.operational_status === 'degradado' ? 'Perda de pacotes > 20% na VPN' : null,
        event_start: p.offline_since, event_recovery: null
      };
    });
    zabbix.forEach((z, i) => { partners[i].availability_24h = Math.max(0.5, z.availability); });

    const cmdb = [];
    partners.forEach((p) => {
      const host = p.partner_code + '1';
      cmdb.push({ partner_code: p.partner_code, equipment_id: host, equipment_type: 'NUC (servidor parking)', operating_system: r.weighted([['Debian GNU/Linux 10 (buster)', 55], ['Debian GNU/Linux 11 (bullseye)', 35], ['Windows 10 IoT', 10]]), modem: null, telecom_operator: null, last_collection: iso(now - r.int(1, 30) * HOUR), equipment_status: p.operational_status === 'offline' ? 'Sem coleta recente' : 'Ativo' });
      if (R.isMobile(p.connectivity_type)) {
        cmdb.push({ partner_code: p.partner_code, equipment_id: 'RT-' + p.partner_code, equipment_type: 'Roteador 4G', operating_system: null, modem: r.pick(['Hongdian V40', 'Hongdian H8922', 'Hongdian H8956']), telecom_operator: p.telecom_operator, last_collection: iso(now - r.int(1, 30) * HOUR), equipment_status: p.operational_status === 'offline' ? 'Sem coleta recente' : 'Ativo' });
      } else {
        cmdb.push({ partner_code: p.partner_code, equipment_id: 'LK-' + p.partner_code, equipment_type: p.connectivity_type === 'ADSL' ? 'Modem ADSL' : p.connectivity_type === 'Rádio' ? 'Enlace de rádio' : 'ONT / roteador fixo', operating_system: null, modem: p.connectivity_type === 'ADSL' ? 'Modem ADSL (modelo a confirmar)' : 'A confirmar', telecom_operator: p.telecom_operator, last_collection: iso(now - r.int(1, 30) * HOUR), equipment_status: p.operational_status === 'offline' ? 'Sem coleta recente' : 'Ativo' });
      }
      if (p.service_type === 'Posto' && r() < 0.7) cmdb.push({ partner_code: p.partner_code, equipment_id: 'AN-' + p.partner_code, equipment_type: 'Antena RFID', operating_system: null, modem: null, telecom_operator: null, last_collection: iso(now - r.int(1, 30) * HOUR), equipment_status: 'Ativo' });
    });

    /* ------------------------------------------------------------------
       4. Histórico consolidado (12 meses) — separado dos eventos atuais
       ------------------------------------------------------------------ */
    const history = buildHistory(r, now, partners);

    return { generated_at: iso(now), now, partners, cmdb, zabbix, zabbixEvents, incidents, events, history };
  }

  /* Sazonalidade de chuva aproximada por região (índice 0–1 por mês, jan..dez) */
  function rainSeason(uf, m) {
    const N = ['AM', 'AC', 'RR', 'RO', 'AP', 'PA', 'TO'];
    const NE = ['BA', 'SE', 'AL', 'PE', 'PB', 'RN', 'CE', 'PI', 'MA'];
    const S = ['PR', 'SC', 'RS'];
    const tables = {
      N: [0.9, 1, 1, 0.95, 0.7, 0.4, 0.3, 0.25, 0.3, 0.45, 0.6, 0.8],
      NE: [0.35, 0.5, 0.7, 0.9, 1, 0.85, 0.7, 0.45, 0.25, 0.15, 0.15, 0.25],
      S: [0.75, 0.7, 0.6, 0.55, 0.6, 0.65, 0.7, 0.65, 0.8, 0.85, 0.7, 0.7],
      SE: [1, 0.85, 0.75, 0.4, 0.2, 0.1, 0.08, 0.12, 0.3, 0.55, 0.75, 0.95]
    };
    const key = N.includes(uf) ? 'N' : NE.includes(uf) ? 'NE' : S.includes(uf) ? 'S' : 'SE';
    return tables[key][m];
  }

  function buildHistory(r, now, partners) {
    const ufs = Object.keys(R.UF_NAMES);
    const partnersByUf = U.groupBy(partners, (p) => p.state);
    const monthly = [];   // por UF e mês: chuva, incidentes de conectividade, interrupções de energia
    const events = [];    // eventos históricos (regionais) consolidados
    const nowD = new Date(now);
    let seq = 1;
    for (let k = 11; k >= 0; k--) {
      const d = new Date(Date.UTC(nowD.getUTCFullYear(), nowD.getUTCMonth() - k, 15, 15));
      const m = d.getUTCMonth();
      const monthKey = d.toISOString().slice(0, 7);
      ufs.forEach((uf) => {
        const np = (partnersByUf.get(uf) || []).length;
        const season = rainSeason(uf, m);
        const rain = Math.round(30 + season * r.int(160, 260) + r() * 30);
        const energy = Math.max(0, Math.round(np * (0.04 + season * 0.12) + r.jitter(0, 1.2)));
        const conn = Math.max(0, Math.round(np * (0.18 + season * 0.35) + energy * 1.4 + r.jitter(0, 2)));
        const connDuringEnergy = Math.min(conn, Math.round(energy * (1.1 + r() * 1.2)));
        monthly.push({ month: monthKey, state: uf, rain_mm: rain, conn_incidents: conn, energy_interruptions: energy, conn_failures_during_energy: connDuringEnergy, partners: np });

        const nEv = Math.max(0, Math.round(np / 9 * (0.5 + season) + r.jitter(0, 1)));
        for (let i = 0; i < nEv; i++) {
          const cat = r.weighted([['telecom_movel', 30], ['telecom_fixa', 18], ['energia', 25 + season * 15], ['clima', 15 + season * 35]]);
          const plist = partnersByUf.get(uf) || [];
          const sample = plist.length ? r.pick(plist) : null;
          const start = d.getTime() - r.int(0, 27) * DAY - r.int(0, 23) * HOUR;
          const affected = cat === 'clima' && r() < 0.35 ? 0 : r.int(1, Math.max(2, Math.round(np / 3)));
          events.push({
            event_id: 'HIS-' + String(seq++).padStart(5, '0'), month: monthKey, start_time: new Date(start).toISOString(),
            category: cat, state: uf, city: sample ? sample.city : R.UF_NAMES[uf],
            operator: cat.startsWith('telecom') ? r.weighted([['Vivo', 30], ['Claro', 28], ['TIM', 24], ['Oi', 10], ['Algar', 3], ['Provedor regional', 5]]) : null,
            partners_affected: affected,
            related_incidents: Math.round(affected * (0.5 + r() * 0.6)),
            ttd_min: r.int(4, cat === 'clima' ? 25 : 55),
            ttr_min: r.int(35, cat === 'energia' ? 420 : 300),
            confidence: r.weighted([['confirmada', 22], ['alta', 28], ['media', 30], ['baixa', 12], ['nao_verificada', 8]]),
            severity: r.weighted([['critica', 8], ['alta', 25], ['media', 42], ['baixa', 25]])
          });
        }
      });
    }
    return { monthly, events };
  }

  return { generate };
})();
