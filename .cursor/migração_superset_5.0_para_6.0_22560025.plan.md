---
name: Migração Superset 5.0 para 6.0
overview: Migrar todos os 35 commits customizados da PortalTelemedicina da branch 5.0 para a branch 6.0 do Superset, garantindo que nenhum código customizado seja perdido durante a atualização.
todos:
  - id: backup-5.0
    content: Criar backup da branch 5.0 atual com tag e documentação do estado
    status: pending
  - id: sync-remotes
    content: Sincronizar remotes (upstream e origin) e verificar disponibilidade da branch 6.0
    status: pending
  - id: create-6.0-base
    content: Criar branch migration/6.0-base a partir de upstream/6.0 como base limpa
    status: pending
    dependencies:
      - sync-remotes
  - id: create-cherry-pick-branch
    content: Criar branch migration/6.0-cherry-pick para aplicar commits
    status: pending
    dependencies:
      - create-6.0-base
  - id: apply-commits-group-1
    content: Aplicar commits 1-10 e criar checkpoint-commits-1-10
    status: pending
    dependencies:
      - create-cherry-pick-branch
  - id: apply-commits-group-2
    content: Aplicar commits 11-20 e criar checkpoint-commits-11-20
    status: pending
    dependencies:
      - apply-commits-group-1
  - id: apply-commits-group-3
    content: Aplicar commits 21-35 e criar checkpoint-commits-21-35
    status: pending
    dependencies:
      - apply-commits-group-2
  - id: resolve-conflicts
    content: Resolver todos os conflitos e criar branch migration/6.0-conflicts-resolved
    status: pending
    dependencies:
      - apply-commits-group-3
  - id: validate-integrity
    content: "Validar integridade: verificar que todos os 35 commits foram aplicados e não há duplicatas"
    status: pending
    dependencies:
      - resolve-conflicts
  - id: test-frontend
    content: Testar compilação do frontend e verificar que plugins aparecem corretamente
    status: pending
    dependencies:
      - validate-integrity
  - id: test-backend
    content: Testar APIs customizadas e sistema de extensões do backend
    status: pending
    dependencies:
      - validate-integrity
  - id: create-tested-branch
    content: Criar branch migration/6.0-tested e tag checkpoint-tests-passed após testes
    status: pending
    dependencies:
      - test-frontend
      - test-backend
  - id: create-6.0-final
    content: Criar branch 6.0 final e tag de release após todas as validações
    status: pending
    dependencies:
      - create-tested-branch
  - id: update-custom-image
    content: Atualizar Dockerfile do superset-custom-image para usar branch 6.0
    status: pending
    dependencies:
      - create-6.0-final
  - id: document-migration
    content: "Documentar migração completa: commits, conflitos, resoluções e testes"
    status: pending
    dependencies:
      - update-custom-image
  - id: push-6.0
    content: Fazer push da branch 6.0 e todas as tags para origin após validação completa
    status: pending
    dependencies:
      - document-migration
---

# Migração Superset 5.0 para 6.0 - PortalTelemedicina

## Contexto

O projeto `superset` é um fork do Apache Superset mantido pela PortalTelemedicina. Atualmente, a branch `5.0` contém **35 commits customizados** que precisam ser migrados para a branch `6.0` antes da atualização.

### Commits Customizados Identificados

**Confirmação de Autoria**: Todos os 35 commits são da PortalTelemedicina, desenvolvidos por:

- **Josué Silveira** (`j.silveira@portaltelemedicina.com.br`) - 14 commits de código
- **b-wesen** (`b.wesen@portaltelemedicina.com.br`) - 11 commits de código
- **silveira-js** (`josuta@gmail.com`) - 10 commits de merge (mesmo desenvolvedor usando email pessoal)

Os commits incluem:

