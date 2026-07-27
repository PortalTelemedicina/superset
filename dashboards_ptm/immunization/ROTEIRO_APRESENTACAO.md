# Roteiro de apresentação — Gestão de Imunização (Cocal/PI)

Documento de apoio para conduzir a demonstração e interpretar cada gráfico.
Números conferidos em **27/07/2026**, com dados da RNDS ingeridos às **12:42** do
mesmo dia.

- **URL**: `http://localhost:8088/superset/dashboard/gestao-imunizacao-municipio-220270/`
- **Duração sugerida**: 12 a 15 minutos, seguindo a ordem das seções
- **Cache**: aquecido, válido até ~18h20. Rolar entre seções é instantâneo

---

## Antes de começar

Três avisos operacionais para você, não para a plateia:

1. **Não troque filtro no meio de uma explicação.** Filtro novo sai do cache e
   consulta o BigQuery: são 30 a 60 segundos de tela parada. Se precisar demonstrar
   filtro, avise que vai recarregar e faça uma vez só, no fim.
2. **O selo "Development"** no topo é do ambiente local. Se perguntarem, é o
   ambiente de homologação com os dados reais de produção.
3. A leitura sobe do panorama para o detalhe: quantas crianças existem, quanto
   está coberto, o que está atrasado, quem atende, o que vem pela frente, onde há
   abandono e, por fim, se o dado é confiável.

---

## Três regras de leitura que valem para o painel inteiro

Explique isso uma vez, no começo, e você evita metade das perguntas.

**Célula com `N/A` não é zero.** Significa que aquela combinação de vacina e dose
não existe no calendário, ou que a base de crianças é pequena demais (menos de 30)
para um percentual confiável. Zero significaria "ninguém tomou", que é uma
afirmação bem diferente.

**As cores seguem a semântica do indicador, não a estética.** Vermelho é sempre o
lado ruim: atraso, abandono, inconsistência. Verde é o lado bom. Em gráficos com
várias séries, cada categoria tem um matiz próprio para que se possa distinguir
uma da outra.

**Os filtros da esquerda propagam para todos os gráficos.** O painel já vem
travado em Piauí e Cocal; os demais filtros são opcionais e servem para recortar
uma vacina, uma unidade ou uma faixa etária específica.

---

## Seção 1 — Panorama populacional

![Panorama populacional e cobertura](roteiro-assets/01-panorama-cobertura.png)

**O que responde:** de quem estamos falando.

**Como ler:** são 6.726 crianças de até 15 anos com histórico de vacinação
registrado no município. Desse total, 5.653 (84%) moram em Cocal e 1.073 (16%)
vieram de outros municípios se vacinar aqui.

**O ponto que vale destacar:** esses 16% são a razão de o painel separar dois
olhares. Indicadores operacionais, como fila e carga de trabalho, contam por
**unidade que atende** — porque é ela que precisa de vacina e de pessoal.
Indicadores de cobertura contam por **município de residência** — porque a meta
sanitária é da população que mora ali. Sem essa separação, ou a unidade parece
sobrecarregada sem motivo, ou o município parece descoberto sem motivo.

**Frase pronta:** *"Cocal atende mais crianças do que tem. Uma em cada seis que
passam pelas unidades mora em outro município, e o painel trata as duas coisas
separadamente."*

---

## Seção 2 — Cobertura vacinal

**O que responde:** quanto do calendário está cumprido.

**Como ler:** a cobertura global estimada é de **77,5%**, o que corresponde a
5.212 crianças em dia. Na outra ponta, **1.514 crianças (22,5%)** têm ao menos uma
dose em atraso. As 59.897 doses aplicadas são o volume histórico do calendário.

Abaixo dos cartões, a **matriz de cobertura por vacina × dose** abre esse número
único: cada linha é uma vacina, cada coluna é uma dose, e a cor indica o quão
distante está da meta. É onde se vê que o problema raramente é a vacina inteira —
costuma ser uma dose específica, quase sempre um reforço.

