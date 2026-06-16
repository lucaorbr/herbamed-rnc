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
- Versao atual: `2.1.1`
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

### ⏭️ Próximas seções
- Seções 15, 16 (conforme roadmap)
- Code-splitting (bundle 561.7 kB)

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

### Melhorias técnicas (paralelo)
- **Code-splitting:** bundle 561.7 kB → lazy load por rota
- **Testes unitários:** componentes shared
- **Dark mode:** variante para Formal
- **Keyboard navigation:** WCAG AA