- Sistema de extensões do portal (`superset/extensions/portal/`)
- Plugins PTM ECharts (`superset-frontend/plugins/superset-plugin-chart-echarts-ptm/`)
- Plugins MapLibre (`superset-frontend/plugins/legacy-plugin-chart-maplibre-ptm/`)
- Flask Chart (`superset-frontend/plugins/plugin-chart-flask/`)
- Modificações em APIs, schemas e componentes frontend
- Configurações e traduções PT-BR

### Estrutura dos Repositórios

- **`/home/pedro/portal/superset`**: Fork do Apache Superset (origin: PortalTelemedicina, upstream: apache/superset)
- **`/home/pedro/portal/superset-custom-image`**: Repositório separado que usa imagem base do fork

## Estrutura de Branches e Checkpoints

### Diagrama de Branches

```
origin/5.0 (PROTEGIDA - não mexer)
  │
  ├── backup-5.0-YYYYMMDD (tag de backup)
  │
  ├── migration/6.0-base (branch limpa do upstream/6.0)
  │
  ├── migration/6.0-cherry-pick (trabalho de cherry-pick)
  │   │
  │   ├── checkpoint-commits-1-10 (tag após grupo 1)
  │   ├── checkpoint-commits-11-20 (tag após grupo 2)
  │   └── checkpoint-commits-21-35 (tag após grupo 3)
  │
  ├── migration/6.0-conflicts-resolved (após resolver conflitos)
  │
  ├── migration/6.0-tested (após testes passarem)
  │
  └── 6.0 (branch final - só após tudo validado)
```

### Estratégia de Branches

**Princípio**: Trabalhar em branches intermediárias isoladas, criando checkpoints após cada fase crítica. A branch `6.0` final só será criada após validação completa.

**Branches de Trabalho**:

- `migration/6.0-base`: Base limpa do upstream/6.0
- `migration/6.0-cherry-pick`: Aplicação dos commits (com checkpoints)
- `migration/6.0-conflicts-resolved`: Após resolver todos os conflitos
- `migration/6.0-tested`: Após testes passarem
- `6.0`: Branch final (criada apenas no final, após validação completa)

## Estratégia de Migração

### Fase 1: Preparação e Backup

1. **Backup da branch atual**
   ```bash
   cd /home/pedro/portal/superset
   git checkout 5.0
   git pull origin 5.0
   BACKUP_TAG="backup-5.0-$(date +%Y%m%d)"
   git tag -a "$BACKUP_TAG" -m "Backup antes da migração para 6.0"
   git push origin "$BACKUP_TAG"
   
   # Documentar estado atual
   git log --oneline origin/5.0 --not upstream/5.0 > /tmp/commits_5.0_backup.txt
   git diff --stat upstream/5.0 origin/5.0 > /tmp/diff_5.0_backup.txt
   ```

2. **Sincronização com remotes**
   ```bash
   git fetch upstream
   git fetch origin
   
   # Verificar que upstream/6.0 existe
   git ls-remote --heads upstream 6.0
   git checkout upstream/6.0  # Verificar que existe localmente
   git checkout 5.0  # Voltar para 5.0
   ```

3. **Criação de branches de trabalho**
   ```bash
   # Criar branch base limpa do upstream/6.0
   git checkout -b migration/6.0-base upstream/6.0
   git push -u origin migration/6.0-base
   ```


### Fase 2: Criação da Branch de Cherry-Pick

1. **Criar branch de trabalho para cherry-pick**
   ```bash
   git checkout migration/6.0-base
   git checkout -b migration/6.0-cherry-pick
   git push -u origin migration/6.0-cherry-pick
   ```

2. **Verificar estado limpo**
   ```bash
   # Confirmar que está alinhada com upstream/6.0
   git log --oneline migration/6.0-cherry-pick..upstream/6.0 | wc -l  # Deve ser 0
   git log --oneline upstream/6.0..migration/6.0-cherry-pick | wc -l  # Deve ser 0
   ```


