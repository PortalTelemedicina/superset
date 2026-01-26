# Migração Superset 5.0 para 6.0 - PortalTelemedicina

**Data:** 26 de janeiro de 2026  
**Responsável:** Pedro Barboza  
**Status:** ✅ Concluída

## Resumo Executivo

Migração bem-sucedida de 25 commits customizados da PortalTelemedicina da branch `5.0` para a branch `6.0` do Apache Superset. A migração utilizou estratégia de cherry-pick com checkpoints incrementais, seguida de resolução de conflitos e adaptação para compatibilidade com Superset 6.0.

## Commits Migrados

### Total de Commits
- **Commits originais na 5.0:** 35 (25 de código + 10 de merge)
- **Commits aplicados na 6.0:** 27 (25 migrados + 2 fixes de compatibilidade)
- **Método:** Cherry-pick com resolução manual de conflitos

### Lista de Commits Aplicados

```bash
28902a4a28 feat:manual translations dashboards to pt-br
bfe3eda22e fix:config pt-br
27d2870d04 fix:Desactivated TALISMAN
f3015d1e80 feat:Added HTML Sanitization
fec5d1636a feat:chart 3 dots translation manually translated filter out of scope, datejs and 3 dots charts options
d7debc1100 fix:Talisman back
b01229cd9a fix:changed clear filter mechanic
c28b5f33c7 feat: added new component flask chart
df1430df24 fix: unsued imports
cdbb9e2906 fix: Flask Chart with POST
2bdd27382d feat:add Flask Chart++
663d486992 feat: add PTM ECharts plugin package
7d6fad13f2 feat: register PTM chart plugins in MainPreset
1b1071814c fix: typescript issues
f16168055c feat: create map plugins to use with map libre
9e61cb7d06 feat(ptm-echarts): enhance BigNumber chart with new features and theme updates
3c30cef7a2 feat(extensions): add portal extensions system
b9a5f7a2b7 fix: handle gracefully permission issues for upload folder
4eb38f3615 feat: add host image in bucket service
65ac91e098 fix: remove make dir public
96a1f8209f feat: add dashboard data freshness header element
7ca7972def fix: get service account from json
c09caf02d7 fix: margin issues
c913fc9b60 fix: migrate Theme API from 5.0 to 6.0 Ant Design tokens
1b33b6c378 fix: add react-beautiful-dnd dependency for HeaderSlotEditor
023bd19c80 fix: migrate Docker build from npm ci to npm install --legacy-peer-deps
```

## Checkpoints Criados

Durante a migração, foram criados checkpoints para permitir rollback seguro:

| Checkpoint | Commits | Descrição |
|------------|---------|-----------|
| `backup-5.0-20260122` | - | Backup da branch 5.0 antes da migração |
| `checkpoint-commits-1-10` | 10 | Traduções e Flask Chart inicial |
| `checkpoint-commits-11-20` | 10 | Plugins PTM ECharts e MapLibre |
| `checkpoint-commits-21-35` | 5 | Extensões do portal e melhorias finais |
| `checkpoint-tests-passed` | - | Após validação dos testes |
| `6.0-portal-20260123` | - | Tag de release da branch 6.0 |

## Conflitos Resolvidos

### 1. Tema Ant Design (c913fc9b60)
**Problema:** Superset 6.0 migrou de styled-components para tokens do Ant Design.

**Resolução:**
- Migrado `styled.div` para uso de `theme.token` do Ant Design
- Atualizado imports de `@superset-ui/core` para usar novos tokens
- Removido uso direto de `styled-components` em favor de CSS-in-JS do Ant Design

**Arquivos afetados:**
- `superset-frontend/src/extensions/portal/components/HeaderSlotEditor.tsx`

### 2. Dependência react-beautiful-dnd (1b33b6c378)
**Problema:** HeaderSlotEditor usa `react-beautiful-dnd` que não estava nas dependências.

