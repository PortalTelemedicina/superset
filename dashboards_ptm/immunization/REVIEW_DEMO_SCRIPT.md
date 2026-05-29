<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0
-->

# Roteiro — Review do Dashboard de Imunização v2

Cola para a apresentação. ~20 min com 5-7 min de Q&A no final.

---

## Pré-review (1h antes)

- [ ] Rodar `validation_queries.sql` no BigQuery. Anotar:
  - freshness em min (deve ser < 60)
  - top 1 município por priority_score
  - rates de abandono > 0
- [ ] Abrir 3 abas no navegador, autenticadas:
  1. `https://superset.ptmdev.com.br/superset/dashboard/gestao-imunizacao-operacional-v2/`
  2. `https://superset.ptmdev.com.br/superset/dashboard/gestao-imunizacao-estado-pi/`
  3. `https://superset.ptmdev.com.br/superset/dashboard/gestao-imunizacao-municipio-220850/`
- [ ] Tirar screenshot de cada uma para backup
- [ ] Tirar prints de `EXPLICACAO_DASHBOARD.md` (seções 1, 3, 4) para slides
  estáticos caso o ao-vivo falhe

---

## Estrutura (5 atos, ~20 min)

### Ato 1 — Problema (2 min)

Abrir com 3 perguntas que a equipe operacional faz todo dia:

1. **Quem está em atraso, onde, em que vacina?** — hoje sai por planilha de
   200k linhas.
2. **Onde vai ser a próxima crise?** — não tem visibilidade do que vence em
   30 dias por município/UBS.
3. **Os dados do RNDS estão confiáveis?** — qualquer decisão clínica em cima
   de dado podre é problema.

Frase de fechamento: *"Não estamos construindo mais um relatório bonito.
Estamos transformando o calendário do PNI + RNDS em decisão acionável."*

### Ato 2 — Solução em 3 tiers (3 min)

Slide com a tabela:

| Tier | Público | Slug |
|------|---------|------|
| Interno | PTM (todos estados) | `gestao-imunizacao-operacional-v2` |
| Estadual | Cliente estadual | `gestao-imunizacao-estado-{uf}` |
| Municipal | Cliente municipal | `gestao-imunizacao-municipio-{ibge}` |

Pontos a falar:
- Mesma base de dados, layout adaptado ao público.
- Filtros vêm pré-aplicados pelo scope; RBAC é a próxima camada.
- Factory pattern: 1 novo município ativo no registry = 1 dashboard novo
  provisionado pelo `bootstrap_via_api.py --version per-muni`.

### Ato 3 — Demo ao vivo INTERNAL (5 min)

**Abrir** dashboard interno (`gestao-imunizacao-operacional-v2`).

Caminho narrativo:

1. **KPIs no topo**: "doses em atraso hoje", "a vencer 30d", "aplicadas",
   "freshness", "inconsistências 90d", "município desconhecido"
2. **Priority ranking**: "olha aqui — esse município é o topo. A coluna
   `recommended_action` já sugere 'mutirão' ou 'busca ativa urgente'."
3. **Backlog por vacina × dose**: "aqui vemos qual imunobiológico concentra
   atraso. DTP-3 e Tríplice viral são clássicos de abandono."
4. **Backlog por UBS**: "mesmo município, UBS X tem 3x mais atraso. Decisão:
   reforço de capacidade ali."
5. **Cobertura heatmap**: "verde escuro = ≥95%, vermelho = abaixo. Padrão
   típico: 1ª dose alta, 3ª dose cai — abandono."

> **Não passe** mais que 5 min — a próxima demo (estadual) é o ponto-chave
> de novidade para o time.

### Ato 4 — Demo ao vivo ESTADO + MUNICÍPIO (4 min)

**Abrir** `gestao-imunizacao-estado-pi` em aba já carregada.

Pontos a destacar:
- "Mesmo dashboard, com Estado pré-filtrado."
- "Note que o ranking estadual NÃO aparece aqui — só faz sentido na visão
  nacional."
- "Filtro é visível mas defaulted; cliente pode mudar (RBAC server-side é a
  próxima iteração)."

**Trocar para** `gestao-imunizacao-municipio-220850`.

- "Visão municipal — todos os gráficos focados no escopo da UBS local."
- "Ranking municipal não aparece (só 1 município = sem comparação)."
- "Aqui o ACS / coordenador da UBS resolve o dia."

### Ato 5 — Como é construído (4 min)

Slide com o pipeline (do `EXPLICACAO_DASHBOARD.md` seção 3):

```
RNDS / FHIR → silver1 → silver2 → silver3 → intermediate → gold → Superset
```

Pontos a falar (~30s cada):

1. **Átomo `int_imm_child_rule_status_daily`** — 1 linha por criança × regra
   × dia. 1,2M linhas/dia no piloto. Status calculado por
   janela etária do PNI. É a base de tudo, mas tem PII — fica restrito ao
   dbt.