### Fase 3: Aplicação dos Commits Customizados (com Checkpoints)

1. **Preparar lista de commits**
   ```bash
   # Criar arquivo com lista de commits em ordem cronológica
   cat > /tmp/commits_to_apply.txt << 'EOF'
   b3686f705d
   9a90347539
   20586a108b
   dc764b9c4a
   bcc29b7cba
   b289fa23ad
   92dfaf0b3b
   5531286e71
   a64b89cd48
   572e7313bc
   35e6529f05
   a079c018d0
   572bbfb959
   32999c74cf
   2d05681063
   3ebcfddc0f
   d2f6c27205
   56e5cc29c0
   9065871998
   bb88821396
   1c7c7f87ef
   8c6e6b5d96
   437fc2e048
   672520806c
   3ad8b597e8
   acdbe53134
   d0713e9747
   747e3b16e5
   99f50ceaf9
   a87f93788f
   036eef3b3e
   d956845713
   f501f3e7a8
   4ab88058e7
   bea55b07a1
   EOF
   ```

2. **Aplicar commits em grupos com checkpoints**

**Grupo 1: Commits 1-10 (Traduções e Flask Chart inicial)**

   ```bash
   git checkout migration/6.0-cherry-pick
   
   # Aplicar commits 1-10
   for commit in $(head -10 /tmp/commits_to_apply.txt); do
     echo "Aplicando commit $commit..."
     git cherry-pick $commit || {
       echo "ERRO: Conflito no commit $commit"
       echo "Resolva o conflito e continue com: git cherry-pick --continue"
       exit 1
     }
   done
   
   # Criar checkpoint
   git tag -a checkpoint-commits-1-10 -m "Checkpoint após aplicar commits 1-10"
   git push origin checkpoint-commits-1-10
   
   # Validação rápida
   git log --oneline -10
   ```

**Grupo 2: Commits 11-20 (Plugins PTM e MapLibre)**

   ```bash
   # Aplicar commits 11-20
   for commit in $(sed -n '11,20p' /tmp/commits_to_apply.txt); do
     echo "Aplicando commit $commit..."
     git cherry-pick $commit || {
       echo "ERRO: Conflito no commit $commit"
       exit 1
     }
   done
   
   # Criar checkpoint
   git tag -a checkpoint-commits-11-20 -m "Checkpoint após aplicar commits 11-20"
   git push origin checkpoint-commits-11-20
   ```

**Grupo 3: Commits 21-35 (Extensões e melhorias finais)**

   ```bash
   # Aplicar commits 21-35
   for commit in $(tail -n +21 /tmp/commits_to_apply.txt); do
     echo "Aplicando commit $commit..."
     git cherry-pick $commit || {
       echo "ERRO: Conflito no commit $commit"
       exit 1
     }
   done
   
   # Criar checkpoint
   git tag -a checkpoint-commits-21-35 -m "Checkpoint após aplicar commits 21-35"
   git push origin checkpoint-commits-21-35
   ```

3. **Estratégia de resolução de conflitos**

Quando um conflito aparecer:

   ```bash
   # 1. Ver quais arquivos têm conflito
   git status
   
   # 2. Resolver conflitos manualmente (priorizar código PortalTelemedicina)
   # Editar arquivos marcados com <<<<<<< ======= >>>>>>>
   
   # 3. Após resolver, adicionar arquivos
   git add <arquivos-resolvidos>
   
   # 4. Continuar cherry-pick
   git cherry-pick --continue
   
   # 5. Documentar conflito
   echo "Conflito resolvido em commit $commit" >> /tmp/conflicts_resolved.txt
   ```

4. **Validação incremental após cada grupo**

Após cada grupo de commits:

   ```bash
   # Verificar que commits foram aplicados
   git log --oneline --graph -15
   
   # Verificar diferenças
   git diff --stat migration/6.0-base HEAD
   
   # Verificar que não há commits duplicados
   git log --oneline --all | sort | uniq -d
   ```