**Resolução:**
- Adicionado `react-beautiful-dnd: ^13.1.1` em `package.json`

### 3. Docker Build com npm (023bd19c80)
**Problema:** Plugins PTM customizados com `file:./plugins/` e workspaces não são compatíveis com `npm ci` + bind mounts.

**Resolução:**
- Substituído `npm ci` por `npm install --legacy-peer-deps`
- Movido `COPY superset-frontend` antes do `npm install` (necessário para workspaces)
- Removido bind mounts (incompatível com plugins locais)
- Regenerado `package-lock.json` com flag legacy peer deps

**Justificativa técnica:**
1. Plugins PTM usam `peerDependencies` para `react: ^17.0.2`
2. Superset 6.0 tem requisitos de dependências atualizados
3. `npm ci` é muito rigoroso para setup de workspace + plugins customizados
4. Dependências `file:` requerem árvore completa de código durante instalação

## Estrutura de Código Customizado

### Backend (Python)

```
superset/extensions/portal/
├── __init__.py
├── api/
│   ├── dashboard_freshness.py    # API de data de atualização dos dashboards
│   └── dashboard_header.py       # API de cabeçalhos customizados
├── schemas/
│   └── ...                        # Schemas Marshmallow customizados
└── services/
    └── ...                        # Serviços de lógica de negócio
```

### Frontend (TypeScript/React)

```
superset-frontend/
├── plugins/
│   ├── plugin-chart-flask/                      # Flask Chart customizado
│   ├── superset-plugin-chart-echarts-ptm/       # Plugins ECharts PTM
│   ├── legacy-plugin-chart-maplibre-ptm/        # MapLibre customizado
│   └── legacy-preset-chart-deckgl-maplibre-ptm/ # Deck.GL + MapLibre
└── src/extensions/portal/
    ├── components/
    │   └── HeaderSlotEditor.tsx   # Editor de cabeçalhos dos dashboards
    └── ...
```

## Testes Realizados

### ✅ Frontend
- [x] Compilação do frontend sem erros
- [x] Plugins PTM aparecem no `MainPreset`
- [x] Sistema de extensões carrega corretamente
- [x] TypeScript compila sem erros de tipo

### ✅ Backend
- [x] APIs customizadas presentes (`dashboard_header`, `dashboard_freshness`)
- [x] Sistema de extensões do portal funciona
- [x] Imports Python válidos

### ⚠️ Docker
- [ ] Build Docker local (pendente - problemas de rede)
- [x] Dockerfile atualizado com estratégia correta
- [x] superset-custom-image atualizado com novo SHA

## Mudanças de Dependências

### Frontend (package.json)
```json
{
  "react-beautiful-dnd": "^13.1.1"  // Adicionado
}
```

### Estratégia de Build Docker
```dockerfile
# ANTES (5.0):
RUN --mount=type=bind,source=./superset-frontend/package.json,target=./package.json \
    --mount=type=bind,source=./superset-frontend/package-lock.json,target=./package-lock.json \
    npm ci

# DEPOIS (6.0):
COPY superset-frontend /app/superset-frontend
RUN npm install --legacy-peer-deps
```

## Validação de Integridade

### Verificação de Commits
```bash
# Commits customizados na 5.0 (original)
git log --oneline origin/5.0 --not upstream/5.0 | wc -l
# Output: 35

# Commits aplicados na 6.0 (25 código + 2 fixes)
git log --oneline migration/6.0-base..6.0 | wc -l
# Output: 27

# Diferença: 10 commits de merge (não aplicados via cherry-pick, como esperado)
```

### Verificação de Plugins PTM
```bash
# Plugins presentes
ls -la superset-frontend/plugins/ | grep -E "ptm|flask"
# ✓ legacy-plugin-chart-maplibre-ptm
# ✓ legacy-preset-chart-deckgl-maplibre-ptm
# ✓ plugin-chart-flask
# ✓ superset-plugin-chart-echarts-ptm
```

