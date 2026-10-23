<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Importação de usuários em massa

Botão "Importar" na Lista de Usuários para criar vários usuários de uma vez a partir de um CSV ou XLSX. Só Admin, atrás da feature flag `PTM_USER_IMPORT` (desligada por padrão).

O arquivo é lido e validado inteiro no servidor. A tela só envia o arquivo e mostra o resultado. Nada do arquivo é gravado em disco ou em tabela: a senha existe em memória durante a requisição.

## Flag, permissão e configuração

| Item | Valor |
|---|---|
| Flag | `PTM_USER_IMPORT`, em `DEFAULT_FEATURE_FLAGS`, default `False`. Em ambiente, `SUPERSET_FEATURE_PTM_USER_IMPORT=true` |
| Permissão | `can_import_users` na view `User`. Só a role Admin recebe (`User` está em `ADMIN_ONLY_VIEW_MENUS`) |
| Rota | `POST /api/v1/security/users/import` (`multipart/form-data`) |

Chaves em `superset/config.py`, sobrescrevíveis no `superset_config.py`:

| Chave | Default | Efeito |
|---|---|---|
| `PTM_USER_IMPORT_MAX_BYTES` | 1 MiB | Tamanho máximo do arquivo |
| `PTM_USER_IMPORT_MAX_ROWS` | 500 | Máximo de linhas de dados |
| `PTM_USER_IMPORT_ALLOWED_ROLES` | `[]` | Vazio: qualquer role exceto Admin. Preenchido: somente as listadas |
| `PTM_USER_IMPORT_MIN_PASSWORD_LENGTH` | 8 | Tamanho mínimo da senha (o máximo é 128) |
| `PTM_USER_IMPORT_PLAN_TTL_SECONDS` | 900 | Validade da pré-visualização para confirmar |

A role Admin é barrada sempre, mesmo que esteja na lista de permitidas. O import nunca cria role.

### Depois do deploy: rodar `superset init`

A permissão `can_import_users` só nasce no `superset init` (job `init-db`), que também a atribui ao Admin. Sem isso, o Admin recebe 403 mesmo com a flag ligada. Rodar o `init-db` em PRD é mudança de produção.

Com a flag desligada, a rota responde 404 para Admin e o botão não aparece. Quem não é Admin recebe 403 (a checagem de permissão vem antes da flag) e anônimo recebe 401.

## Formato do arquivo

- Extensão `.csv` ou `.xlsx`.
- CSV: UTF-8 (com ou sem BOM), com fallback para cp1252; separador `,` ou `;` detectado pelo cabeçalho.
- XLSX: só a primeira planilha, lida em modo somente leitura.
- Primeira linha é o cabeçalho. Linhas totalmente vazias são ignoradas, e o número de linha reportado é o da linha física do arquivo (cabeçalho = linha 1).
- Colunas desconhecidas são ignoradas.

Cabeçalhos aceitos, sem diferenciar caixa, acento ou espaços:

| Campo | Cabeçalhos | Obrigatório |
|---|---|---|
| Nome | `NOME` | sim |
| Usuário | `USUÁRIO`, `USUARIO`, `CPF`, `USERNAME` | sim |
| Senha | `SENHA` | sim |
| E-mail | `E-MAIL`, `EMAIL` | sim |
| Role | `ROLE`, `PERFIL` | não |

Exemplo (sintético):

```csv
NOME,USUÁRIO,SENHA,E-MAIL,ROLE
MARIA DA SILVA,012.345.678-90,Senha@2026,maria@example.com,
JOÃO D'ÁVILA,01234567891,Chave#Forte1,joao@example.com,Gamma
```

### Limites

