# Inteligência Operacional Abastece — V0

**Eventos externos, conectividade e monitoramento de infraestrutura.**

Protótipo frontend (HTML5, CSS3 e JavaScript puro) que correlaciona incidentes operacionais dos conveniados Abastece com eventos externos de telecom, energia e clima, para responder à pergunta central:

> *Este incidente é um problema isolado de equipamento ou existe um evento externo afetando vários conveniados na mesma região?*

> ⚠️ **DEMO — DADOS SIMULADOS.** Nenhuma API real é chamada. Todos os conveniados, incidentes, eventos e respostas de API são gerados localmente e identificados como simulados na interface.

Aplicação **nova e independente**: não altera, substitui nem depende do Parque Abastece / Cockpit Automações Credenciados.

---

## Como executar

Não há build nem dependências a instalar (bibliotecas já estão em `vendor/`).

- **Opção 1:** abrir `index.html` direto no navegador.
- **Opção 2 (recomendada):** servidor local simples na pasta do projeto:
  ```bash
  python3 -m http.server 8080
  # abrir http://localhost:8080
  ```

Os tiles do mapa (OpenStreetMap) precisam de internet. Sem acesso, os marcadores e as áreas de evento continuam funcionando sobre fundo neutro.

## Telas

| # | Tela | Destaques |
|---|------|-----------|
| 1 | Visão Executiva | 9 KPIs com comparação, tendência e minigráfico clicáveis; painel “isolado ou regional?”; eventos críticos priorizados; 6 gráficos interativos; TOP 10 de regiões com maior risco |
| 2 | Mapa de Ocorrências | Leaflet + OSM sem chave; 7 camadas independentes; agrupamento configurável; tolerância de distância; painel do conveniado e do evento |
| 3 | Conectividade | Tecnologias 2G–5G, Fibra, ADSL, Rádio; operadoras; classificação em 5 níveis (individual → queda confirmada); regras de detecção configuráveis |
| 4 | Energia | Distribuidoras (exemplos); separa oficial, alerta da distribuidora, histórico (ANEEL), inferido e não confirmado |
| 5 | Eventos Climáticos | Abas separadas para observado, alerta oficial e previsão; chuva × incidentes no histórico |
| 6 | Correlação de Incidentes | Motor com 6 regras; FATO / HIPÓTESE / AÇÃO; confiança transparente; índice de evidência explicado; tabela CORRELATIONS exportável |
| 7 | Histórico e Relatórios | 12 meses consolidados; TTD/TTR; por categoria, UF e operadora; clima × falhas e energia × conectividade; exportação CSV |
| 8 | Configurações e Integrações | Adapters por fonte com status (Simulado, Não configurado, Indisponível, Desatualizado); API_MONITORING; mapeamento de campos internos; modelo de dados |

Recursos globais: sidebar recolhível, filtros globais (UF, cidade, código, nome, tecnologia, operadora, categoria, severidade, status do incidente e período), busca global (atalho `/`), notificações, relógio e última atualização, drawers de detalhe, ordenação, paginação e CSV (separador `;`, UTF-8 com BOM para Excel). Horários exibidos em `America/Sao_Paulo`.

## Arquitetura

```
index.html
css/app.css
js/
  core/utils.js            datas (fuso SP), distância, CSV, RNG determinístico
  data/reference.js        domínios: UFs, cidades, operadoras, tecnologias, severidades, natureza da evidência
  data/simulator.js        gera os dados simulados e os cenários (substituível)
  integrations/adapters.js adapters por fonte + API_MONITORING + cache regional + mapeamento de campos
  engine/correlation.js    motor de correlação (regras puras, sem DOM)
  core/store.js            estado, filtros globais e visões filtradas memoizadas
  ui/components.js         KPI, badges, tabela, drawer, gráficos
  ui/details.js            drawers de conveniado, evento, incidente e ocorrência
  views/*.js               uma tela por arquivo
  app.js                   shell, filtros, busca, notificações, rotas
vendor/                    Leaflet 1.9.4, Leaflet.markercluster 1.5.3, Chart.js 4.4.4 (licenças incluídas)
```

Separação de camadas: **dados → adapters → motor → store → telas**. As telas nunca leem o simulador diretamente; trocar uma fonte simulada por API real é feito só no adapter (ver tela 8 e `docs/ARQUITETURA.md`). Scripts clássicos com namespace `IOA` (não ES modules) para funcionar também via `file://`.

## Motor de correlação

| Regra | Critério |
|-------|----------|
| R1 Queda regional de operadora | ≥ N conveniados da mesma operadora (fatia ≥ 70%) num raio e janela configuráveis |
| R2 Interrupção de energia | Conveniados próximos indisponíveis + interrupção informada na mesma área/período |
| R3 Impacto climático | Chuva forte, tempestade, vento, raios ou alagamento observados/alertados (nunca previsão) |
| R4 Múltiplas operadoras | Operadoras diferentes caindo juntas → investigar causa comum |
| R5 Incidentes recorrentes | ≥ 3 incidentes da mesma categoria em 30 dias, por conveniado e cidade |
| R6 Sem evidência externa | Vários offline sem evento externo → incidente regional não explicado |

Confiança: **Confirmada** (fonte oficial/operadora), **Alta** (múltiplas evidências independentes), **Média** (geográfica + temporal), **Baixa**, **Não verificada**. Não há probabilidade inventada: o *índice de evidência* (0–100) é uma soma de pontos por critério observável, explicada na tela, usada para ordenar — não é probabilidade estatística nem prova de causa.

Parâmetros (raio, janela, mínimo de conveniados, tolerâncias, recorrência) e ativação de cada regra são editáveis na tela 6 e reprocessam o motor localmente.

## Dados simulados

≈ 400 conveniados nas 27 UFs, 23 eventos externos, 110+ incidentes ServiceNow (classes Problema Geral / Parcial / Outros), CMDB, Zabbix e 12 meses de histórico. Cenários incluídos:

1. Mesma operadora indisponível na mesma região (Campinas/Vivo) — com degradação reportada.
2. Várias operadoras caindo por interrupção de energia oficial (Contagem/Cemig).
3. Chuva forte/tempestade perto de conveniados com incidentes (Porto Alegre).
4. Eventos climáticos sem impacto operacional (Manaus, Florianópolis) e previsão (Curitiba).
5. Conveniados offline sem evidência externa (Goiânia).
6. Evento externo ativo sem conveniado afetado (Sinop, Boa Vista).
7. Evento já resolvido (Salvador/Coelba).

Extras: queda de fibra confirmada pela operadora (Rio/Oi), possível queda sem fonte (Recife/TIM), alerta de distribuidora (SP/Enel), recorrência (Fortaleza), alagamento (Belém), registros históricos ANEEL fora do tempo real e uma fonte simulada com falha (REDEMET) para demonstrar o estado de erro.

## Limitações do V0

- Integrações externas são **planejadas e não validadas**; endpoints aparecem como “a definir”.
- Campos das exportações internas (wm_order, Zabbix, coleta CMDB) estão mapeados com situação “confirmado / a confirmar”.
- Comparativos “vs. ontem” e minigráficos usam série simulada.
- Parâmetros do motor ficam salvos apenas no navegador (localStorage).