### Fase 4: Resolução de Conflitos e Validação

1. **Criar branch após resolver conflitos**
   ```bash
   git checkout migration/6.0-cherry-pick
   git checkout -b migration/6.0-conflicts-resolved
   git push -u origin migration/6.0-conflicts-resolved
   ```

2. **Verificação de integridade completa**
   ```bash
   # Verificar que todos os 35 commits foram aplicados
   APPLIED=$(git log --oneline migration/6.0-base..migration/6.0-conflicts-resolved | wc -l)
   echo "Commits aplicados: $APPLIED (esperado: 35)"
   
   # Comparar arquivos modificados
   git diff --stat origin/5.0 migration/6.0-conflicts-resolved > /tmp/diff_5.0_to_6.0.txt
   
   # Verificar que não há commits duplicados
   DUPLICATES=$(git log --oneline --all | sort | uniq -d | wc -l)
   if [ "$DUPLICATES" -gt 0 ]; then
     echo "ATENÇÃO: Encontrados commits duplicados!"
     git log --oneline --all | sort | uniq -d
   fi
   
   # Listar todos os commits aplicados
   git log --oneline migration/6.0-base..migration/6.0-conflicts-resolved > /tmp/commits_applied_6.0.txt
   ```


### Fase 5: Testes e Validação Funcional

1. **Criar branch de testes**
   ```bash
   git checkout migration/6.0-conflicts-resolved
   git checkout -b migration/6.0-tested
   ```

2. **Testes do Frontend**
   ```bash
   cd superset-frontend
   
   # Instalar dependências
   npm install
   
   # Compilar
   npm run build
   
   # Verificar que plugins PTM aparecem no MainPreset
   grep -r "ptm_echarts\|ptm_pie\|ptm_big_number\|ptm_table" src/visualizations/presets/MainPreset.ts
   
   # Verificar sistema de extensões
   grep -r "initializePortalExtensions\|setupExtensions" src/
   ```

3. **Testes do Backend**
   ```bash
   cd /home/pedro/portal/superset
   
   # Verificar que APIs customizadas existem
   grep -r "dashboard_header\|dashboard_freshness" superset/extensions/portal/
   
   # Verificar imports
   python -m py_compile superset/extensions/portal/api/dashboard_header.py
   python -m py_compile superset/extensions/portal/api/dashboard_freshness.py
   ```

4. **Verificação de dependências**
   ```bash
   # Frontend
   cd superset-frontend
   npm list --depth=0 | grep -E "echarts|maplibre|flask"
   
   # Backend
   cd /home/pedro/portal/superset
   grep -E "google-cloud|pymssql|Pillow" requirements/base.in
   ```

5. **Tag de checkpoint após testes**
   ```bash
   git tag -a checkpoint-tests-passed -m "Checkpoint após testes passarem"
   git push origin checkpoint-tests-passed
   git push origin migration/6.0-tested
   ```


### Fase 6: Criação da Branch 6.0 Final

**IMPORTANTE**: Esta fase só deve ser executada após TODAS as validações passarem.

1. **Criar branch 6.0 final**
   ```bash
   git checkout migration/6.0-tested
   git checkout -b 6.0
   
   # Verificar uma última vez
   git log --oneline migration/6.0-base..6.0 | wc -l  # Deve ser 35
   ```

2. **Tag de release**
   ```bash
   RELEASE_TAG="6.0-portal-$(date +%Y%m%d)"
   git tag -a "$RELEASE_TAG" -m "Release 6.0 com commits PortalTelemedicina migrados"
   ```


### Fase 7: Atualização do superset-custom-image