| Limite | Valor | Resposta |
|---|---|---|
| Tamanho do arquivo | `PTM_USER_IMPORT_MAX_BYTES` | 413 |
| Linhas de dados | `PTM_USER_IMPORT_MAX_ROWS` | 422 |
| Arquivo sem linhas de dados | pelo menos 1 | 422 |
| Célula | 1000 caracteres | a linha fica segurada (`celula_muito_longa`) |
| XLSX | até 20 MiB descomprimido, 200 entradas no zip e 50 colunas lidas | 422 |
| Username | 128 caracteres | linha segurada |
| Nome e sobrenome | 64 caracteres cada | linha segurada |
| E-mail | 320 caracteres | linha segurada |

O Content-Length é conferido com folga de 64 KiB sobre o limite, para cobrir o multipart. O limite exato é conferido na leitura do arquivo. Multipart sem Content-Length (chunked) é recusado com 411 antes de o corpo ser parseado, porque o werkzeug mandaria o upload inteiro para disco. Não há `MAX_CONTENT_LENGTH` global: o limite de body do ingress continua sendo a defesa contra corpos grandes e precisa ser conferido no deploy.

No XLSX o limite de linhas vale só para linhas de dados (não vazias). Linhas vazias, como formatação residual abaixo dos dados, são ignoradas até o limite físico do Excel (1.048.576 linhas).

## Normalização e validação

| Campo | Regra |
|---|---|
| Usuário | Sempre texto, zeros à esquerda preservados. `strip`. CPF formatado (`###.###.###-##`) perde pontos e traço. Aceita `[0-9A-Za-z._@-]`. Nunca completa zeros sozinho |
| Chave canônica | Minúsculas e sem zeros à esquerda (`00123` e `123` são o mesmo usuário). Minúsculas porque o login do FAB não diferencia caixa. Usada para achar duplicidade no arquivo e no banco |
| Nome | Só reformata se vier todo em maiúsculas ou todo em minúsculas (Title Case, com `da de do das dos e` em minúsculas fora da primeira posição, tratando apóstrofo e hífen). Caixa mista é preservada. `first_name` é a primeira palavra e `last_name` é o resto. Uma palavra só segura a linha |
| E-mail | `strip`, minúsculas, formato validado |
| Role | A da coluna ROLE/PERFIL se vier preenchida, senão a role padrão escolhida na tela. O usuário é criado com exatamente uma role. Nome exato |

### Senha

- Normalizada para ASCII: acentos são removidos (`Açaí#2026` vira `Acai#2026`). Quando a senha efetiva difere da do arquivo, a linha leva um aviso na pré-visualização, e o usuário precisa entrar com a versão sem acento.
- Depois da normalização só entra ASCII imprimível (espaço interno é aceito, espaço ou tab nas pontas não). Emoji e outros caracteres fora disso seguram a linha.
- Tamanho entre `PTM_USER_IMPORT_MIN_PASSWORD_LENGTH` e 128.
- Se `FAB_PASSWORD_COMPLEXITY_ENABLED` estiver ligado, a complexidade do FAB também é exigida.
- Linha sem senha válida fica segurada. Não há geração de senha temporária.
- A senha nunca aparece em resposta, relatório, log, auditoria ou mensagem de erro. O hash é feito pelo `add_user` do FAB.

## Resultado por linha

Status:

| Status | Significado |
|---|---|
| `criar` | Seria criada (só na pré-visualização) |
| `criado` | Criada (só na confirmação) |
| `ja_existe` | Já cadastrada. Nada é alterado |
| `segurada` | Não processada por algum problema da linha ou do cadastro. Nada é alterado |
| `falha` | Erro na gravação |

Códigos de motivo (`reason`):