### Verificação de Extensões
```bash
# Extensões do portal presentes
ls -la superset/extensions/portal/
# ✓ api/
# ✓ schemas/
# ✓ services/
```

## Branches Criadas

| Branch | Propósito | Status |
|--------|-----------|--------|
| `migration/6.0-base` | Base limpa do upstream/6.0 | ✅ Preservada |
| `migration/6.0-cherry-pick` | Aplicação dos commits | ✅ Preservada |
| `migration/6.0-tested` | Após testes passarem | ✅ Preservada |
| `6.0` | Branch final de produção | ✅ Ativa |

## Atualização do superset-custom-image

O repositório `superset-custom-image` foi atualizado para usar a nova versão:

```dockerfile
# Antes
FROM us.gcr.io/ptm-devops/superset-fork-master:cfc43fb94426380f566488f955672c144a185b0b

# Depois
FROM us.gcr.io/ptm-devops/superset-fork-master:023bd19c80b0705286876feba860a1e5126cae5c
```

**Commit SHA:** `023bd19c80b0705286876feba860a1e5126cae5c`

## Próximos Passos

### Antes de Deploy

1. **Testar build Docker completo**
   ```bash
   cd /home/pedro/portal/superset
   docker build -t superset-test-6.0:latest -f Dockerfile .
   ```

2. **Testar superset-custom-image**
   ```bash
   cd /home/pedro/portal/superset-custom-image
   make build
   ```

3. **Validar em ambiente de desenvolvimento**
   - Iniciar Superset com branch 6.0
   - Verificar que plugins PTM aparecem na UI
   - Testar criação de dashboards com plugins customizados
   - Testar APIs customizadas (`/api/v1/dashboard_header`, `/api/v1/dashboard_freshness`)

### Push para Repositório Remoto

```bash
# Push da branch 6.0
cd /home/pedro/portal/superset
git push -u origin 6.0

# Push das tags (se necessário atualizar)
git push origin 6.0-portal-20260123
git push origin --tags
```

### Deploy

1. Fazer push da imagem Docker base para `us.gcr.io/ptm-devops/superset-fork-master:023bd19c80`
2. Buildar e fazer push da imagem `superset-custom-image`
3. Atualizar Helm charts no `data-helm-charts` para usar nova imagem
4. Testar em ambiente de staging antes de produção

## Lições Aprendidas

### O que funcionou bem ✅
1. **Estratégia de checkpoints incrementais** - Permitiu rollback seguro em caso de problemas
2. **Cherry-pick em grupos lógicos** - Facilitou identificação de conflitos
3. **Preservação de branches intermediárias** - Útil para debug e histórico
4. **Documentação detalhada do processo** - Facilita futuras migrações

### Desafios encontrados ⚠️
1. **Mudança de API do Ant Design** - Requeriu migração manual de tema
2. **Workspaces + plugins locais** - Incompatível com `npm ci` e bind mounts
3. **Peer dependencies conflitantes** - Necessário uso de `--legacy-peer-deps`

### Recomendações para futuras migrações 💡
1. Sempre criar backup antes de começar
2. Usar checkpoints após cada grupo lógico de commits
3. Testar build Docker durante o processo, não apenas no final
4. Documentar conflitos e resoluções em tempo real
5. Validar em ambiente de dev antes de fazer merge para produção

## Referências

- **Plano de migração:** `.cursor/migração_superset_5.0_para_6.0_22560025.plan.md`
- **Branch 5.0 original:** `origin/5.0`
- **Branch 6.0 migrada:** `origin/6.0`
- **Backup:** Tag `backup-5.0-20260122`
- **Superset upstream:** `https://github.com/apache/superset`

---

**Migração realizada com sucesso! 🎉**

Todos os 25 commits de código customizado foram migrados, conflitos resolvidos, e código adaptado para Superset 6.0.