1. **Atualizar Dockerfile**
   ```bash
   cd /home/pedro/portal/superset-custom-image
   
   # Obter commit SHA da branch 6.0
   cd /home/pedro/portal/superset
   COMMIT_SHA=$(git rev-parse 6.0)
   echo "Commit SHA: $COMMIT_SHA"
   
   # Atualizar Dockerfile
   cd /home/pedro/portal/superset-custom-image
   # Editar Dockerfile: FROM us.gcr.io/ptm-devops/superset-fork-master:$COMMIT_SHA
   ```

2. **Testar build da imagem**
   ```bash
   cd /home/pedro/portal/superset-custom-image
   make build
   # Verificar que build passou sem erros
   ```

3. **Atualizar referências**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Verificar Makefile se há referências hardcoded à versão 5.0
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Atualizar documentação se necessário

### Fase 8: Documentação e Push Final

1. **Documentar migração**
   ```bash
   cd /home/pedro/portal/superset
   cat > MIGRATION_5.0_TO_6.0.md << 'EOF'
   # Migração Superset 5.0 para 6.0 - PortalTelemedicina
   
   Data: $(date)
   
   ## Commits Migrados
   $(git log --oneline migration/6.0-base..6.0)
   
   ## Conflitos Encontrados
   $(cat /tmp/conflicts_resolved.txt 2>/dev/null || echo "Nenhum conflito encontrado")
   
   ## Testes Realizados
   - Frontend: Compilação OK
   - Backend: APIs customizadas OK
   - Plugins: Todos presentes no MainPreset
   - Extensões: Sistema funcionando
   
   ## Checkpoints Criados
   - checkpoint-commits-1-10
   - checkpoint-commits-11-20
   - checkpoint-commits-21-35
   - checkpoint-tests-passed
   EOF
   
   git add MIGRATION_5.0_TO_6.0.md
   git commit -m "docs: adicionar documentação da migração 5.0 para 6.0"
   ```

2. **Push final (após validação completa)**
   ```bash
   # Push da branch 6.0
   git push -u origin 6.0
   
   # Push das tags
   git push origin "$RELEASE_TAG"
   git push origin --tags
   
   # Push das branches intermediárias (para histórico)
   git push origin migration/6.0-base
   git push origin migration/6.0-cherry-pick
   git push origin migration/6.0-conflicts-resolved
   git push origin migration/6.0-tested
   ```


## Arquivos Principais Afetados

### Backend (Python)

- `superset/extensions/portal/` - Sistema de extensões
- `superset/dashboards/api.py` - APIs customizadas
- `superset/dashboards/schemas.py` - Schemas customizados
- `superset/config.py` - Configurações
- `superset/viz.py` - Visualizações

### Frontend (TypeScript/React)

- `superset-frontend/plugins/superset-plugin-chart-echarts-ptm/` - Plugins PTM ECharts
- `superset-frontend/plugins/legacy-plugin-chart-maplibre-ptm/` - Plugins MapLibre
- `superset-frontend/plugins/plugin-chart-flask/` - Flask Chart
- `superset-frontend/src/extensions/portal/` - Sistema de extensões frontend
- `superset-frontend/src/visualizations/presets/MainPreset.ts` - Registro de plugins
- `superset-frontend/src/setup/setupExtensions.ts` - Setup de extensões

### Configuração

- `superset-frontend/package.json` - Dependências frontend
- `requirements/base.in` - Dependências Python

## Riscos e Mitigações

### Riscos Identificados

1. **Conflitos de merge**: 1258 commits entre 5.0 e 6.0 podem causar muitos conflitos

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - **Mitigação**: Aplicar commits em grupos lógicos, testando após cada grupo

2. **Mudanças de API**: Superset 6.0 pode ter mudado APIs usadas pelos plugins

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - **Mitigação**: Revisar changelog do Superset 6.0, testar APIs customizadas

3. **Dependências quebradas**: Versões de dependências podem ter mudado

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - **Mitigação**: Verificar `package.json` e `requirements/base.in`, atualizar conforme necessário

