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

## Rede Docker e Nginx (deploy)
- Guia completo: `GUIA_REDE_DOCKER_NGINX.md`
- Padrão: o Nginx (`nginx-proxy`) deve acessar o SGQ pela rede compartilhada `herbamed_proxy`, via alias interno `sgq-frontend:80` — nunca por `IP-do-host:porta-publicada`.
- `sgq.herbamed.com.br` → upstream `sgq-frontend:80` (rede interna)
- Container: `container_name: herbamed_sgq_frontend`, alias proxy: `sgq-frontend`
- Porta publicada (host) `9027` é só para diagnóstico local; o `proxy_pass` no Nginx deve sempre usar a porta interna `80`
- Antes de mexer no `nginx.conf`: subir o app, testar `docker exec nginx-proxy getent hosts sgq-frontend` e `wget` no upstream, depois `nginx -t` e `nginx -s reload`

## Regras importantes
- Nunca commitar o .env local (está no .gitignore)
- JWT_SECRET obrigatório — backend não sobe sem ele
- ARECO_SYNC_ENABLED=false para testes locais
- Seção 17 do roadmap depende de infraestrutura da TI

## Versao do sistema
- Versao atual: `2.13.0`
- A versao exibida no sistema deve vir de `src/config/appVersion.js` e acompanhar a versao do `package.json`.
- Usar versionamento semantico no formato `MAJOR.MINOR.PATCH`.
- `PATCH` (ex.: `2.0.0` -> `2.0.1`): correcoes pequenas, ajustes visuais, textos, bugs pontuais.
- `MINOR` (ex.: `2.0.1` -> `2.1.0`): melhorias ou novas funcionalidades compativeis com o fluxo atual.
- `MAJOR` (ex.: `2.1.0` -> `3.0.0`): mudancas grandes de fluxo, arquitetura, permissoes ou comportamento que exigem atencao da TI/usuarios.
- Toda PR que altere comportamento do sistema deve avaliar se precisa incrementar a versao. A versao visivel ajuda a confirmar se o ambiente oficial da TI recebeu o mesmo codigo do GitHub.

## Status do roadmap (auditoria 2026-06-08)

