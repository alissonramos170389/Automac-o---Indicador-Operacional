/* ==========================================================================
   CAMADA DE INTEGRAÇÃO
   - Cada fonte (interna ou externa) tem um adapter independente com a mesma
     interface:  fetch(query) -> Promise<{ records, meta }>
   - No V0 todos os adapters são SIMULADOS: devolvem dados do simulador com
     latência artificial. Nenhum endpoint é chamado e nenhuma resposta de API
     real é apresentada como tal.
   - Para conectar uma API real: implementar `transport` (HTTP) e `normalize`
     no adapter correspondente, mantendo o formato normalizado (js/data model).
   ========================================================================== */
IOA.integrations = (function () {
  const U = IOA.utils;

  /** Status possíveis de uma fonte. */
  const STATUS = {
    simulado: { label: 'Simulado', cls: 'sim' },
    nao_configurado: { label: 'Não configurado', cls: 'muted' },
    indisponivel: { label: 'Indisponível', cls: 'crit' },
    desatualizado: { label: 'Desatualizado', cls: 'warn' },
    ok: { label: 'Operacional', cls: 'ok' } // reservado para integrações reais validadas
  };

  /**
   * Definição das fontes. "planned: true" = fonte planejada, NÃO validada.
   * endpoint fica como "a definir" até a validação técnica/contratual.
   */
  const SOURCES = [
    // ---- Internas ----
    { id: 'interno_opc', domain: 'interno', name: 'Base OPC (tb_opc)', provider: 'Abastece — Base OPC', endpoint: 'DADOS_OPC.db › tb_opc (leitura)', auth: 'Arquivo/banco local', params: 'codigo, uf, cidade, cep, latitude, longitude', frequency_min: 60, retry: '3 tentativas, backoff 2 min', status: 'simulado', entity: 'partners' },
    { id: 'interno_cmdb', domain: 'interno', name: 'CMDB Abastece (coleta parking)', provider: 'Abastece — Painel CMDB', endpoint: 'coletas/*_coleta.json', auth: 'Pasta de rede', params: 'HOSTNAME, NAME_SO, Conectividade.ROTEADOR, IMEI', frequency_min: 60, retry: '3 tentativas', status: 'simulado', entity: 'cmdb' },
    { id: 'interno_servicenow', domain: 'interno', name: 'ServiceNow (wm_order)', provider: 'ServiceNow — exportação wm_order_DD-MM.xlsx', endpoint: 'incidentes/wm_order_DD-MM.xlsx', auth: 'Pasta de rede (exportação)', params: 'number, conveniado, categoria, aberto, encerrado, status', frequency_min: 15, retry: '3 tentativas', status: 'simulado', entity: 'incidents' },
    { id: 'interno_zabbix', domain: 'interno', name: 'Zabbix (disponibilidade)', provider: 'Zabbix', endpoint: 'A definir (API JSON-RPC ou exportação MES_XX.xlsx)', auth: 'Token de API (a definir)', params: 'host, triggers, eventos', frequency_min: 5, retry: '5 tentativas, backoff 1 min', status: 'simulado', entity: 'zabbix' },
    // ---- Telecom ----
    { id: 'telecom_anatel', domain: 'telecom', name: 'Anatel Dados Abertos', provider: 'Anatel', endpoint: 'A definir', auth: 'Pública (a validar)', params: 'UF, município, operadora', frequency_min: 1440, retry: '2 tentativas', status: 'simulado', planned: true, note: 'Dados abertos são consolidados; não tratar como alerta em tempo real.' },
    { id: 'telecom_camara', domain: 'telecom', name: 'GSMA Open Gateway / CAMARA', provider: 'GSMA / operadoras', endpoint: 'A definir', auth: 'OAuth2 via operadora (a validar)', params: 'coordenadas, raio', frequency_min: 15, retry: '3 tentativas', status: 'nao_configurado', planned: true },
    { id: 'telecom_operadoras', domain: 'telecom', name: 'APIs / portais das operadoras', provider: 'Claro, Vivo, TIM, Algar, Oi', endpoint: 'A definir por operadora', auth: 'A definir por contrato', params: 'região, tecnologia', frequency_min: 10, retry: '3 tentativas, backoff 2 min', status: 'simulado', planned: true },
    { id: 'telecom_ripe', domain: 'telecom', name: 'RIPE Atlas', provider: 'RIPE NCC', endpoint: 'A definir', auth: 'Chave de API (a obter)', params: 'ASN, medições', frequency_min: 30, retry: '3 tentativas', status: 'nao_configurado', planned: true },
    // ---- Clima ----
    { id: 'clima_openmeteo', domain: 'clima', name: 'Open-Meteo', provider: 'Open-Meteo', endpoint: 'A definir', auth: 'Sem chave (uso a validar)', params: 'latitude, longitude, precipitação, rajadas', frequency_min: 30, retry: '3 tentativas', status: 'simulado', planned: true },
    { id: 'clima_inmet', domain: 'clima', name: 'INMET (estações e alertas)', provider: 'INMET', endpoint: 'A definir', auth: 'A validar', params: 'estação, UF, alertas vigentes', frequency_min: 30, retry: '3 tentativas', status: 'simulado', planned: true },
    { id: 'clima_google', domain: 'clima', name: 'Google Weather API', provider: 'Google', endpoint: 'A definir', auth: 'Chave de API paga (não contratada)', params: 'coordenadas', frequency_min: 30, retry: '3 tentativas', status: 'nao_configurado', planned: true },
    { id: 'clima_redemet', domain: 'clima', name: 'REDEMET', provider: 'DECEA', endpoint: 'A definir', auth: 'Chave de API (a validar)', params: 'METAR/radar', frequency_min: 30, retry: '3 tentativas', status: 'indisponivel', planned: true, simulated_error: 'Simulação de falha: tempo limite excedido (exemplo de estado de erro)' },
    { id: 'clima_cemaden', domain: 'clima', name: 'CEMADEN', provider: 'CEMADEN', endpoint: 'A definir', auth: 'A validar', params: 'municípios monitorados, alertas', frequency_min: 30, retry: '3 tentativas', status: 'simulado', planned: true },
    // ---- Energia ----
    { id: 'energia_aneel', domain: 'energia', name: 'ANEEL Dados Abertos', provider: 'ANEEL', endpoint: 'A definir', auth: 'Pública (a validar)', params: 'distribuidora, conjunto, mês', frequency_min: 43200, retry: '2 tentativas', status: 'desatualizado', planned: true, note: 'Base mensal histórica (DEC/FEC). Nunca usada como notificação em tempo real.' },
    { id: 'energia_distribuidoras', domain: 'energia', name: 'APIs / portais das distribuidoras', provider: 'Enel, CPFL, Neoenergia, Energisa, Cemig, Equatorial e outras', endpoint: 'A definir por distribuidora', auth: 'A definir', params: 'município, ocorrência', frequency_min: 10, retry: '3 tentativas, backoff 2 min', status: 'simulado', planned: true, note: 'Distribuidoras citadas são exemplos, não integrações confirmadas.' }
  ];

  /* ------------------------------------------------------------------
     Mapeamento de campos internos (o que precisa ser confirmado)
     ------------------------------------------------------------------ */
  const FIELD_MAPPING = {
    'Base OPC': [
      ['partner_code', 'tb_opc.codigo', 'confirmado'], ['partner_name', 'tb_opc.nome / razão social', 'a confirmar'], ['operational_status', 'tb_opc.suspenso / data da suspensão', 'confirmado'],
      ['city', 'tb_opc.cidade', 'confirmado'], ['state', 'tb_opc.uf', 'confirmado'], ['postal_code', 'tb_opc.cep', 'confirmado'],
      ['latitude / longitude', 'tb_opc (lat/lon) + coordenadas_complementares.csv', 'a confirmar'], ['service_type', 'tb_opc.razão de uso', 'confirmado']
    ],
    'CMDB Abastece': [
      ['partner_code', 'Server.HOSTNAME (5 primeiros dígitos)', 'confirmado'], ['equipment_id', 'Server.HOSTNAME', 'confirmado'], ['equipment_type', 'Inferido pela seção da coleta', 'a confirmar'],
      ['operating_system', 'Server.NAME_SO', 'confirmado'], ['modem', 'Conectividade.ROTEADOR / ROUTER_HARDWARE', 'confirmado'], ['telecom_operator', 'Conectividade.CHIP_CARD / ICCID → operadora', 'a confirmar'],
      ['last_collection', 'Server.DATA_COLETA', 'confirmado'], ['equipment_status', 'Calculado pela idade da coleta', 'a confirmar']
    ],
    'ServiceNow (wm_order_DD-MM.xlsx)': [
      ['incident_id', 'number', 'a confirmar'], ['partner_code', 'conveniado / código', 'a confirmar'], ['category', 'categoria / subcategoria', 'a confirmar'],
      ['description', 'short_description', 'a confirmar'], ['start_time', 'opened_at', 'a confirmar'], ['end_time', 'closed_at', 'a confirmar'],
      ['status', 'state', 'a confirmar'], ['integration_id', 'ID de integração', 'a confirmar'], ['duration', 'Calculado (encerrado − aberto)', 'confirmado'],
      ['sn_class', 'Classificação do Cockpit: Problema Geral / Parcial / Outros', 'confirmado']
    ],
    'Zabbix': [
      ['partner_code', 'host (hostname → 5 primeiros dígitos)', 'a confirmar'], ['host', 'host', 'a confirmar'], ['monitoring_status', 'trigger value (OK/PROBLEM)', 'a confirmar'],
      ['availability', 'MES_XX.xlsx (média do período)', 'confirmado'], ['last_check', 'item lastclock', 'a confirmar'], ['downtime', 'Calculado pelos eventos', 'a confirmar'],
      ['trigger', 'trigger description', 'a confirmar'], ['event_start / event_recovery', 'event clock / r_clock', 'a confirmar']
    ]
  };

  /* ------------------------------------------------------------------
     Monitoramento das fontes (API_MONITORING)
     ------------------------------------------------------------------ */
  const monitoring = new Map();
  function initMonitoring(now) {
    SOURCES.forEach((s, i) => {
      const base = { provider: s.name, endpoint: s.endpoint, last_attempt: null, last_success: null, response_status: null, error_message: null, records_received: 0, data_freshness: null, status: s.status };
      if (s.status === 'nao_configurado') base.error_message = 'Fonte ainda não configurada';
      if (s.status === 'desatualizado') { base.last_success = new Date(now - 34 * 86400000).toISOString(); base.last_attempt = new Date(now - 2 * 3600000).toISOString(); base.response_status = 'SIM-200'; base.data_freshness = 'Mensal — último consolidado há 34 dias'; }
      if (s.status === 'indisponivel') { base.last_success = new Date(now - 26 * 3600000).toISOString(); base.last_attempt = new Date(now - 6 * 60000).toISOString(); base.response_status = 'SIM-504'; base.error_message = s.simulated_error; }
      monitoring.set(s.id, base);
    });
  }

  /* ------------------------------------------------------------------
     Cache regional: consultas externas por célula geográfica, não por
     conveniado (ex.: 3.000 conveniados → ~150 células).
     ------------------------------------------------------------------ */
  const CELL_DEG = 0.5;
  const cellKey = (lat, lon) => Math.floor(lat / CELL_DEG) + ':' + Math.floor(lon / CELL_DEG);
  function regionalCells(partners) {
    const cells = new Map();
    partners.forEach((p) => {
      const k = cellKey(p.latitude, p.longitude);
      if (!cells.has(k)) cells.set(k, { key: k, count: 0, lat: 0, lon: 0 });
      const c = cells.get(k); c.count++; c.lat += p.latitude; c.lon += p.longitude;
    });
    return [...cells.values()].map((c) => ({ key: c.key, count: c.count, lat: c.lat / c.count, lon: c.lon / c.count }));
  }
  const cache = new Map(); // chave adapter+query → { at, ttl, value }

  /* ------------------------------------------------------------------
     Adapter genérico
     ------------------------------------------------------------------ */
  function createAdapter(source, transport) {
    return {
      source,
      /** Busca dados; usa cache por (fonte + consulta) respeitando a frequência configurada. */
      async fetch(query) {
        const key = source.id + '|' + JSON.stringify(query || {});
        const mon = monitoring.get(source.id);
        const hit = cache.get(key);
        if (hit && Date.now() - hit.at < source.frequency_min * 60000) return hit.value;
        mon.last_attempt = new Date().toISOString();
        if (source.status === 'nao_configurado') return { records: [], meta: { simulated: true, status: 'nao_configurado' } };
        if (source.status === 'indisponivel') { mon.response_status = 'SIM-504'; throw new Error(source.simulated_error || 'Fonte indisponível'); }
        await new Promise((res) => setTimeout(res, 120 + Math.random() * 260)); // latência simulada
        const records = transport(query) || [];
        const value = { records, meta: { simulated: true, provider: source.provider, received_at: new Date().toISOString() } };
        if (source.status !== 'desatualizado') {
          mon.last_success = value.meta.received_at; mon.response_status = 'SIM-200'; mon.error_message = null; mon.data_freshness = 'Simulado — atualizado agora';
        }
        mon.records_received = records.length;
        cache.set(key, { at: Date.now(), value });
        return value;
      }
    };
  }

  /* ------------------------------------------------------------------
     Montagem: liga cada adapter à fatia correspondente do simulador.
     ------------------------------------------------------------------ */
  let dataset = null;
  const adapters = {};
  function setup(simData) {
    dataset = simData;
    initMonitoring(simData.now);
    const evBy = (id) => () => dataset.events.filter((e) => e.adapter_id === id);
    const transports = {
      interno_opc: () => dataset.partners,
      interno_cmdb: () => dataset.cmdb,
      interno_servicenow: () => dataset.incidents,
      interno_zabbix: () => dataset.zabbix
    };
    SOURCES.forEach((s) => { adapters[s.id] = createAdapter(s, transports[s.id] || evBy(s.id)); });
  }

  /** Carrega tudo pelos adapters (como seria com APIs reais). Falhas não derrubam a aplicação. */
  async function loadAll() {
    const out = { partners: [], cmdb: [], incidents: [], zabbix: [], events: [], errors: [] };
    const jobs = SOURCES.map(async (s) => {
      try {
        const res = await adapters[s.id].fetch({});
        if (s.entity) out[s.entity] = res.records;
        else out.events.push(...res.records);
      } catch (e) {
        out.errors.push({ source: s.name, message: e.message });
      }
    });
    await Promise.all(jobs);
    out.history = dataset.history;
    out.zabbixEvents = dataset.zabbixEvents;
    out.now = dataset.now;
    out.generated_at = dataset.generated_at;
    return out;
  }

  return { STATUS, SOURCES, FIELD_MAPPING, monitoring, adapters, setup, loadAll, regionalCells, CELL_DEG };
})();