4. **Plugins incompatíveis**: Estrutura de plugins pode ter mudado

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - **Mitigação**: Verificar documentação de plugins do Superset 6.0, adaptar se necessário

### Plano de Rollback Detalhado

O plano de rollback varia dependendo da fase em que a migração falhar:

#### Rollback na Fase 3 (Cherry-pick)

Se houver problemas durante o cherry-pick:

```bash
# Opção 1: Voltar ao último checkpoint
git checkout migration/6.0-cherry-pick
git reset --hard checkpoint-commits-1-10  # ou checkpoint-commits-11-20

# Opção 2: Abortar cherry-pick atual
git cherry-pick --abort

# Opção 3: Recomeçar do zero
git checkout migration/6.0-base
git branch -D migration/6.0-cherry-pick
git checkout -b migration/6.0-cherry-pick
```

#### Rollback na Fase 4 (Conflitos)

Se não conseguir resolver conflitos:

```bash
# Voltar para branch base e documentar problemas
git checkout migration/6.0-base
git log --oneline migration/6.0-base..migration/6.0-cherry-pick > /tmp/commits_failed.txt

# Criar branch de análise
git checkout -b migration/6.0-failed-analysis
# Documentar problemas encontrados
```

#### Rollback na Fase 5 (Testes)

Se testes falharem:

```bash
# Voltar para branch de conflitos resolvidos
git checkout migration/6.0-conflicts-resolved

# Analisar erros
# Corrigir problemas
# Criar nova branch de testes
git checkout -b migration/6.0-tested-v2
```

#### Rollback Completo

Se precisar abortar completamente a migração:

```bash
# 1. Garantir que branch 5.0 está intacta
git checkout 5.0
git pull origin 5.0

# 2. Verificar que backup existe
git tag -l "backup-5.0-*"

# 3. Deletar branches de migração (opcional, apenas local)
git branch -D migration/6.0-base
git branch -D migration/6.0-cherry-pick
git branch -D migration/6.0-conflicts-resolved
git branch -D migration/6.0-tested
git branch -D 6.0

# 4. Documentar falha
cat > /tmp/migration_failed_$(date +%Y%m%d).txt << EOF
Migração falhou em: $(date)
Fase: [preencher]
Problemas encontrados:
[descrever]
EOF
```

#### Procedimento de Recuperação

Após rollback, para retomar:

1. Analisar logs de conflitos: `/tmp/conflicts_resolved.txt`
2. Analisar commits que falharam: `/tmp/commits_failed.txt`
3. Revisar changelog do Superset 6.0 para entender mudanças
4. Criar nova branch de trabalho a partir do último checkpoint válido
5. Aplicar commits problemáticos individualmente com mais cuidado

#### Proteção da Branch 5.0

**NUNCA** fazer push forçado na branch 5.0:

```bash
# Proteger branch 5.0 (configurar no repositório remoto)
# No GitHub/GitLab, configurar branch protection rules para origin/5.0
```

## Checklist de Validação Final

- [ ] Todos os 35 commits foram aplicados com sucesso
- [ ] Frontend compila sem erros
- [ ] Backend inicia sem erros
- [ ] Plugins PTM aparecem no MainPreset
- [ ] Sistema de extensões funciona
- [ ] APIs customizadas respondem corretamente
- [ ] Imagem Docker builda com sucesso
- [ ] Documentação de migração criada
- [ ] Branch 6.0 pushada para origin
- [ ] superset-custom-image atualizado

## Detalhamento dos Commits Customizados

### Distribuição por Autor

- **Josué Silveira** (14 commits):
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Sistema de extensões do portal
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Plugins PTM ECharts e melhorias
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - MapLibre plugins
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Dashboard freshness
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Permissões de upload
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Service account Google Cloud
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Ajustes de styling

- **b-wesen** (11 commits):
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Flask Chart e melhorias
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Traduções PT-BR
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Configurações
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - HTML Sanitization
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Desativação TALISMAN
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Correções de filtros

