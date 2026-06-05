# Claude Code — SGQ Herbamed

## Sobre o projeto
Sistema de gestão da qualidade (SGQ) para Herbamed (farmacêutica).
- Backend: Node/Express em server/index.js
- Frontend: React/Vite em src/
- Banco: PostgreSQL via Docker
- Repositório: https://github.com/lucaorbr/herbamed-rnc

## Protocolo de trabalho (sempre nesta ordem)
⚠️ NUNCA commitar direto na main — sempre criar a branch antes de qualquer edição, mesmo para mudanças pequenas.
1. Abrir sessão: git checkout main → git pull → criar branch nova (fix/ feat/ chore/)
2. Executar a tarefa com "Aceitar edições" desligado
3. Rodar npm run build — confirmar que compila sem erros
4. Testar: docker compose up --build -d → abrir localhost:9027
5. Commit com mensagem descritiva (fix: / feat: / chore:) + push
6. Abrir PR no GitHub → revisar → mergear
7. Avisar TI se precisar configurar algo em produção antes do deploy

## Regras importantes
- Nunca commitar o .env local (está no .gitignore)
- JWT_SECRET obrigatório — backend não sobe sem ele
- ARECO_SYNC_ENABLED=false para testes locais
- Seção 17 do roadmap depende de infraestrutura da TI

## Próximas seções
Seções 7, 8, 9 (motor de assinatura) → 11, 12 (reprovação → RNC)

## Referência de design: SE Suite (SoftExpert Suite)
Este sistema é modelado no SE Suite, o software de referência. Ao implementar qualquer funcionalidade, sempre se baseie na lógica e estrutura do SE Suite para os pilares da qualidade:

- **Documentos:** o documento controlado é sempre o arquivo eletrônico anexado (cofre), nunca texto digitado no sistema. Em volta dele: identificação, revisão, ciclo de vida (Rascunho → Em Revisão → Aprovação → Vigente → Obsoleto), assinaturas eletrônicas, marca d'água em cópias (CÓPIA NÃO CONTROLADA / OBSOLETO) e revisão periódica por tipo.
- **Não conformidades (RNC):** fluxo com análise de causa (5 Porquês no início), ações corretivas e evidências.
- **Workflow:** rotas de aprovação com responsáveis e segregação de funções (quem executa ≠ quem aprova, quando exigido).
- **Indicadores e auditorias:** medição e registros rastreáveis e imutáveis.

Quando houver dúvida de como implementar algo, siga o que o SE Suite faria.

## Gestão de Documentos — princípios de design (baseado no SE Suite)
O documento controlado segue o modelo do SE Suite e dos melhores QMS (MasterControl, Veeva, Qualio):

- **Documento controlado é sempre PDF** — formato fixo, não editável. Word é formato de autoria; quem autora exporta para PDF antes de anexar.
- **A marca d'água é queimada em todas as páginas do conteúdo**, nunca apenas numa capa separada. O usuário quase nunca vê o documento "limpo".
- **Estados da marca d'água conforme o acesso:**
  - Rascunho / Em Revisão → `"RASCUNHO — SEM VALOR"`
  - Vigente, na tela → `"CÓPIA CONTROLADA"`
  - Vigente, baixado / impresso → `"CÓPIA NÃO CONTROLADA"`
  - Obsoleto → `"DOCUMENTO OBSOLETO"`
- **Renderização no servidor:** a marca d'água é estampada server-side (pdf-lib), a partir do PDF guardado no banco.
- **Não se assina documento sem arquivo anexado.**
- **Impressão de cópia não controlada é registrada** (quem, quando).
- **Mantém-se o que já existe:** ciclo de vida (Rascunho → Em Revisão → Aguardando Aprovação → Vigente → Obsoleto), 3 assinaturas com segregação de funções, histórico de revisões com snapshot, trava de Vigente, revisão periódica por tipo e tabela imutável de assinaturas.

### Plano de implementação (fases)
1. **Fundação:** PDF obrigatório + bloqueio de assinatura sem arquivo.
2. **Marca d'água no conteúdo:** endpoint server-side que carimba todas as páginas (modos controlada / não controlada / obsoleto / rascunho).
3. **Folha de rosto integrada** como página 1 do PDF carimbado.
4. **Log de distribuição** de cópias não controladas.
5. **(futuro) Treinamento** na liberação.

---

## ROADMAP — Próximos passos (priorizado)