### ✅ Completadas
- **Gestão de Documentos** — 9 fases + bônus (senhas)
- **Seção 10** — Rejeição de documento com auto-RNC (PR #43)
- **Shared Components** — StatusBadge, DataTable (PR #41)
- **RNC** — Link público para fornecedor (PR #44)
- **Documentos** — Catálogo de tipos configurável (PR #42)
- **Formal Mode** — Scrub global de emojis, boundary corrigido
- **Documentos** — Navegação por abas em formulário
- **UI** — Banner atualizado, logo sem emoji
- **Seção 14: RNC — 5 Porquês + CAPA** — análise de causa estruturada + plano de ações corretivas
- **Documentos** — Rota de assinatura: Elaborador designa Revisor/Aprovador (PR #55)
- **Documentos** — Distribuição de cópias físicas + recolha por revisão (PR #56)
- **CQ** — Fix: recebimento Areco reutiliza material e puxa ensaios parametrizados (PR #57)
- **RNC** — Exportar formulário de resposta do fornecedor em Excel pré-preenchido (alternativa offline ao link público enquanto a TI libera o acesso externo) — v2.7.0
- **UI** — Favicon com a folha do logo Herbamed (PR #89) — v2.8.2
- **Desvios — Indicadores** — aba completa de indicadores (filtro de período, 6 KPIs, tendência mensal, por setor/tipo/impacto, aging de triagem, export CSV) + integração no Dashboard Executivo (card "Desvios em Aberto", linha de desvios na tendência, semáforo) (PR #90) — v2.9.0
- **Desvios — Indicadores v2** — KPIs com comparativo do período anterior (Δ), tendência mensal empilhada por impacto, Pareto de tipos (eixo único em %, substitui a pizza), matriz de recorrência Setor × Tipo (heatmap), desempenho de triagem por faixas com meta de 7 dias (% ≤7d + mediana), aging com contadores >7d/>15d, top produtos/lotes recorrentes, clique em gráficos/KPIs navega para a lista já filtrada (novo filtro de Tipo na lista) — v2.10.0
- **Desvios — Indicadores (fix de layout)** — `minWidth:0` nos cards do grid Triagem/Aging e no `<span>` da descrição: o gráfico "Desempenho de Triagem" não é mais espremido por descrições longas e o ellipsis passa a funcionar — v2.10.2 (PR #94)
- **Desvios — Catálogo de tipos configurável** — tipos de desvio deixam de ser lista fixa no código e passam a ser geridos no Admin → Catálogos → "Tipos de Desvio" (`configuracoes/catalogo_tipos_desvio`, `{ nome, ativo }`). Formulário e filtro usam a lista ativa; "Outros" (texto livre) segue sempre disponível e não pode ser removido. Objetivo: evitar tipos duplicados com grafias diferentes que distorcem Pareto e matriz Setor×Tipo. — v2.11.0
- **Desvios — Reclassificação de tipos históricos** — tela admin-only na Lista de Desvios (botão "🏷️ Reclassificar tipos", com contador dos pendentes) que agrupa os desvios registrados como "Outros" + texto livre (`tipoOutro`) por grafia equivalente (case/acento-insensível via `normTipo`) e permite mapear cada grupo para um tipo canônico do catálogo. Ao aplicar, seta `tipo` = canônico, limpa `tipoOutro` e registra no `historico` de cada desvio (auditoria via `doSaveDesvio`). Fecha o passo pendente da v2.11.0 e limpa a distorção do Pareto/matriz Setor×Tipo. Só mapeia para tipos já existentes no catálogo — v2.12.0
- **Desvios — Catálogo de setores configurável + reclassificação + prazo/atraso na lista** — (1) setores de desvio deixam de ser lista fixa no código e passam a ser geridos no Admin → Catálogos → "Setores de Desvio" (`configuracoes/catalogo_setores_desvio`, `{ nome, ativo }`); formulário e filtro usam a lista ativa; "Outros" (texto livre) segue sempre disponível e não pode ser removido; `setoresDesvioAtivos()` espelha `tiposDesvioAtivos()`. (2) O modal de reclassificação foi generalizado (`ReclassificarModal` com `RECLASS_DIMS`) para funcionar tanto para tipos quanto para setores — botão "🏭 Reclassificar setores" com contador de pendentes na Lista, admin-only. (3) Fechou-se o loop do SLA de triagem: `META_TRIAGEM_DIAS` (7d) virou fonte única em `DesviosTabs` (importada pelos Indicadores), e a Lista ganhou coluna "Triagem" (`TriagemChip`) + linha no modal de detalhe mostrando há quantos dias o desvio está aberto e destacando os atrasados — a métrica que antes só existia nos indicadores agora é acionável no fluxo. — v2.13.0

### ⏭️ Próximas seções
- Seções 15, 16 (conforme roadmap)
- Code-splitting (bundle 561.7 kB)

### 🔭 Desvios — backlog priorizado (auditoria de especialista 2026-07-10)
Diagnóstico: o fluxo operacional é enxuto/binário (registra → Qualidade tria → **encerra** OU **converte em RNC**), mas os indicadores ficaram muito ricos. Há um **descompasso**: os indicadores medem coisas que o fluxo ainda não deixa o usuário agir/registrar. Fechar esse descompasso é o eixo do backlog. Ordenado por impacto para uma farmacêutica (BPF/ANVISA + modelo SE Suite):

1. **Disposição de produto/lote (maior lacuna de compliance).** Hoje "Produto / Lote" é só texto livre. Num QMS farma, desvio que toca um lote exige **decisão de disposição** rastreável: liberar, segregar, quarentenar, reprovar, retrabalhar. É o primeiro item que uma inspeção ANVISA olha. Não existe hoje.
2. **Rigor no encerramento.** Encerrar hoje é um `window.prompt()` de uma linha, sem anexo de evidência, sem assinatura e **sem segregação** (quem tem `triarDesvio` encerra o próprio registro). Desvio de impacto **Crítico** encerrado sem investigação deveria exigir justificativa/aprovação de segunda pessoa. O SE Suite trata como etapa formal.
3. **Investigação leve no nível do desvio.** A análise de causa (5 Porquês/Ishikawa) só existe **depois** de virar RNC. Muitos desvios merecem investigação curta **sem** escalar para RNC formal — hoje o fluxo é "tudo ou nada".
4. **Responsável/dono do desvio.** Não há investigador/dono designado — some na triagem de "quem puder". Sem owner não há a quem cobrar prazo (complementa o SLA já surfado na lista).
5. **Notificação/escalonamento de atraso.** A coluna "Triagem" (v2.13.0) já mostra o atraso; falta o alerta ativo (e-mail/aviso) quando estoura a meta, nos moldes do alerta de prazo das RNCs no `App.jsx`. Crítico deveria ter prazo de triagem menor que Menor (prazo por impacto).
6. **Recorrência no registro.** Os indicadores mostram recorrência (matriz Setor×Tipo, produtos que repetem), mas no registro não dá para marcar "isto já aconteceu / é recorrente" nem vincular a um desvio anterior — recorrência deveria elevar a criticidade.
7. **Relatório PDF.** RNC e Auditorias exportam PDF; Desvios só CSV. Falta o relatório individual do desvio e/ou o sumário para reunião de gestão/inspeção.
8. **Polimento da lista.** Falta filtro por **impacto** e por **período** na lista (os Indicadores já têm ambos) — inconsistência pequena.

Regra ao pegar estes itens: seguir o que o SE Suite faria e manter a **fonte única** já estabelecida (catálogos configuráveis, `META_TRIAGEM_DIAS`, histórico imutável via `doSaveDesvio`).

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

### REFORMA DA GESTÃO DE DOCUMENTOS — 9 fases (completas)

#### Fase 1: Fundação — PDF obrigatório
- Campo `arquivo` obrigatório (não assina sem PDF anexado)
- Bloqueio: se não há arquivo, botão "Assinar" desabilitado
- **PR #20**

#### Fase 2+3: Renderização controlada + capa
- Endpoint `GET /api/documents/{id}/render?modo={controlada|nao_controlada|obsoleto|rascunho}&userName={name}`
- Capa integrada com assinaturas (3 papéis: Elaborador, Revisor, Aprovador)
- Marca d'água diagonal 45° em todas as páginas (configurável por modo)
- Rodapé: data impressão + modo no footer da capa
- **PR #22**

#### Fase 4: Arquivo fonte editável por revisão
- Campo `arquivoFonte` (Word/Excel/PPT apenas, não PDF)
- Função `handleDocArquivoFonte()` valida extensão
- Carregado ao iniciar revisão, permite que elaborador reedite
- Permissão `baixarArquivoFonte` para download
- **PR #24**

#### Fase 5: Controle de acesso granular
- 7 permissões novas em "Gestão de Documentos": verDocumentos, iniciarRevisao, tornarObsoleto, configurarDocumentos, baixarArquivoFonte, baixarCopiaNaoControlada, gerenciarTreinamento
- PERMS_PADRAO por role (viewer, user, rt, keyuser, admin, exec) com defaults
- Admin customiza permissões por usuário no AdminTab
- **PR #25**

#### Fase 6: Confirmação de leitura + treinamento BPF
- Modal obrigatório ao abrir documento (se `leituraObrigatoria=true`)
- "Li e entendi" com timestamp + IP
- Registra em tabela `training_log` (usuario_id, usuario_nome, doc_id, data_confirmacao)
- Indicador visual "✓ Leitura confirmada" na lista
- **PR #26**

#### Fase 7: Log de distribuição de cópias não controladas
- Tabela `distribution_log`: doc_id, doc_codigo, usuario_id, usuario_nome, data_download, modo
- Preenchida ao renderizar com `modo=nao_controlada`
- Rastreabilidade: quem baixou cópia não controlada, quando
- Usado para auditoria de compliance
- **PR #28**

#### Fase 8: Data de vigência programada
- Campo `dataVigencia` (data futura quando doc ativa)
- Cronjob verifica diariamente → promove status para "Vigente" quando chegar
- Permite treinar antes de entrar em vigor
- Notificação ao atingir data
- **PR #29**

#### Fase 9: Notificação de revisão periódica
- Campo `proximaRevisao` (data de próxima revisão periódica)
- Calculada por tipo de doc (1, 2, 3 anos) em TIPOS_DOC_RENDER
- Alerta quando proximaRevisao ≤ hoje
- Botão "Revisado sem alterações" → registra sem criar nova versão
- **PR #30**

#### Fix: Marca d'água diagonal só no conteúdo
- Problema: marca diagonal em TODAS páginas + footer da capa = sobreposição
- Solução: skip capa (idx === 0) no loop de desenho diagonal
- Capa tem footer com marca próprio; conteúdo tem diagonal + footer
- **PR #32**

#### Bônus: Gestão de senhas
- Admin: "🔄 Resetar senha" → Herba@123 + marca senhaTemporaria=true
- User: Avatar → "🔑 Mudar senha" (modal)
- Login com senha temporária → modal bloqueante até trocar
- POST /api/auth/change-password + POST /api/auth/admin-reset-password
- **PR #33**

---

#### Arquitetura de dados (novo)
- `users.senha_temporaria` (bool) — marca usuário que precisa trocar senha no próximo login
- `generic_documents.data` (JSON) — adicionados campos:
  - `arquivoFonte`: { url, nome } — arquivo editável da revisão
  - `leituraObrigatoria`: bool — requer confirmação ao abrir
  - `dataVigencia`: ISO timestamp — quando doc ativa automaticamente
  - `proximaRevisao`: ISO timestamp — alerta quando chegar perto
  - `revisaoRegistrada`: timestamp — último "revisado sem alterações"
  - `rota`: { revisorId, revisorNome, aprovadorId, aprovadorNome } — rota de assinatura definida pelo Elaborador (PR #55)
  - `distribuicaoFisica`: [{ setor, dataEntrega, entreguePor }] — cópias controladas impressas por setor (PR #56)
  - `recolhaPendente`: [{ setor, versaoAnterior }] — cópias obsoletas a recolher após nova revisão (PR #56)
- `distribution_log` — tabela imutável de downloads de cópias não controladas
- `training_log` — tabela de confirmações "Li e entendi"
- `document_signatures` — tabela imutável (Seção 10)

---

## ROADMAP — Próximos passos (priorizado por impacto)

### Seção 11-12: Rejeição de documento + Auto-RNC ✅ (PR #43)
- Documento pode ser rejeitado em fase de aprovação
- Rejeição cria RNC automaticamente
- Ligação bidirecional: Documento ↔ RNC

### Documentos — Recusa com apontamentos estruturados ✅ (v2.2.0)
- Revisor **e** Aprovador podem recusar (botão "❌ Recusar" em "Em Revisão" e "Aguardando Aprovação")
- Modal com lista de apontamentos (seção + descrição), 1+ itens obrigatórios
- Recusa devolve o documento para **Rascunho**, **invalida as assinaturas** da revisão e mantém a rota (mesmos designados reiniciam o ciclo)
- **Sem abertura de RNC** (devolução em rota = retrabalho, não NC formal)
- Banner/checklist na tela do documento mostra os apontamentos ao elaborador; `apontamentos` é limpo quando o elaborador reassina
- Novo campo `generic_documents.data.apontamentos`: `[{ id, autor, autorPapel, data, secao, descricao, resolvido }]`

### Documentos — Histórico de revisão na capa ✅ (v2.3.0)
- Documentos com capa exibem uma tabela curta de histórico de revisão na capa renderizada.
- Primeira emissão aparece automaticamente como `Rev.00 | Emissão inicial`.
- Ao iniciar Rev.01 ou maior, o fluxo exige `itemModificado` e `descricao` da alteração.
- Modelos sem capa continuam inalterados.

### Seção 13: RNC — Link público para fornecedor ✅ (PR #44)
- Fornecedor responde RNC via link compartilhável
- Upload de evidências de correção
- Não requer login

### Seção 14: RNC — 5 Porquês + CAPA ✅
- Análise de causa: 5 Porquês estruturado com Ishikawa
- Tabela CAPA com ações corretivas, responsável + prazo
- Geração automática com IA (opcional)
- Validação: no mínimo 3 dos 5 Porquês antes de salvar CAPA

### Documentos — Rota de assinatura ✅ (PR #55)
- Elaborador designa Revisor e Aprovador ao assinar (entre usuários com `assinarRevisorAprovador`)
- Revisão/aprovação travadas aos designados — só eles (ou admin) assinam
- Backend valida o designado em `/api/auth/signature` via `docId`
- Admin remaneja designados; trocar papel já assinado invalida a assinatura
- Segregação mantida: Elaborador ≠ Revisor ≠ Aprovador

### Documentos — Distribuição de cópias físicas ✅ (PR #56)
- Registro de cópias controladas impressas por setor (setor + data + quem entregou)
- Nova revisão gera pendência de recolha das cópias obsoletas (banner + baixa por setor)
- Lista Mestra: coluna "Cópias Físicas" + alerta de recolha; incluída em CSV/XLSX
- Gerenciado por quem tem `iniciarRevisao` ou admin

### CQ — Fix recebimento Areco ✅ (PR #57)
- `iniciarAnalise` reutiliza o material existente (`areco-<codigo>`) sem sobrescrever
- Análise semeada a partir dos `ensaios` parametrizados do material (paridade com fluxo manual)
- Material só é criado quando ainda não existe

### Seção 15: Indicadores — Gráficos + Tendência (próximo)
- Gráfico de linha (últimos 12 meses)
- Cálculo meta vs. realizado
- Lib: recharts

### Seção 16: Auditorias — Achados estruturados (próximo)
- Entidades de achado (número, descrição, nível risco)
- Rastreamento de fechamento
- Anexo de evidências

#### Auditoria do módulo atual (`auditorias/AuditoriasTab.jsx`) — lacunas mapeadas (2026-06-19)
O módulo já cobre o básico (planejamento + achados com tipo/ação/responsável/prazo/status, KPIs, PDF, trilha). Falta para ficar condizente com o SE Suite / Seção 16:
1. **Número/identificador rastreável do achado** — hoje os achados são só uma lista numerada na tela (`#1`, `#2`), sem código próprio.
2. **Nível de risco no achado** — hoje só existe o *tipo* (NC/observação/etc.), não a severidade/risco.
3. **Anexo de evidências no achado** — sem upload (RNC e Desvios já têm; reaproveitar `AnexosUpload`).
4. **Converter achado em RNC** — `AuditoriasTab` já recebe `rncs` e `doSaveRNC` por props mas não usa; achado de "Não conformidade" deveria virar RNC formal (5 Porquês + CAPA), como nos Desvios.

### Melhorias técnicas (paralelo)
- **Code-splitting:** bundle 561.7 kB → lazy load por rota
- **Testes unitários:** componentes shared
- **Dark mode:** variante para Formal
- **Keyboard navigation:** WCAG AA