2. **Gold `operational_backlog_daily`** — agrega o átomo removendo PII.
   Alimenta KPIs, backlog por vacina/UBS, cobertura.
3. **Gold `priority_daily_v2`** — score 0-1 ponderado (35% atraso %, 25%
   volume, 15% tendência 7d, etc.) + classificação + recomendação.
4. **Gold `dropout_by_series_v2`** — taxa de abandono entre doses
   sucessivas, com salvaguarda para coortes pequenas.
5. **Gold `data_quality_daily`** — registros suspeitos + freshness, com
   severity e PT-BR.

**Slogan**: *"Dado bruto vira número, número vira decisão."*

### Ato 6 — Roadmap (2 min)

| Quando | O quê |
|--------|-------|
| Próxima sprint | RBAC server-side por scope (row-level security) |
| Próxima sprint | Padronizar `state_name` em todos marts (parcialmente já no PR de fix) |
| Backlog | Choropleth real com geolocalização |
| Backlog | Backfill `team_id` / `microarea_code` no bronze RNDS |
| Backlog | Componente `low_registry_gap` no priority score (precisa população esperada IBGE) |

---

## Q&A — Perguntas prováveis + respostas

**Q: "Por que `applied + overdue + due + upcoming` não soma 100%?"**
> A: Crianças `future` (fora da janela ainda) e `not_applicable` (passaram
> do `abandon_after_days`) ficam fora do denominador de cobertura. É
> intencional. Veja seção 4 do `EXPLICACAO_DASHBOARD.md`.

**Q: "O score de prioridade compara entre municípios — funciona com 1 só?"**
> A: Não. Por isso o gráfico `priority_ranking` só aparece nos dashboards
> internal e estadual. Na visão municipal o score perderia sentido (tudo
> normaliza para 0 ou 1).

**Q: "E se um cliente municipal mudar o filtro pra ver outro município?"**
> A: Hoje ele consegue (filtro está "visible but defaulted"). RBAC
> server-side por scope é a próxima iteração — vai bloquear dado no
> backend independente do filtro.

**Q: "Os dados estão atualizados de quanto em quanto tempo?"**
> A: Refresh do dashboard a cada 5 min. Pipeline RNDS roda ~1×/hora
> (intermediate diário). KPI freshness mostra o tempo real da última
> ingestão.

**Q: "Por que `team_id` está NULL? Era pra mostrar por equipe."**
> A: Bronze RNDS atual não traz esse campo. Tem TODO no SQL do átomo.
> Backfill depende de ajuste na extração do RNDS — está no roadmap.

**Q: "Qual a diferença entre `dropout_rate` e `effective_dropout_rate`?"**
> A: `dropout_rate` é cru — se coorte tem 3 crianças, pode dar 100%.
> `effective_dropout_rate` é NULL quando `applied_from_count < 30`. Use o
> effective nos gráficos pra evitar alarme falso.

**Q: "Por que município 'UNKNOWN' aparece com casos? É bug?"**
> A: Não — é registro RNDS sem `endereco_municipio` resolvido. O KPI
> v2.18 (só interno) mostra o volume. Aciona o time de dados quando passa
> de 5% do total.

**Q: "Posso adicionar uma cidade nova? Como?"**
> A: Insert no `governance.municipality_activation` via Django admin com
> `status = 'active'` ou `'staging'`. No próximo run de
> `bootstrap_via_api.py --version per-muni`, o dashboard novo aparece
> automaticamente.

**Q: "Esses números batem com o que a Secretaria de Saúde tem?"**
> A: Use os números do `validation_queries.sql` (#5 top-10 overdue) para
> conferir com o gestor antes da review. Se divergir > 10%, é sinal de
> dedup faltando ou janela de ingestão diferente.

---

## Plano de contingência

| Cenário | Plano B |
|---------|---------|
| Dashboard fora do ar | Usar screenshots na pasta `demo/` |
| Freshness > 60 min | Mencionar como issue conhecida, mostrar como o KPI alerta |
| Chart vazio | Pular para o próximo, voltar no Q&A |
| Pergunta técnica que não souber | "Boa pergunta — tenho documentado em `EXPLICACAO_DASHBOARD.md`, posso te mandar agora" |
| Wifi cai | `validation_queries.sql` + slides já bastam para sustentar |

---

## Material de apoio (compartilhar com o time)

- [`EXPLICACAO_DASHBOARD.md`](EXPLICACAO_DASHBOARD.md) — documentação completa
- [`validation_queries.sql`](validation_queries.sql) — queries de sanity check
- [`README.md`](README.md) — manual de provisionamento (para devs)
- PR dbt: `https://github.com/PortalTelemedicina/ptm-dw-modeling/pull/469`
- PR Superset: ainda não aberto (segue local-first até a review)