**Estado atual (auditoria 2026-06-05):**
- ✅ Documentos: maduro (ciclo de vida, assinaturas, marca d'água, lista mestra)
- ✅ Temas: Professional claro + Dark, Formal mode com cobertura 100% emojis
- ✅ Abas: formulário de documentos com navegação por abas
- ⚠️ RNC/CQ: gigantes (2k+ LOC), visual inconsistente, sem análise de causa estruturada
- ⚠️ Indicadores: apenas lista, sem gráficos
- ⚠️ Componentização: ~700 emojis em 24 arquivos, tabelas/filtros reimplementados em cada módulo

### SEÇÃO 1: Design Language
**1.1 — Padronizar RNC e CQ no estilo de Documentos**
- Aplicar: abas para capítulos, cards estruturados, badges de status, tabelas com alternância
- Estimativa: 2-4 dias (1-2 dias por módulo)
- Ganho: Alto (percepção visual, usabilidade)

**1.2 — Professional claro como padrão (Dark opção)**
- Inverter ordem no seletor de temas
- Estimativa: 2h
- Ganho: Baixo (branding)

### SEÇÃO 2: Componentização (alta prioridade)
**2.1 — Extrair componentes → shared/ui.jsx**
- `<StatusBadge status={...} />`
- `<DataTable headers columns rows />`
- `<FilterBar filters onFilter={} />`
- `<FormTabs tabs activeTab onTabChange />`
- Estimativa: 3 dias
- Ganho: Alto (reduz LOC gigantes, padronização)

**2.2 — Criar `<StatusSelect>`, `<TypeSelect>`, `<DepartmentSelect>`**
- Reutilizáveis em 15+ módulos
- Estimativa: 1 dia
- Ganho: Médio (sincronização automática com catálogos)

### SEÇÃO 3: Quebra de arquivos gigantes
**3.1 — RncTabs.jsx → RNC/** (padrão modular)
```
RNC/
  ├── RncList.jsx (lista + filtros)
  ├── RncDetail.jsx (detalhe + assinaturas)
  ├── RncForm.jsx (formulário + IA)
  ├── RncTabs.jsx (orquestrador)
  └── index.js
```
- Estimativa: 2 dias
- Ganho: Manutenibilidade

**3.2 — CQTabs.jsx → CQ/** (mesmo padrão)
- Estimativa: 2 dias

### SEÇÃO 4: Pilares funcionais incompletos
**4.1 — RNC: 5 Porquês + CAPA (análise de causa)**
- Adicionar campo "5 Porquês" obrigatório
- Adicionar tabela de CAPA (ação, responsável, prazo, status)
- Estimativa: 3 dias
- Ganho: Alto (regulatório BPF)

**4.2 — Indicadores: gráficos + tendência**
- Adicionar gráfico de linha (últimos 12 meses)
- Cálculo automático meta vs. realizado
- Lib: recharts ou chart.js
- Estimativa: 4 dias
- Ganho: Alto (dashboard útil)

**4.3 — Auditorias: achados estruturados + rastreamento**
- Entidades de achado (número, descrição, nível risco, anexo)
- Rastreamento de fechamento
- Estimativa: 3 dias
- Ganho: Médio (rastreabilidade BPF)

### SEÇÃO 5: UX/Acessibilidade
**5.1 — Keyboard navigation completo**
- Tabelas, modais, filtros navegáveis por Tab/Enter/Escape
- Estimativa: 2 dias
- Ganho: WCAG AA

**5.2 — Dark mode para Formal (variante escura sem emoji)**
- Estimativa: 1 dia
- Ganho: Opção para ambientes regulatórios

### SEÇÃO 6: Infraestrutura
**6.1 — Code-splitting (bundle ~557 kB → lazy load)**
- Separar features por rota
- Estimativa: 3 dias
- Ganho: Performance

**6.2 — Testes unitários (componentes compartilhados)**
- Estimativa: 5 dias
- Ganho: Confiança em refatoração

---

## Priorização recomendada

| Ordem | Seção | Esforço | Ganho | Por quê |
|---|---|---|---|---|
| **1** | 2.1 (Componentizar) | 3d | Alto | Reduz LOC gigantes |
| **2** | 1.1 (Padronizar RNC/CQ) | 2-4d | Alto | Percepção visual |
| **3** | 3.1-3.2 (Quebra de arquivos) | 4d | Médio | Manutenibilidade |
| **4** | 4.1 (5 Porquês em RNC) | 3d | Alto | Regulatório |
| **5** | 1.2 (Professional padrão) | 2h | Baixo | Branding |
| **6** | 4.2 (Indicadores gráficos) | 4d | Médio | Dashboard |