- **silveira-js** (10 commits):
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Commits de merge dos Pull Requests (#1 a #10)

### Confirmação de Origem

Todos os commits foram verificados e confirmados como sendo da PortalTelemedicina:

- Emails corporativos: `@portaltelemedicina.com.br`
- Pull Requests: `PortalTelemedicina/*`
- Nenhum commit do upstream Apache Superset está incluído

## Ordem de Aplicação dos Commits

Aplicar commits na ordem cronológica (do mais antigo ao mais recente):

1. `b3686f705d` - feat:manual translations
2. `9a90347539` - fix:config pt-br
3. `20586a108b` - fix:Desactivated TALISMAN
4. `dc764b9c4a` - feat:Added HTML Sanitization
5. `bcc29b7cba` - feat:chart 3 dots translation
6. `b289fa23ad` - fix:Talisman back
7. `92dfaf0b3b` - fix:changed clear filter mechanic
8. `5531286e71` - feat: added new component flask chart
9. `a64b89cd48` - fix: unsued imports
10. `572e7313bc` - fix: Flask Chart with POST
11. `35e6529f05` - feat:add Flask Chart++
12. `a079c018d0` - feat: add PTM ECharts plugin package
13. `572bbfb959` - feat: register PTM chart plugins in MainPreset
14. `32999c74cf` - Merge pull request #1
15. `2d05681063` - fix: wrong dependencies and packages
16. `3ebcfddc0f` - Merge pull request #2
17. `d2f6c27205` - fix mismatch between packges
18. `56e5cc29c0` - fix: typescript issues
19. `9065871998` - Merge pull request #3
20. `bb88821396` - feat: create map plugins to use with map libre
21. `1c7c7f87ef` - Merge pull request #4
22. `8c6e6b5d96` - feat(ptm-echarts): enhance BigNumber chart
23. `437fc2e048` - Merge pull request #6
24. `672520806c` - feat(extensions): add portal extensions system
25. `3ad8b597e8` - Merge pull request #5
26. `acdbe53134` - fix: handle gracefully permission issues
27. `d0713e9747` - feat: add host image in bucket service
28. `747e3b16e5` - fix: remove make dir public
29. `99f50ceaf9` - Merge pull request #7
30. `a87f93788f` - feat: add dashboard data freshness header element
31. `036eef3b3e` - Merge pull request #8
32. `d956845713` - fix: get service account from json
33. `f501f3e7a8` - Merge pull request #9
34. `4ab88058e7` - fix: margin issues
35. `bea55b07a1` - Merge pull request #10

## Notas Importantes

### Regras de Ouro

1. **NUNCA fazer push forçado** em branches protegidas (5.0, 6.0 final)
2. **NUNCA deletar** a branch 5.0 até confirmação da migração bem-sucedida
3. **SEMPRE criar checkpoints** após grupos de commits
4. **SEMPRE validar** antes de avançar para próxima fase
5. **SEMPRE documentar** conflitos e resoluções

### Fluxo de Validação

```
Cherry-pick → Checkpoint → Validação → Próximo Grupo
     ↓            ↓            ↓
   Conflito?   Rollback?   Falhou?
     ↓            ↓            ↓
  Resolver    Voltar CP   Analisar
```

### Comandos Úteis de Verificação

```bash
# Verificar estado atual
git status
git log --oneline --graph -20

# Verificar diferenças
git diff --stat migration/6.0-base HEAD

# Verificar commits aplicados
git log --oneline migration/6.0-base..HEAD

# Listar checkpoints
git tag -l "checkpoint-*"

# Verificar se há commits não aplicados
git log --oneline origin/5.0 --not HEAD
```

### Comunicação com Equipe

- Manter equipe informada sobre progresso
- Documentar bloqueios e decisões tomadas
- Compartilhar checkpoints para revisão se necessário
- Criar Pull Request para revisão antes do push final (opcional)