| Código | Status | Situação |
|---|---|---|
| `duplicado_no_arquivo_username` | segurada | Mesmo usuário canônico em mais de uma linha |
| `duplicado_no_arquivo_email` | segurada | Mesmo e-mail em mais de uma linha |
| `existe_username` | ja_existe | Username já cadastrado |
| `existe_sem_zero_a_esquerda` | ja_existe | Cadastrado com username que difere só por zeros à esquerda (nos dois sentidos). O `existing_username` mostra qual |
| `existe_email` | ja_existe | E-mail já cadastrado |
| `existe_inativo` | segurada | O usuário existente está inativo |
| `conflito_com_varios_existentes` | segurada | Os acertos apontam para usuários diferentes, ou o e-mail casa com mais de um |
| `campo_obrigatorio:<campo>` | segurada | Campo vazio (`nome`, `usuario`, `senha`, `email`) |
| `email_invalido` | segurada | Formato de e-mail inválido |
| `senha_invalida` | segurada | Vazia, curta, longa, com caractere fora de ASCII imprimível, com espaço nas pontas, ou que não passa na complexidade do FAB |
| `role_invalida` | segurada | Role da linha não existe |
| `role_nao_permitida` | segurada | Role fora da lista permitida, ou Admin |
| `nome_incompleto` | segurada | Nome com uma palavra só (o FAB exige sobrenome) |
| `nome_muito_longo` | segurada | Primeiro nome ou sobrenome acima de 64 caracteres |
| `username_invalido` | segurada | Mais de 128 caracteres ou caractere não aceito |
| `celula_muito_longa` | segurada | Alguma célula com mais de 1000 caracteres |
| `erro_criacao` | falha | Falha ao gravar. A causa técnica fica só no log do servidor, com o `audit_id` |

Quando uma linha tem mais de um problema, o motivo principal segue esta prioridade: duplicidade no arquivo, depois validação, depois cadastro existente. Os outros vão em `secondary_reasons`.

Duplicidade no arquivo segura todas as linhas envolvidas, inclusive linhas idênticas, com `related_lines`. A ligação é transitiva: A e B pelo CPF e B e C pelo e-mail seguram as três.

Se o `ja_existe` por zeros à esquerda pegar um username que não é CPF, é um falso positivo conhecido e inofensivo: nada é alterado e o `existing_username` fica visível.

## Fluxo da tela

1. **Arquivo e role.** Escolher o arquivo (`.csv` ou `.xlsx`) e a role padrão. A role é obrigatória e nunca vem pré-selecionada. Admin não aparece na lista.
2. **Pré-visualização.** Roda o dry-run: tabela com linha, usuário, e-mail, nome, role, status e motivo, contadores e filtro por status. Nada foi criado. "Confirmar" só habilita com pelo menos uma linha `criar` e exige digitar o número de usuários a criar. Trocar o arquivo ou a role exige nova pré-visualização.
3. **Resultado.** Contadores finais e botão "Baixar relatório (CSV)".

Por trás, a confirmação reenvia o mesmo arquivo com o `plan_token` da pré-visualização. O servidor valida o token e recalcula o plano inteiro, sem confiar no preview. O token é assinado (HMAC com `SECRET_KEY`), amarrado ao usuário, ao hash do arquivo e à role padrão, e vale `PTM_USER_IMPORT_PLAN_TTL_SECONDS`. Token ausente, inválido, expirado ou de outro arquivo, usuário ou role dá 409. Fechar o modal descarta arquivo, token e respostas da memória.

O relatório CSV é gerado no navegador a partir da resposta. Não tem coluna de senha, mantém o username como texto e prefixa com `'` as células que o Excel leria como fórmula (`=`, `+`, `-`, `@`, tab, CR).

### Erros da API

| HTTP | Caso |
|---|---|
| 400 | Arquivo ausente, extensão inválida, colunas obrigatórias ausentes (`missing_columns`), role padrão inexistente ou barrada, `dry_run` inválido, requisição que não é multipart, CSRF ausente ou inválido |
| 401 / 403 | Não autenticado / sem `can_import_users` |
| 404 | Flag desligada |
| 409 | `plan_token` ausente, inválido ou expirado |
| 411 | Requisição sem Content-Length (upload chunked) |
| 413 | Arquivo acima do limite de bytes |
| 422 | Acima do limite de linhas, arquivo vazio, encoding não reconhecido, arquivo ilegível |

