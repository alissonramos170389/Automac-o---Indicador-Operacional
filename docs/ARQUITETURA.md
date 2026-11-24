# Arquitetura e evolução para produção

## Fluxo de dados (V0)

```
simulator.generate()  ──►  adapters (1 por fonte)  ──►  loadAll()  ──►  store.init()
                                                                         │
                                                         engine.run(cfg) ┘  (uma vez; de novo só ao mudar regras)
                                                                         │
                                       store.view() memoizado por filtros ──►  telas
```

- **Adapters** (`js/integrations/adapters.js`): interface única `fetch(query) → Promise<{records, meta}>`, com cache por fonte + consulta respeitando a frequência, registro em `API_MONITORING` e tratamento de erro que não derruba a aplicação.
- **Motor** (`js/engine/correlation.js`): função pura sobre entidades normalizadas. Agrupamento espaço-temporal com grade geográfica (vizinhança 3×3), adequado para milhares de sinais.
- **Store** (`js/core/store.js`): índices por chave, filtros globais e visão filtrada memoizada.

## Conectando uma fonte real

1. Validar endpoint, contrato, autenticação e limites do provedor.
2. Criar um endpoint no backend que consulte a fonte (credenciais nunca no navegador).
3. No adapter, substituir o `transport` simulado por `fetch()` para esse endpoint e normalizar para `EXTERNAL_EVENTS` (incluindo `evidence_type` e `realtime`).
4. Marcar a fonte como `ok` somente após validação. Nenhuma tela precisa mudar.

## Arquitetura alvo (3.000+ conveniados)

- **Coleta agendada e assíncrona** por fonte (fila + workers), com retentativa e backoff conforme configurado.
- **Consulta regional**: células geográficas (0,5°) em vez de uma chamada por conveniado; respostas em cache com TTL.
- **Persistência**: eventos atuais separados do histórico (tabelas particionadas por mês); atualização incremental.
- **Motor no servidor**: roda a cada novo lote de sinais (Zabbix/ServiceNow) e publica ocorrências via REST/WebSocket.
- **Mapa**: agrupamento de marcadores (já no V0) e, acima de ~10 mil pontos, camadas vetoriais/heatmap.

## Modelo de dados

Entidades normalizadas: `PARTNERS`, `INTERNAL_INCIDENTS`, `EXTERNAL_EVENTS`, `CORRELATIONS`, `API_MONITORING` (campos listados na tela Configurações). Horários em ISO 8601 (UTC), exibidos em `America/Sao_Paulo`.

## Fontes internas a confirmar

O mapeamento esperado (Base OPC `tb_opc`, coleta CMDB `*_coleta.json`, ServiceNow `wm_order_DD-MM.xlsx`, Zabbix) está em `FIELD_MAPPING`, com a situação de cada campo. A classificação do Cockpit (Problema Geral / Parcial / Outros) é preservada.