**Cuidado:** é cobertura **estimada**. O denominador são as crianças com registro
no sistema, não a projeção populacional do IBGE. Se alguém comparar com o painel
do Ministério, os números não vão bater, e a explicação é essa.

**Frase pronta:** *"Setenta e sete e meio por cento de cobertura, com 1.514
crianças em atraso. A matriz abaixo mostra que o buraco não está espalhado: está
concentrado em doses de reforço."*

---

## Seção 3 — Doses em atraso e carga operacional

![Fila por unidade e carga de trabalho](roteiro-assets/02-backlog-ubs-carga.png)

**O que responde:** o que fazer amanhã de manhã, e quem faz.

**Como ler:** a fila do município está distribuída por 16 unidades de saúde. A
UBS São Francisco concentra **786 doses em atraso, 17,6% do total municipal**,
seguida por Mutirão com 518 e Ulisses com 489. Essa é a lista de prioridade de
busca ativa: quatro unidades respondem por quase metade da fila.

A tabela de carga de trabalho mostra o mesmo problema pela ótica do insumo: SCR
com 4,75 mil doses devidas, Febre Amarela com 4,2 mil, MenACWY com 3,24 mil. É o
que precisa estar na geladeira.

**Cuidado:** a coluna "A vencer" aparece zerada nessa visão. Se perguntarem,
não improvise causa — diga que o número de doses a vencer nos próximos 30 dias
está no cartão da seção (354) e que você confirma a diferença de recorte entre as
duas visões depois.

**Frase pronta:** *"A fila não está espalhada pelo município: quatro unidades
concentram quase metade. Isso transforma um problema de 4,4 mil doses em quatro
conversas objetivas com quatro gerentes."*

---

## Seção 4 — Fluxo entre municípios

**O que responde:** para onde vai e de onde vem a demanda.

**Como ler:** duas tabelas, uma com residentes de fora do estado por UF e outra
com os municípios vizinhos que mandam crianças para Cocal. É o detalhamento dos
16% da seção 1.

**Por que importa:** é argumento de financiamento. Se o município banca insumo e
equipe para atender crianças de fora, isso precisa estar visível e quantificado
na hora de negociar recurso.

---

## Seção 5 — Previsibilidade de doses

![Tendência e volumes da demanda programada](roteiro-assets/03-demanda-programada.png)

**O que responde:** quanta vacina comprar, e quando.

**Como ler:** a linha do tempo projeta os próximos doze meses para as cinco
vacinas de maior volume — MenACWY, DTP, Febre Amarela, SCRV e Varicela, cada uma
com sua cor. Logo abaixo, a matriz Mês/Ano traz o número exato por vacina e por
mês, que é o que se leva para a planilha de compra.

**Cuidado:** a projeção mostra apenas a demanda **programada**, ou seja, doses que
vão vencer no período. O acúmulo de atrasados não entra aqui, porque ele se
concentraria todo no mês corrente e achataria a curva; esse estoque está nos
cartões da seção 3.

**Frase pronta:** *"O gráfico mostra o ritmo mensal e a matriz dá o número exato.
Para MenACWY, por exemplo, a demanda fica entre 56 e 71 doses por mês no próximo
semestre — é com esse número que se monta o pedido."*

---

## Seção 6 — Abandono de séries vacinais

![Matriz de abandono e card de frescor](roteiro-assets/04-abandono-e-frescor.png)

**O que responde:** onde a criança começa o esquema e não termina.

**Como ler:** cada linha é uma vacina, cada coluna é a dose de origem, e o
percentual é quanto se perdeu entre aquela dose e a seguinte. Os casos saudáveis
e confiáveis são os de base grande: **Pentavalente D1 com 12,6%**, **VIP D1 com
12,4%** e **MenC D1 com 16,2%** — este último apurado sobre 2.852 crianças.

**Este é o gráfico mais delicado do painel. Leia a próxima seção antes de
apresentá-lo.**

---

## A pergunta difícil: "99,9% de abandono?"

Vai aparecer na tela, então é melhor você levantar o assunto antes que perguntem.

