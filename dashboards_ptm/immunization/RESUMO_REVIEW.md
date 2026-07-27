# Imunização — Resumo para a review

**Cocal/PI · 27/07/2026 · dados da RNDS ingeridos às 12:42 de hoje**

---

## O painel em quatro números

| | |
|---|---|
| **6.726** crianças ≤15 anos | 84% moram em Cocal, 16% vêm de outros municípios |
| **77,5%** de cobertura estimada | 1.514 crianças com ao menos uma dose em atraso |
| **4 unidades** concentram ~metade da fila | São Francisco lidera com 786 doses (17,6%) |
| **3.950** inconsistências em 90 dias | quase todas de idade mínima; duplicidade é rara |

---

## O que o painel habilita decidir

- **Busca ativa** — fila por unidade de saúde, com nome e tamanho
- **Compra de insumo** — demanda projetada por vacina e por mês, 12 meses à frente
- **Auditoria de registro** — inconsistência localizada por vacina, dose e unidade

---

## Atendido desde o último feedback

- Meningocócica com 97% de abandono: **corrigido**, hoje lê 16,2% sobre 2.852 crianças
- Atrasadas em vermelho, com percentual, no gráfico de pontualidade
- Célula vazia agora mostra `N/A` em vez de branco ou zero
- Séries de vacinas com cores distintas (antes, tudo em tons de azul)
- Card de frescor no horário de Brasília

---

## Em aberto, com causa identificada

| Item | O quê | Onde está |
|------|-------|-----------|
| **G5** | Abandono cobra dose que ainda não venceu para a coorte (VIP `R1` e SCRV `DU` em 99,9%) | `specs/imunizacao/3. tasks.md` |
| **G6** | Taxa de abandono é média de percentuais, não ponderada por volume | idem |
| **G7** | Influenza é revacinação anual tratada como série (96,6%) | idem |
| — | Ingestão automática bloqueada por IP na RNDS; carga de hoje via contorno manual | `docs/runbooks/` |

---

## Para ir a produção

Cores entram só rodando o bootstrap. `N/A` e cor condicional dependem de rebuild
de imagem. Fuso do card exige patch no dataset. Correção do abandono é mudança de
modelo dbt sob o ciclo SDD.