A rota valida o CSRF por conta própria (sessão com `X-CSRFToken`): o blueprint da API de usuários do FAB é isento do CSRFProtect. Só um Bearer JWT que passa na verificação dispensa o token; o cabeçalho `Authorization` sozinho, com sessão por cookie, não.

## Auditoria

Cada requisição (pré-visualização e confirmação, inclusive as que terminam em 4xx) gera um registro no log de eventos do Superset, ação `SupersetUserApi.import_users`. Sem tabela nova e sem migração. Campos extras:

- `audit_id`, `actor`, `ip`, `dry_run`, `default_role`
- `file_name`, `file_sha256`, `file_size`
- `summary` (contagens por status), `duration_ms`, `status_code`, `error`
- `rows`: só as linhas seguradas ou com falha na confirmação, com número, username mascarado (3 primeiros e 2 últimos caracteres), status e motivo. O dry-run não grava linhas, e as criadas ficam só nas contagens do `summary`
- `ignored_fields`: nomes dos campos fora do contrato que vieram na requisição

O `audit_id` volta na resposta da confirmação e aparece nos logs de erro do servidor. O `plan_token` e o valor de qualquer campo fora do contrato são mascarados (nomes que colidem com parâmetros do event_logger, como `action` e `duration`, só entram em `ignored_fields`). Em erro 5xx inesperado, o log guarda só o tipo da exceção, porque a mensagem do banco pode trazer valores da linha.

## Limitações conhecidas

- **Importação parcial por linha.** Cada usuário é criado com commit próprio. Se uma linha falha, as anteriores ficam criadas e o relatório diz o que aconteceu com cada uma. Reenviar o mesmo arquivo é seguro: o que já existe volta como `ja_existe`.
- **Sem reativação de inativos.** Usuário inativo existente fica `segurada` com `existe_inativo`. O import nunca reativa nem troca senha de ninguém.
- **XLSX pode perder zeros.** Se o Excel gravou o CPF como número, o zero à esquerda já se perdeu antes de chegar aqui. A célula numérica vira texto e a resposta traz o aviso `username_numerico_xlsx`, sem completar zeros. Preferir CSV, ou formatar a coluna como texto.
- **Sem geração de senha.** Linha sem senha válida não é criada.
- **CSV de origem com senhas.** O arquivo continua em texto puro na máquina de quem importou. Apagar depois do uso.
- **Tempo.** O hash de senha é síncrono por linha, então 500 linhas podem levar dezenas de segundos. Conferir o timeout do gunicorn e do ingress; o tempo real em lote ainda precisa ser medido no DEV.
- **Rate limit.** O do Superset só vale em produção e é por worker, então não é controle forte. Valem a permissão restrita, os limites e a auditoria.
- **Seletor de role.** O front não conhece `PTM_USER_IMPORT_ALLOWED_ROLES`: com a allowlist preenchida o operador ainda pode escolher uma role recusada, e o erro 400 aparece no preview. Só `Admin` (sem diferenciar caixa) é escondida do seletor.
- Sem CLI e sem execução assíncrona nesta versão.

## Rollout

Nada em PRD sem confirmação.

1. Build da imagem e deploy em DEV via GitOps, com a flag desligada.
2. Rodar `superset init` (job `init-db`) para criar `can_import_users` e atribuir ao Admin.
3. Ligar a flag só em DEV, por GitOps (`SUPERSET_FEATURE_PTM_USER_IMPORT`), não por mudança manual.
4. Validar com CSV sintético (item da seção C de [SMOKE_TESTS.md](SMOKE_TESTS.md)), nunca com o arquivo real de usuários.
5. Medir o tempo de um lote grande e conferir os limites de body do ingress.
6. PRD: `init-db` e depois a flag, cada um com confirmação. Com a flag desligada por padrão, liberar depois.

Para reverter, desligar a flag. Os usuários já criados permanecem.

Pontos tocados no upstream e arquivos novos: [PATCH_INDEX.md](PATCH_INDEX.md).