**O que está acontecendo.** Três células mostram abandono quase total: VIP `R1`
com 99,9%, SCRV `DU` com 99,9% e Influenza `DU` com 96,6%. Não é comportamento da
população, é artefato de cálculo. No caso da VIP, 1.160 crianças tomaram a dose de
origem e **uma** tomou a seguinte — o que nenhuma criança poderia ter feito,
porque a dose seguinte só é devida aos 4 anos de idade e a coorte tem 1 ano. O
modelo compara com uma dose que ainda não venceu. A Influenza é um caso à parte:
é revacinação anual, e o modelo trata a dose do ano seguinte como continuação de
série.

**Por que isso é uma boa notícia, e não uma má.** Na reunião de feedback, o
levantamento foi sobre a meningocócica com 97% de abandono no reforço, e a
suspeita levantada na ocasião estava certa: não é que ninguém tomou, é que a dose
não se aplicava. Esse caso **foi corrigido** — hoje a MenC lê 16,2% sobre uma base
real. O que restou é a mesma classe de problema em outras três células, já com
causa identificada, evidência anexada e correção especificada nos itens de
auditoria G5, G6 e G7.

**Frase pronta:** *"Vocês vão ver três células perto de 100%, e eu quero tratar
isso de frente. Não é abandono, é a régua errada: o modelo está cobrando uma dose
que só vence daqui a três anos. O caso que vocês apontaram na última reunião, o da
meningocócica, esse já foi corrigido e hoje lê 16,2% sobre 2.852 crianças. Os três
que sobraram estão auditados e especificados."*

**Se insistirem em prazo:** a correção exige cruzar a idade mínima da dose de
destino, que existe na tabela de calendário mas ainda não está no mart. É mudança
de modelo, com ciclo de especificação e reconstrução — não é ajuste de tela.

---

## Seção 7 — Qualidade e consistência dos dados

![Inconsistências por tipo](roteiro-assets/05-inconsistencias.png)

**O que responde:** posso confiar no que acabei de ver?

**Como ler:** são **3.950 inconsistências** detectadas nos últimos 90 dias, e a
última carga da RNDS entrou hoje às **12:42**. O gráfico de barras separa por tipo
de problema: em azul, dose aplicada antes da idade mínima; em verde, dose duplicada
no mesmo dia.

**O detalhe que vale explicar:** a série verde é minúscula de propósito — são de 1
a 3 casos por mês, contra 11 a 123 da azul. Duplicidade praticamente não existe
nesse município, e isso é um bom sinal de qualidade do registro. O volume está
concentrado em idade mínima, que é um problema de digitação ou de regra de
calendário na ponta, não de duplicação.

Abaixo, as mesmas inconsistências abrem por vacina × dose e por unidade de saúde,
o que transforma o número agregado em uma lista de conversas com unidades
específicas.

**Frase pronta:** *"Terminar pela qualidade do dado é proposital. O painel mostra
os próprios defeitos, com nome e endereço: 3.950 inconsistências, quase todas de
idade mínima, e é possível abrir por unidade para saber com quem falar."*

---

## Encerramento sugerido

Feche amarrando as três decisões que o painel habilita: **busca ativa** com nome
de unidade e tamanho de fila, **compra de insumo** com número por vacina e por mês,
e **auditoria de registro** com o defeito localizado. E deixe claro que o dado é do
dia — a carga da RNDS de hoje às 12:42 já está refletida em tudo que foi mostrado.

---

## Anexo: o que ainda não está em produção

Se perguntarem quando isso vai para o ar, os caminhos são diferentes por item:

| Item | Como vai para produção |
|------|------------------------|
| Cores distintas nas séries | Só rodar o bootstrap, sem rebuild de imagem |
| `N/A` em célula vazia e correção da cor condicional | Frontend — depende de rebuild de imagem |
| Fuso horário do card de frescor | Patch manual no dataset (o bootstrap não sincroniza expressão de métrica) |
| Correção do abandono (G5/G6/G7) | Mudança de modelo dbt sob o ciclo SDD |
| Ingestão automática diária | Depende da liberação do IP junto à RNDS |
