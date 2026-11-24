/* ==========================================================================
   Dados de referência (domínios, cidades, distribuidoras, operadoras).
   Coordenadas de cidades são públicas (sedes municipais, aproximadas).
   ========================================================================== */
IOA.ref = (function () {
  const UF_NAMES = {
    AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo',
    GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná',
    PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
    SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins'
  };

  // [UF, cidade, lat, lon, peso (concentração de conveniados), distribuidora (exemplo), CEP base]
  const CITIES = [
    ['SP', 'São Paulo', -23.5505, -46.6333, 34, 'Enel SP', '01000'],
    ['SP', 'Campinas', -22.9056, -47.0608, 12, 'CPFL Paulista', '13000'],
    ['SP', 'Ribeirão Preto', -21.1775, -47.8103, 6, 'CPFL Paulista', '14000'],
    ['SP', 'Sorocaba', -23.5015, -47.4526, 5, 'CPFL Piratininga', '18000'],
    ['SP', 'São José dos Campos', -23.1896, -45.8841, 5, 'EDP SP', '12200'],
    ['SP', 'Santos', -23.9608, -46.3336, 4, 'CPFL Piratininga', '11000'],
    ['SP', 'Guarulhos', -23.4543, -46.5337, 5, 'EDP SP', '07000'],
    ['SP', 'Bauru', -22.3246, -49.0871, 3, 'CPFL Paulista', '17000'],
    ['RJ', 'Rio de Janeiro', -22.9068, -43.1729, 18, 'Light', '20000'],
    ['RJ', 'Niterói', -22.8832, -43.1034, 4, 'Enel RJ', '24000'],
    ['RJ', 'Duque de Caxias', -22.7856, -43.3117, 3, 'Light', '25000'],
    ['MG', 'Belo Horizonte', -19.9167, -43.9345, 11, 'Cemig', '30000'],
    ['MG', 'Contagem', -19.9317, -44.0536, 5, 'Cemig', '32000'],
    ['MG', 'Uberlândia', -18.9186, -48.2772, 5, 'Cemig', '38400'],
    ['MG', 'Juiz de Fora', -21.7642, -43.3503, 3, 'Cemig', '36000'],
    ['ES', 'Vitória', -20.3155, -40.3128, 4, 'EDP ES', '29000'],
    ['ES', 'Serra', -20.1286, -40.3077, 2, 'EDP ES', '29160'],
    ['PR', 'Curitiba', -25.4284, -49.2733, 10, 'Copel', '80000'],
    ['PR', 'Londrina', -23.3045, -51.1696, 4, 'Copel', '86000'],
    ['PR', 'Maringá', -23.4205, -51.9333, 3, 'Copel', '87000'],
    ['SC', 'Florianópolis', -27.5954, -48.548, 5, 'Celesc', '88000'],
    ['SC', 'Joinville', -26.3045, -48.8487, 4, 'Celesc', '89200'],
    ['SC', 'Chapecó', -27.1004, -52.6152, 2, 'Celesc', '89800'],
    ['RS', 'Porto Alegre', -30.0346, -51.2177, 10, 'CEEE Equatorial', '90000'],
    ['RS', 'Caxias do Sul', -29.1678, -51.1794, 4, 'RGE (CPFL)', '95000'],
    ['RS', 'Canoas', -29.9177, -51.1839, 3, 'RGE (CPFL)', '92000'],
    ['GO', 'Goiânia', -16.6869, -49.2648, 8, 'Equatorial Goiás', '74000'],
    ['GO', 'Aparecida de Goiânia', -16.8233, -49.2439, 3, 'Equatorial Goiás', '74900'],
    ['DF', 'Brasília', -15.7939, -47.8828, 8, 'Neoenergia Brasília', '70000'],
    ['MT', 'Cuiabá', -15.601, -56.0974, 4, 'Energisa MT', '78000'],
    ['MT', 'Sinop', -11.8642, -55.5093, 1, 'Energisa MT', '78550'],
    ['MT', 'Rondonópolis', -16.4673, -54.6372, 2, 'Energisa MT', '78700'],
    ['MS', 'Campo Grande', -20.4697, -54.6201, 4, 'Energisa MS', '79000'],
    ['MS', 'Dourados', -22.2231, -54.812, 2, 'Energisa MS', '79800'],
    ['BA', 'Salvador', -12.9777, -38.5016, 9, 'Neoenergia Coelba', '40000'],
    ['BA', 'Feira de Santana', -12.2664, -38.9663, 3, 'Neoenergia Coelba', '44000'],
    ['BA', 'Vitória da Conquista', -14.8619, -40.8444, 2, 'Neoenergia Coelba', '45000'],
    ['PE', 'Recife', -8.0476, -34.877, 8, 'Neoenergia Pernambuco', '50000'],
    ['PE', 'Jaboatão dos Guararapes', -8.1128, -35.0158, 3, 'Neoenergia Pernambuco', '54000'],
    ['PE', 'Caruaru', -8.2842, -35.9699, 2, 'Neoenergia Pernambuco', '55000'],
    ['CE', 'Fortaleza', -3.7319, -38.5267, 8, 'Enel CE', '60000'],
    ['CE', 'Juazeiro do Norte', -7.2131, -39.3151, 2, 'Enel CE', '63000'],
    ['RN', 'Natal', -5.7945, -35.211, 4, 'Neoenergia Cosern', '59000'],
    ['PB', 'João Pessoa', -7.1195, -34.845, 4, 'Energisa PB', '58000'],
    ['PB', 'Campina Grande', -7.2307, -35.8817, 2, 'Energisa PB', '58400'],
    ['AL', 'Maceió', -9.6498, -35.7089, 4, 'Equatorial Alagoas', '57000'],
    ['SE', 'Aracaju', -10.9472, -37.0731, 3, 'Energisa SE', '49000'],
    ['PI', 'Teresina', -5.0919, -42.8034, 3, 'Equatorial Piauí', '64000'],
    ['MA', 'São Luís', -2.5307, -44.3068, 4, 'Equatorial Maranhão', '65000'],
    ['MA', 'Imperatriz', -5.5264, -47.4917, 2, 'Equatorial Maranhão', '65900'],
    ['PA', 'Belém', -1.4558, -48.4902, 5, 'Equatorial Pará', '66000'],
    ['PA', 'Ananindeua', -1.3656, -48.3722, 2, 'Equatorial Pará', '67000'],
    ['PA', 'Marabá', -5.3686, -49.1178, 2, 'Equatorial Pará', '68500'],
    ['AM', 'Manaus', -3.119, -60.0217, 6, 'Amazonas Energia', '69000'],
    ['AP', 'Macapá', 0.0349, -51.0694, 2, 'CEA Equatorial', '68900'],
    ['RR', 'Boa Vista', 2.8235, -60.6758, 2, 'Roraima Energia', '69300'],
    ['RO', 'Porto Velho', -8.7612, -63.9004, 3, 'Energisa RO', '76800'],
    ['RO', 'Ji-Paraná', -10.8853, -61.9517, 1, 'Energisa RO', '76900'],
    ['AC', 'Rio Branco', -9.9754, -67.8249, 2, 'Energisa AC', '69900'],
    ['TO', 'Palmas', -10.1844, -48.3336, 3, 'Energisa TO', '77000'],
    ['TO', 'Araguaína', -7.1911, -48.2072, 1, 'Energisa TO', '77800']
  ];

  const OPERATORS = ['Claro', 'Vivo', 'TIM', 'Algar', 'Oi', 'Provedor regional', 'Outros'];
  const TECHNOLOGIES = ['2G', '3G', '4G', '5G', 'Fibra', 'ADSL', 'Rádio', 'Outro fixo'];
  const MOBILE_TECH = ['2G', '3G', '4G', '5G'];
  const FIXED_TECH = ['Fibra', 'ADSL', 'Rádio', 'Outro fixo'];
  const isMobile = (t) => MOBILE_TECH.includes(t);

  const SERVICE_TYPES = ['Posto', 'Estacionamento', 'Pedágio', 'Drive thru'];

  // Grupos de distribuidoras citados na especificação (exemplos, não integrações confirmadas)
  const DISTRIBUTOR_GROUP = (name) => {
    if (/Enel/.test(name)) return 'Enel';
    if (/CPFL|RGE/.test(name)) return 'CPFL';
    if (/Neoenergia/.test(name)) return 'Neoenergia';
    if (/Energisa/.test(name)) return 'Energisa';
    if (/Cemig/.test(name)) return 'Cemig';
    if (/Equatorial/.test(name)) return 'Equatorial';
    return 'Outras regionais';
  };

  const EVENT_CATEGORIES = {
    telecom_movel: { label: 'Conectividade móvel', short: 'Móvel', color: '#2563EB', icon: 'antenna' },
    telecom_fixa: { label: 'Conectividade fixa (Fibra/ADSL)', short: 'Fixa', color: '#0891B2', icon: 'cable' },
    energia: { label: 'Energia elétrica', short: 'Energia', color: '#D97706', icon: 'bolt' },
    clima: { label: 'Clima e ambiente', short: 'Clima', color: '#7C3AED', icon: 'cloud' }
  };

  const WEATHER_SUB = {
    chuva: 'Chuva', chuva_forte: 'Chuva forte', tempestade: 'Tempestade', raios: 'Raios', vento: 'Vento forte',
    granizo: 'Granizo', alagamento: 'Alagamento', alerta_extremo: 'Alerta de evento extremo'
  };

  const SEVERITIES = {
    critica: { label: 'Crítica', rank: 4, cls: 'crit' },
    alta: { label: 'Alta', rank: 3, cls: 'high' },
    media: { label: 'Média', rank: 2, cls: 'warn' },
    baixa: { label: 'Baixa', rank: 1, cls: 'info' }
  };

  const EVENT_STATUS = { ativo: 'Ativo', monitorando: 'Em monitoramento', resolvido: 'Resolvido', previsto: 'Previsto' };
  const INCIDENT_STATUS = { aberto: 'Aberto', em_atendimento: 'Em atendimento', resolvido: 'Resolvido' };

  // Natureza da evidência por domínio — usada para nunca misturar previsão com observação,
  // nem registro histórico com notificação em tempo real.
  const EVIDENCE = {
    // energia
    oficial: { label: 'Interrupção oficialmente informada', reliability: 3 },
    alerta_distribuidora: { label: 'Alerta da distribuidora', reliability: 2 },
    historico: { label: 'Registro histórico de interrupção', reliability: 0 },
    inferido: { label: 'Falha inferida (sem fonte externa)', reliability: 1 },
    nao_confirmado: { label: 'Informação não confirmada', reliability: 0 },
    // telecom
    confirmado_operadora: { label: 'Confirmado pela operadora', reliability: 3 },
    degradacao_reportada: { label: 'Degradação reportada por fonte externa', reliability: 2 },
    // clima
    observado: { label: 'Observado (estação/medição)', reliability: 2 },
    alerta_oficial: { label: 'Alerta oficial', reliability: 3 },
    previsao: { label: 'Previsão (não observado)', reliability: 0 }
  };

  // Classificação ServiceNow preservada do Cockpit (wm_order_DD-MM.xlsx)
  const SN_CLASSES = ['Problema Geral', 'Parcial', 'Outros'];
  const INCIDENT_CATEGORIES = {
    conectividade: 'Conectividade',
    energia: 'Energia / equipamento desligado',
    hardware: 'Hardware',
    automacao: 'Automação / bomba',
    aplicacao: 'Aplicação'
  };

  const CONFIDENCE = {
    confirmada: { label: 'Confirmada', rank: 5, cls: 'conf', desc: 'Sustentada por fonte oficial ou da própria operadora/distribuidora.' },
    alta: { label: 'Alta', rank: 4, cls: 'high', desc: 'Múltiplas evidências independentes (geográfica, temporal e fonte externa).' },
    media: { label: 'Média', rank: 3, cls: 'warn', desc: 'Correlação geográfica e temporal, sem confirmação externa.' },
    baixa: { label: 'Baixa', rank: 2, cls: 'info', desc: 'Evidência fraca ou incompleta.' },
    nao_verificada: { label: 'Não verificada', rank: 1, cls: 'muted', desc: 'Sem confirmação confiável.' }
  };

  return { UF_NAMES, CITIES, OPERATORS, TECHNOLOGIES, MOBILE_TECH, FIXED_TECH, isMobile, SERVICE_TYPES, DISTRIBUTOR_GROUP, EVENT_CATEGORIES, WEATHER_SUB, SEVERITIES, EVENT_STATUS, INCIDENT_STATUS, EVIDENCE, SN_CLASSES, INCIDENT_CATEGORIES, CONFIDENCE };
})();
