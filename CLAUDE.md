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
- Versao atual: `3.2.0`
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
- **PDF — Padronização do "rosto" (Bloco 1 de 2)** — novo `buildPDFShell({ titulo, subtitulo, numero, meta, corpo, rodapeEsq })` em `src/features/pdf/pdfExports.jsx` que envolve o miolo de qualquer PDF client-side na mesma identidade visual da Gestão de Docs: **faixa verde no topo** (`#1a4a2e` = o `verde` rgb 0.10/0.29/0.18 do render server-side) com o logo `public/logo-herbamed.png` + título + número/meta, e **faixa fina no rodapé** (`#edf2ed`). O `PDF_CSS` compartilhado migrou o accent de `#1a7a3c` → `#1a4a2e`. Migrados para o shell os 3 geradores que já usavam `openPDFWindow`/`PDF_CSS`: **FMEA** (`exportFMEAPDF`), **Auditoria** (`exportAuditoriaPDF`) e **Revalidação** (`buildRevalidacaoHTML`). Falta o Bloco 2 (RNC, CQ ×2 unificado, Laudos — que têm HTML/CSS próprio inline). — v2.17.0
- **PDF — Padronização do "rosto" (Bloco 2 de 2, conclui)** — migrados para o `buildPDFShell` os 3 geradores que tinham HTML/CSS próprio inline: **RNC** (`exportRNCPDF` — CSS específico de RNC virou `<style>` escopado no miolo; badges de status/severidade movidos para uma linha no topo do corpo; corrigido `<div>` do bloco "Aprovado pelo RT" que ficava sem fechar), **CQ** (as duas `exportRA` de recebimento e de análise foram **unificadas** no helper de módulo `abrirRA_PDF({ identFields, tableHead, tableRows, ... })` em `CQTabs.jsx` — só o miolo/colunas diferem entre os dois), e **Laudos** (`exportPDF`). CNPJ da empresa preservado no `rodapeEsq` de CQ e Laudos; endereço completo saiu do rodapé fino (fica só CNPJ, como fine print). Todos os PDFs do sistema agora saem com o mesmo cabeçalho verde + rodapé. — v2.18.0

- **RNC** — Campo Nota Fiscal do material (quando aplicável) (PR #105) — v2.19.0
- **RNC** — Status `Aberta` -> `Em andamento` automático no 1º ato de tratamento (encaminhar ao fornecedor, contenção ou início da análise de causa). Regra única em `andamentoPatch` no `RncTabs.jsx` (PR #106) — v2.20.0
- **RNC** — Assinatura do elaborador gravada na criação; PDF reimprime sem reassinar (PR #107) — v2.21.0
- **RNC — Reunião de Análise Crítica (RAC), Fase 1 / MVP** — nova aba 🗓️ Reuniões: entidade `rnc_reunioes` (coleção nova), pauta automática ordenada por GUT, deliberação por item que **age na própria RNC**, encerramento com ata em PDF assinada. Detalhes e o que ficou para as Fases 2/3 na seção abaixo — v2.22.0
- **RNC — Disposição do material/lote + trava de encerramento** — fecha a lacuna "usamos o que estava bloqueado pela RNC" (padrão SE Suite: liberar material não conforme é decisão formal rastreável, não some no encerramento). (1) Nova seção `📦 Disposição do material` no modal da RNC com 6 decisões canônicas (`DISPOSICOES` em `RncTabs.jsx`: liberar / concessão / segregar / retrabalho / reprovar / devolver); grava `rnc.disposicao = { decisao, justificativa, data, por, assinaturaRT }` + entrada no `historico` (`tipo:"disposicao"`, fonte única). Justificativa técnica obrigatória. As duas decisões que **liberam material NC** (`liberar`, `concessao`, flag `libera`) exigem **assinatura eletrônica do RT** (`AssinaturaModal`, perm `aprovarRNC`); as demais gravam só justificativa + autor (perm `analisarRNC`). (2) **Trava de encerramento:** os botões manuais de status no modal perderam `Eficaz`/`Ineficaz` (`Object.keys(SMETA).filter(...)`) — estados terminais agora **só** pela aba ✅ Verificação de eficácia, que já barrava CAPA pendente e ganhou nova trava: `rncTemMaterial(r)` (tipo de material OU produto/lote preenchido) sem `disposicao` registrada **não fecha como Eficaz**. Fecha o furo do atalho manual onde qualquer não-visualizador marcava Eficaz sem 5 Porquês/CAPA. Assinatura de RT no encerramento mantida só para Crítica (como antes) — a decisão sensível (liberar NC) já é assinada na disposição, sem dupla assinatura. Disposição também sai no PDF da RNC (`exportRNCPDF`) para auditoria. (3) **Encerramento por disposição (status novo `Encerrada`):** disposição decide o *destino do lote*, não a *causa raiz* — por isso registrar disposição **não** fecha a RNC sozinho. Para o caso pontual "resolvida por concessão, sem CAPA", há o botão **✅ Encerrar RNC (resolvida por disposição)** na seção de disposição, que leva a RNC ao status terminal próprio **`Encerrada`** (cinza, `#94a3b8`) com registro no `historico` — distinto de `Eficaz` (que significa causa raiz verificada). Novo helper de fonte única em `status.js`: `RNC_TERMINAIS = ["Eficaz","Ineficaz","Encerrada"]` + `rncAtiva()`/`rncEncerrada()` — todos os filtros de "RNC ativa/vencida/pauta" (App.jsx, ExecutivoDashboard, FornecedoresTab, ReunioesTab, RncTabs) passaram a usar `rncAtiva()` em vez de comparar `!== "Eficaz" && !== "Ineficaz"` soltos, para `Encerrada` contar como fechada em todo lugar. Nota: `Encerrada` permanece no denominador da "taxa de eficácia" (não conta como eficaz) — intencional, não inflar a taxa — v2.23.0

- **Documentos — Cargo nas assinaturas antigas (fallback visual)** — assinatura é **snapshot imutável**: o cargo é copiado do cadastro no ato de assinar (`/api/auth/signature`) e **não** acompanha mudanças posteriores no perfil (correto por BPF). O sintoma "aparece o registro profissional mas não o cargo" vem de assinaturas gravadas quando o campo Cargo ainda não existia/estava vazio no cadastro (`crf` é coluna própria de `users`; `cargo` mora no JSON `data`). Fix **só de exibição**, sem reescrever nada: quando `assinatura.cargo` está vazio, resolve-se o cargo atual do cadastro pelo `userId`/`email` da assinatura — na tela (`cargoCadastroAtual` em `GestaoDocumentosTab.jsx`, com marcador "· cadastro atual") e na capa do PDF renderizado (`cargosCadastroAtual`/`cargoExibidoAss` em `server/index.js`). ⚠️ O código de verificação (`sigCodigo`/`sigCodigoServer`) continua calculado sobre o objeto gravado, **sem** o fallback — senão o código mudaria e invalidaria assinaturas antigas. Assinatura que já tem cargo gravado nunca é sobrescrita — v2.23.1

- **Autocorreção — correção por distância de edição** — a autocorreção da v2.27.0 era só uma tabela de consulta exata (`SAFE_CORRECTIONS`): corrigia `prodto` mas não `prduto`, porque cada erro precisava ter sido previsto à mão. Agora há uma segunda camada algorítmica que pega letra faltando, sobrando, trocada e invertida (Damerau, distância 1) sem lista de erros. **Três travas contra falso positivo** — num SGQ, reescrever uma palavra certa é adulterar registro: (1) palavra que já é alvo não se mexe; (2) palavra que **existe em português** não se mexe (`produtor` nunca vira `produto`, `amostar` nunca vira `amostra`); (3) candidato tem de ser **único** — empate não corrige. Comprimento mínimo de 5 letras, abaixo disso vale só a tabela manual, que mantém precedência sobre o algoritmo. Busca é índice de deleções (SymSpell), não varredura do vocabulário: ~10 lookups de hash por palavra digitada. A lista `PROTEGIDAS` é **gerada em build** por `scripts/genLexico.js` (`npm run lexico`) a partir do hunspell pt-BR (`dictionary-pt-br`, devDependency, projeto VERO) — o script expande os afixos **com cross-product** PFX×SFX (sem ele somem `revisão`=re+visão, `reprovado`=re+provado, `incorreto`=in+correto) e varre 10,5 milhões de formas para achar as reais a distância 1 dos 293 alvos curados. O dicionário de 4,3 MB fica só no build; ao bundle vão 24 KB (**+6,5 kB gzipado**), sem lazy-load. O gerador também valida a grafia dos alvos contra o dicionário — alvo não atestado vira aviso. Ver `src/services/lexico.generated.js` (não editar à mão) — v2.28.0

- **Matriz de Treinamento — Fases 0 a 7 (completa)** — fecha o modelo SE Suite de Competência & Treinamento: a exigência de treinamento nasce do **cargo e do setor**, não da pessoa. Decisão que sustenta tudo: **exigência é derivada, evidência é gravada** — a exigência (quem deve treinar) não se armazena, calcula-se de `doc.treinamento.cargos`/`setores` × quem ocupa esses cargos/setores; a evidência (quem treinou) é gravada na coleção `treinamentos`, sempre carimbada com a versão do documento.
  - **Fase 0 (PR #117, v2.28.1)** — fix de furo em produção: leitura obrigatória e treinamento valiam para qualquer versão do documento (quem confirmou a Rev.00 seguia "✓ Confirmado" na Rev.02 sem ler a nova). `iniciarRevisao` agora arquiva as confirmações da versão anterior em `historicoRevisoes[]` e reabre pendência para os designados na nova versão; `salvarTreino` carimba a `versao`, e treino de versão antiga vira "⚠ Desatualizado". Lógica extraída para `src/features/documentos/treinamento.js` (funções puras), base reaproveitada pela Fase 2.
  - **Fase 1 (PR #118, v2.29.0)** — catálogo de cargos em Admin → Catálogos → 👔 Cargos (`configuracoes/catalogo_cargos`, `{ id, nome, ativo }`); `id` é slug estável para não desvincular ninguém ao renomear. Cadastro de usuário passa a ter select do catálogo, gravando `cargoId` (vínculo) e `cargo` (rótulo, preservado para a assinatura eletrônica/PDF). Migração "⬇️ Importar e vincular" agrupa grafias equivalentes do texto livre legado, reexecutável. Fix de bug junto: `seedAdmin()` em `server/migrate.js` fazia `data = EXCLUDED.data` e **apagava o cargo do admin a cada deploy**; virou merge (`COALESCE(...) || EXCLUDED.data`).
  - **Fases 2 e 3 (PR #119, v2.30.0)** — `doc.treinamento = { exigido, modo, cargos[], pessoasExtra[], prazoDias, desdeEm }`; só documento **Vigente** exige treinamento; `desdeEm` só corre a partir da entrada em vigor e zera na revisão nova. Aposenta os dois controles paralelos antigos (designação nominal de leitura + subcoleção por documento) em favor da seção única 📚 Treinamento. Nova tela `src/features/documentos/MatrizTreinamentoTab.jsx` (arquivo próprio — `GestaoDocumentosTab` já tem 2,6 mil linhas): grid pessoa × documento com semáforo, 5 KPIs, filtros por cargo/situação, export CSV, "Meus treinamentos pendentes" com confirmação direta. Migração idempotente dos dados antigos (registro sem carimbo de versão não migra; documento já configurado não é sobrescrito).
  - **Fase 4 (PR #120, v2.31.0)** — reciclagem periódica: `treinamento.reciclagemMeses` por documento (em branco = não vence), contado da **data do treinamento**. Estado próprio **`vencido` (↻ roxo)**, separado de `atrasado` (vermelho) — reciclar quem já sabia × treinar quem nunca foi treinado são ações diferentes; reciclagem vencida não conta como conforme no KPI. `somarMeses` respeita fim de mês/ano bissexto. Fila de reciclagem na matriz (quem vence nos próximos 60 dias), KPI "A reciclar", coluna "Vence em" no CSV. Alerta ativo no `App.jsx` (mesmo desenho do alerta de prazo das RNCs): uma vez por dia, e-mail com atrasados + reciclagem vencida, reaproveitando `pendentesDoUsuario` da matriz. Limitação conhecida: dispara ao logar, não é job de backend autônomo (exigiria duplicar a regra de exigência em CommonJS no servidor).
  - Validado end-to-end no Docker com cenário semeado (documento `TESTE-PRO-001`, reciclagem 12 meses): pessoa com treino de 13 meses atrás aparece ↻ vencida; pessoa com treino de 11m10d aparece ✓ treinada mas na fila, vencendo em ~20 dias. 118 testes verdes ao final da Fase 4.
  - **Fix da Fase 4 (PR #122, v2.31.1)** — o `head` do CSV da matriz ficou com 9 títulos enquanto os dados passaram a escrever 10 colunas (`cel.venceEm`): a última saía sem título e leitura por índice desalinhava. Achado relendo o módulo antes da Fase 5.
  - **Fase 5 (PR #123, v2.32.0)** — **lista de presença assinada pelo instrutor**, o registro primário do treinamento presencial numa inspeção BPF. Antes o presencial era lançado uma pessoa por vez, sem instrutor explícito, sem carga horária, sem conteúdo e sem assinatura. Nova coleção `treinamento_sessoes` (numeração `TRN-YYYY-NN`, `src/features/documentos/sessoes.js` + `SessoesTreinamentoTab.jsx` em arquivo próprio): participantes **pré-carregados** de `exigidosDoDocumento` (o instrutor não monta a lista à mão) e ninguém nasce presente; **presença em lote**; encerramento com **assinatura eletrônica** (`AssinaturaModal`, papel "Instrutor do Treinamento") que só então grava as evidências dos presentes — sem assinatura não há registro de treinamento; **lista de presença em PDF** via `buildPDFShell` com `seloAssHTML`, igual à ata da RAC. Travas de `podeEncerrar`: data, carga horária, conteúdo, instrutor e ≥1 presente. Instrutor é sempre **interno** (assina com a própria senha) e **pode constar como participante** da sessão que ministra (caso do supervisor que treina a equipe num POP que ele também segue). O lançamento **avulso continua**, renomeado — nem todo presencial vira sessão formal.
  - ⚠️ **Decisão de arquitetura da Fase 5 — idempotência por SESSÃO, não pela chave lógica.** `evidenciasDaSessao` pula quem já tem evidência gravada **por aquela `sessaoId`** (+ id determinístico `<sessaoId>-<userId>`, então regravar sobrescreve). Travar por `chaveEvidencia(docId, versao, userId)` seria o reflexo natural e **quebraria a reciclagem da Fase 4**: quem está com reciclagem vencida treinou na *mesma versão* e precisa justamente de evidência nova. `indexarEvidencias` já resolve o resto, mantendo a evidência de maior `ts`. Há teste cobrindo os dois lados — não "consertar" isso para a chave lógica.
  - Fase 5 validada na tela (Docker): sessão TRN-2026-01 com o Lucas presente levou a conformidade de 67% (4/6) para **83% (5/6)**, "A reciclar" de 1 para **0**, e a célula dele de ↻ vencido para ✓ treinado — exatamente o que a idempotência por sessão preserva. **154 testes verdes** (118 → 154).
  - **Fase 6 (PR #126, v2.33.0) — cadastro de colaboradores separado de usuários.** Até aqui a exigência era derivada de `users`, ou seja, de quem tem **login**. Numa fábrica a maioria de quem treina em POP é operador, e operador não tem login: a conformidade media só o pessoal de escritório. Modelo SE Suite — cadastro de **funcionários** ≠ **usuários** do sistema. Nova coleção `colaboradores` (`src/features/colaboradores/`) com nome, matrícula, cargo, setor, `dataAdmissao`, `ativo` e `userId` opcional. `userId` presente/ausente virou regra de negócio: **só quem tem login confirma leitura sozinho**; quem não tem é treinado presencialmente, pela lista de presença da Fase 5 — o mecanismo já existia, faltava o cadastro de pessoas. As 4 funções puras (`exigidosDoDocumento`, `montarMatriz`, `filaDeReciclagem`, `pendentesDoUsuario`) passaram a receber `pessoas` em vez de `users`, mantendo a forma de saída (`userId`, `userName`) — por isso matriz, sessões, evidências e alerta não mudaram. Entram junto: importação de planilha do RH (CSV) com prévia; desligamento (`ativo:false` sai do cálculo, evidência permanece); e `exigidosSemLogin`, que avisa quando documento em modo *leitura* exige gente sem conta (pendência que ninguém conseguiria resolver).
  - ⚠️ **Decisão de arquitetura da Fase 6 — `colaborador.id` É IGUAL ao `users.id` para quem já tinha login.** As evidências guardam `userId: String(user.id)`; preservar o id manteve **todo o histórico resolvendo sem reescrever uma única evidência** — o que num SGQ é justamente o que não se pode fazer. Consequência: o campo da evidência **segue se chamando `userId`**, mas agora significa "id da pessoa". Renomear para `pessoaId` exigiria migrar registro imutável; a dívida de nomenclatura foi aceita conscientemente e está documentada no topo de `colaboradores.js`. Equivalência verificada contra o banco real antes do merge: lendo `users` e lendo `colaboradores` produzem resumo idêntico (103 exigências, 59 treinado, 20 atrasado, 12 vencido, 12 pendente).
  - **Fase 6 também fechou o "novo contratado nasce atrasado"**: o relógio do prazo virou `max(treinamento.desdeEm, colaborador.dataAdmissao)` em `statusCelula`. Antes, quem era admitido hoje aparecia atrasado há anos num POP antigo e levava cobrança por e-mail no primeiro login.
  - Fase 6 validada na tela: migração de 24 usuários → colaboradores com ids preservados e matriz inalterada; depois, operador **sem login** cadastrado entra na matriz com 4 exigências herdadas do cargo, denominador vai de 103 → 107 e a conformidade cai de 57% → 55%. **A queda é o resultado correto** — o número anterior era inflado por medir só quem tinha login. **189 testes verdes** (154 → 189).
  - ✅ **Descartado após conferência com o usuário (2026-08-06):** cogitou-se que documentos fora do status `Vigente` sumindo da matriz fosse lacuna grave. O perfil real do sistema oficial é **13 Vigentes, 1 Em Revisão, 35 Rascunho**, e os 35 **nunca vigoraram** (elaboração inicial). Logo não há lacuna: rascunho não exigir treinamento está correto, e eles entram na matriz quando forem aprovados. O único Em Revisão é janela pequena e conhecida — não vale mexer no ciclo de vida do documento por causa dele.
  - **Fase 7 (PR #128, v2.34.0) — exigência por cargo E setor.** Herdar só por cargo não separava a fábrica: encapsulamento, compressão, envase e mistura são **todos "Auxiliar de Produção"** na Herbamed, então um POP de encapsuladora cairia igual para os quatro. Quem discrimina hoje é o **setor**. Há proposta com o RH para desmembrar os cargos; quando isso acontecer, o filtro de setor pode ser removido e a regra continua valendo. **Regra** (em `exigidosDoDocumento`): só cargos → todos daquele cargo em qualquer setor; só setores → todos daqueles setores em qualquer cargo; **ambos → interseção** (quem tem aquele cargo *naquele* setor); nominais (`pessoasExtra`) sempre somam por fora. Vincular a **área** alcança todos os setores dela, vincular o **setor** alcança só ele (`localDaPessoa` + `pessoaEmSetores`). `doc.treinamento` ganha `setores[]`; `colaborador.setorId` + select hierárquico no cadastro, com o texto livre virando rótulo — mesmo par `cargo`/`cargoId` da Fase 1; a importação CSV resolve o setor pelo catálogo e, quando não acha, guarda o texto e sinaliza como não vinculado (diferente do cargo, que barra a linha).
  - ⚠️ **Decisão da Fase 7 — reusa o `catalogo_areas_setores_distribuicao` (PR #56), não cria catálogo novo.** O setor que recebe a cópia controlada impressa e o setor onde as pessoas trabalham são a **mesma realidade física**; dois cadastros divergiriam e ninguém saberia qual é o certo. Como efeito colateral bom, a hierarquia Área → Setor já existia pronta.
  - **Aviso de zero pessoas** (bloco vermelho na configuração, com teste fixando o comportamento): **não é polimento** — é a rede para o dia do desmembramento dos cargos, quando um documento filtrando por "Auxiliar de Produção" passará a resolver para zero e **sumiria da conformidade sem avisar**, inflando o indicador. Junto entra a **prévia ao vivo**, que mostra quem será exigido *antes* de salvar.
  - Fase 7 validada na tela (Docker, cenário semeado): `POP-PRO-002` (cargo + Encapsulamento) → **4 pessoas**, sem o Marcelo (supervisor da compressão); `POP-PRO-003` (cargo + Compressão) → **3**, sem a Larissa (supervisora do encapsulamento) — o mesmo cargo "Supervisor de Produção" entrando só no POP do seu setor é a prova da interseção; `POP-PRO-001` (só área PRO) → **13**; `EPI-SSM-001` (4 áreas) → **17**. Aviso de zero pessoas, prévia ao vivo e select hierárquico conferidos. **216 testes verdes** (189 → 216).
  - **Backlog remanescente** (não implementado): (1) **escala da tela** — com 49 documentos o cabeçalho vertical da matriz fica ilegível e não há paginação; (2) **evidência não pode ser anulada** — lançou no colaborador errado, não há caminho na tela; em BPF não se apaga, anula-se com justificativa e autor; (3) **PDF da matriz e ficha individual** da pessoa (hoje só CSV); (4) **avaliação de eficácia** do treinamento (prova/nota/verificação prática).
  - **Fase 8 (v2.40.0) — a lista de presença virou papel de verdade.** Três queixas do usuário, uma raiz cada. (1) **O PDF não tinha campo de assinatura manual** — só o selo eletrônico do instrutor, e quem não tem login (a maioria da fábrica, desde a Fase 6) não tem como assinar eletronicamente. A raiz era o PDF ter sido desenhado como *comprovante do que aconteceu*, não como *folha que vai para a sala*. Agora `exportListaPresencaPDF(sessao, doc, { modo })` sai em **dois modos**: `coleta` (emitida com a sessão ainda Planejada, botão "🖨️ Folha para assinatura") com quadradinho de presença e **linha de assinatura de próprio punho** por convocado + linha manual do instrutor; e `definitiva` (após encerrar) que mantém o selo eletrônico e **referencia o anexo digitalizado** — as assinaturas manuais vivem no anexo, não se pedem duas vezes. (2) **Quem já estava treinado e em dia saía "Ausente"** — `presente` era booleano, então "não convocado" e "faltou" colapsavam no mesmo valor, e imprimir falta que não houve é registro errado. Virou `SITUACAO` de **três estados** (`presente` / `ausente` / `dispensado` = "Não aplicável", este com **motivo obrigatório** travado em `podeEncerrar`); quem chega com treino válido **nasce dispensado** com o motivo pré-preenchido e a validade ("Treinamento válido, em dia até dd/mm/aaaa", de `statusCelula().venceEm`), mais o botão em lote "Dispensar quem está em dia". (3) **Não havia onde anexar a folha digitalizada** — nova seção 📎 na sessão, com `sessao.anexos[]`.
    - ⚠️ **Decisão: `presente` continua gravado como espelho de `situacao === "presente"`.** É o que `presentesDaSessao`/`evidenciasDaSessao` já leem, então **nenhuma sessão foi migrada**; `situacaoParticipante()` faz o fallback na leitura (`presente ? presente : ausente`) para o registro antigo. Sessão assinada é imutável — quem se adapta é a leitura, não o dado. Há teste dos dois lados.
    - ⚠️ **Decisão: o anexo pode entrar DEPOIS do encerramento e nunca sai.** A folha é assinada em papel e digitalizada horas ou dias depois — travar o encerramento nela pararia o fluxo (`podeEncerrar` **não** exige anexo, com teste fixando isso). Em sessão encerrada o anexo é **acréscimo, não alteração**: `comAnexos` carimba quem/quando e grava no `historico`, e `semAnexo` é no-op depois de assinada (anexou errado, anexa o certo — em BPF não se apaga). A falta dele vira **pendência visível** ("⚠️ lista física não anexada" no card e banner no detalhe), mesmo padrão do `recolhaPendente` das cópias controladas (PR #56).
    - `AnexosUpload` saiu de `RncTabs.jsx` para **`src/shared/AnexosUpload.jsx`** (terceiro módulo a usar), com `podeRemover`/`bloqueado`; `RncTabs` reexporta para não quebrar Desvios. O HTML da lista virou `buildListaPresencaHTML` (pura, testável sem abrir janela) — `exportListaPresencaPDF` só abre a janela.
    - Validado na tela (Docker, cenário semeado): `POP-PRO-002` → sessão TRN-2026-05 nasceu **0 presente · 2 ausente · 2 não aplicável**, com Bruno e Cleber dispensados automaticamente ("em dia até 10/07/2027" e "03/07/2027") em vez de ausentes; após assinar, a pendência de digitalização apareceu e sumiu ao anexar a folha, que passou a listar sem ✕. **298 testes verdes** (260 → 298).
  - **Cenário de teste** (PR #125): `node scripts/seedTeste.js` popula o banco **local** espelhando o perfil oficial — 49 documentos (13/1/35), 12 cargos de fábrica, 22 pessoas, 66 evidências com cobertura desigual. Atualizado na Fase 7 com os 4 setores de produção e um exemplo de cada forma de exigir (só cargo, só setor/área, cargo+setor). `--limpar` reverte. Recusa rodar fora de banco local e só remove o que ele mesmo criou.

- **Reforma dos Catálogos — 3 etapas (completa)** — a tela Admin → Catálogos acumulava **sete listas de assuntos diferentes**, e "Departamentos" (organograma) ficava encostado em "Setores de Desvio" e "Áreas e Setores" (locais físicos) como se fossem a mesma coisa. Diagnóstico do usuário: não sabia qual lista mexia em quê, listas de local repetidas, coisa demais na mesma tela. **Regra adotada (modelo SE Suite): catálogo usado por um módulo só mora dentro do próprio módulo, em ⚙️ Configuração; no Admin fica só o transversal.** Permissão **admin-only** em tudo — decisão explícita do usuário, nada de abrir para RT/keyuser. Resultado: **7 listas numa tela → 2 no Admin**.
  - **Etapa 1 (PR #132, v2.37.0)** — Tipos de Documento + Departamentos vão para Gestão de Documentos → ⚙️ Configuração. Junto, dois fixes: (a) o **prazo de revisão tinha DOIS campos** para a mesma coisa — o do catálogo gravava `prazoRevisaoAnos` e **ninguém lia**, quem valia era a grade separada em Admin → Configurações (`configuracoes/tipos_revisao`); agora é um campo só que escreve nos dois lugares, e tipo criado à mão deixou de cair nos 3 anos padrão (3º argumento de `prazoRevisaoTipo`); (b) a **árvore e o filtro de departamento liam a lista hardcoded**, então departamento novo não aparecia neles. Constantes extraídas para `src/features/documentos/tiposDoc.js` (evita ciclo de import; `GestaoDocumentosTab` reexporta).
  - **Etapa 2 (PR #134, v2.38.0)** — Tipos de Desvio, Setores de Desvio e Tipos de Revalidação vão para os respectivos módulos. Tipos e Setores de Desvio tinham o **mesmo editor duplicado linha a linha**; virou `src/shared/CatalogoSimples.jsx` (`{ nome, ativo }`), que já embute as duas regras do SGQ: item em uso **se desativa, não se exclui**, e **"Outros"** não pode ser renomeado/desativado/excluído. Revalidação ficou com tela própria (tem flag de material gráfico + checklist-semente).
  - **Etapa 3 (PR #135, v2.39.0)** — funde `catalogo_setores_desvio` (lista plana, só dos Desvios) em `catalogo_areas_setores_distribuicao` (hierárquico, já usado por distribuição de cópias, colaboradores e treinamento). **A hierarquia vence**, por já servir três módulos. Regras puras em `src/features/desvios/fusaoSetores.js` (`planoFusao`, `aplicarDecisoes`, `setoresDaHierarquia`, `usosNosDesvios`); `aplicarDecisoes` **não grava nada** — devolve o que gravar. A migração é uma **lista de decisões** item a item (`FusaoSetoresPainel`), mostrando quantos desvios dependem de cada setor, incluindo os que **sumiram do catálogo mas seguem carimbados em desvios** (os que ficariam órfãos sem ninguém ver). Migração parcial é permitida de propósito.
  - ⚠️ **Decisão da etapa 3 — o desvio continua gravando o NOME do setor, não um id.** Trocar para id obrigaria a reescrever todo desvio já registrado — mesma razão da Fase 6 com o id do colaborador. Consequência: **"criar o setor na área" não altera registro nenhum** (o nome gravado segue valendo), e só **"mapear para setor de outro nome"** reescreve — explicitamente, decidido pelo admin, com entrada no `historico` de cada desvio, como a reclassificação de "Outros" (v2.12.0).
  - ⚠️ **A lista do formulário de desvio é a UNIÃO hierarquia + legado enquanto houver pendência.** Em produção a hierarquia **já tinha setores**, então trocar de fonte de uma vez faria "Mistura 1" e companhia sumirem do formulário no dia do deploy, antes de o admin migrar. Conforme o painel resolve, a união vira a hierarquia sozinha. O filtro da lista também inclui setor ainda carimbado em desvio antigo (mesmo princípio da árvore de documentos na etapa 1: nada some sem aviso). Nenhuma coleção é apagada — `catalogo_setores_desvio` fica no banco como fallback e como origem do painel, então é reversível.
  - ⚠️ **Armadilha de PR empilhada (aconteceu):** a PR #133 (etapa 2) tinha como base a branch da #132 e foi mergeada **depois** que a #132 já havia ido para a main — o código foi parar na branch da #132, **não na main**, mesmo com o GitHub marcando a #133 como "merged". Teve de ser reaberta como #134 via cherry-pick sobre a main. **PR empilhada só chega na main se for mergeada antes da de baixo** — na dúvida, não empilhar.
  - **260 testes verdes** ao final (216 → 235 → 260).
  - **Pendente (opcional):** a branch abandonada `feat/catalogos-indice` (`a2e650a`) tem um `src/features/admin/catalogos.js` com **contagem de uso real por item** e trava "item em uso não se exclui". Independe de layout e atende a queixa "não sei qual lista mexe em quê" — vale resgatar numa PR pequena. O índice de 3 famílias da mesma branch ficou obsoleto com este desenho.

- **Repaginação da interface — 15 ondas (v3.0.0)** — reforma visual e de interação feita na branch `feat/nova-ui`, com ambiente paralelo próprio (`docker-compose.novaui.yml -p sgq-novaui` → **localhost:9030**, banco próprio) para o usuário usar no dia a dia antes de publicar. Direção escolhida na proposta visual: **navegação da Opção C** (abas no topo) com o **dashboard da Opção B** ("o que precisa de mim agora").
  - ⚠️ **A navegação nova é OPT-IN no deploy da 3.0.0.** `localStorage.sgq_nav` nasce em `"lateral"`, então quem receber a atualização continua vendo o **menu lateral de sempre**; a troca é um toggle no menu do avatar. Foi decisão explícita do usuário: publicar sem big-bang, acompanhar a adoção e inverter o padrão depois numa PR de uma linha (`=== "topo"` → `!== "lateral"`). Só a casca de navegação e a tela inicial "Precisa de você" ficam atrás do toggle (`navTopo` no `App.jsx`); **todo o resto entra ligado para todos**.
  - **Ondas 1-2 — navegação e tela inicial.** `src/layout/navegacao.js` é a fonte única das duas cascas (lateral e topo), então as duas nunca divergem de itens/permissões; `TopNav.jsx` (8 abas + segunda linha de subabas + busca Ctrl+K). `PrecisaDeVoce.jsx` + `pendencias.js` respondem "o que precisa de mim agora" cruzando RNC, desvios, documentos, laudos e treinamento.
  - **Ondas 3-4, 7-9 — tabela compartilhada.** `Table.jsx` + `tableLogic.js` (lógica pura, testável): ordenação, paginação, estado vazio, hover, densidade, navegação por teclado e seleção em lote. Migradas as listas de RNC, Desvios e CQ, mais a paginação de documentos da Matriz de Treinamento (resolve o item 1 do backlog de escala da Fase 7). A seleção em lote habilitou "encerrar desvios em massa".
  - **Ondas 5-6 — temas.** 4 temas novos, poda dos antigos, e paleta de dados única por tema (gráficos deixam de ter cores próprias descoladas do tema).
  - **Onda 10 — code-splitting por aba** (Desvios, CQ, Documentos), fechando o item que estava em "melhorias técnicas".
  - **Ondas 11-15 — campos append-only e edição de desvio.** Ver a seção própria abaixo.
  - Fora da numeração: criar/editar usuário virou modal (antes era inline no meio da lista); tema, modo formal e a troca de navegação saíram do cabeçalho para o menu do avatar.
  - Também na 3.0.0, fora da repaginação: **RAC ondas 11-12** — deliberação "Aprovar encerramento" e sinal de RNC emperrada na pauta (parte da Fase 2 da RAC, ver seção da RAC).

- **RNC e Desvios — texto de registro vira append-only (ondas 11-15 da nova-ui, v3.0.0)** — descrição, ação de contenção (RNC) e ação imediata (desvio) eram texto livre **sobrescrito na edição**: o que estava escrito antes sumia e sobrava só um resumo `"campo: velho → novo"` perdido no `historico` genérico. Num SGQ o texto original **é a evidência** — corrigir não pode significar apagar. Regra pedida pelo usuário: o texto já salvo fica **no próprio campo**, em leitura, com **login, data e hora entre parênteses**, e o acréscimo entra **no fim**.
  - ⚠️ **DECISÃO DE ARQUITETURA: o campo continua sendo UMA STRING, não virou array.** Tudo que lê `rnc.desc` / `desvio.acaoDesc` (PDF, Excel, e-mail, formulário do fornecedor, página pública do fornecedor, busca da lista, prefill desvio→RNC, indicadores) segue funcionando **sem alteração e sem migração de registro**. O que mudou é a **regra de escrita**: o texto gravado é prefixo imutável e a edição só acrescenta. Mesma razão do `userId` da Fase 6 e do nome do setor na etapa 3 dos catálogos.
  - Peça compartilhada em `src/shared/campoHistoricoLogic.js` (pura, 17 testes) + `CampoHistorico.jsx` (tela). ⚠️ O nome do arquivo de lógica **tem de diferir do componente por mais que a caixa** — `campoHistorico.js` e `CampoHistorico.jsx` colidem no Windows (case-insensitive) e o import resolve para o módulo errado, quebrando o build. Daí a convenção `...Logic.js`, igual a `tableLogic.js`/`Table.jsx`.
  - **O bloco original fica SEM carimbo de propósito** (sua autoria já está em "Registrado por X em Y"); só os acréscimos são carimbados. `blocosDoCampo` é **cosmético** — se o parse não reconhecer o formato, o bloco cai como texto puro, então registro antigo continua legível.
  - `white-space: pre-wrap` no `.desc-box`/`.contencao-box` do PDF e na página pública do fornecedor: sem isso os acréscimos sairiam colados num parágrafo só **no papel**, que é justamente onde a evidência importa.
  - **Desvio não tinha edição nenhuma** (onda 13). Agora edita **só desvio aberto** ("Registrado" — encerrado ou convertido em RNC é registro fechado), pela Qualidade (`triarDesvio`/admin) **ou por quem registrou** — o operador que digitou o setor errado precisa poder consertar sem depender de permissão de triagem. Junto entrou o **histórico do desvio na tela**: já era gravado desde sempre e nunca tinha sido exibido.
  - ⚠️ **Nenhuma onda intermediária pode deixar o sistema num estado onde dá para sobrescrever registro.** Por isso a onda 13 (edição de desvio) saiu **sem** os campos de texto, que só entraram na onda 14 já travados — o contrário teria publicado justamente o buraco que o trabalho veio fechar.
  - "Houve ação imediata?" **trava em "Sim"** quando já existe ação registrada: não se diz que não houve ação quando existe registro do que foi feito.
  - **Encerramento de desvio (onda 15):** era um `window.prompt` de uma linha **pré-preenchido com a ação imediata de quem abriu**, pedindo para digitar por cima — duas coisas diferentes no mesmo campo. Agora um modal separa: a **ação imediata** fica à vista em leitura e a **justificativa do encerramento** é campo próprio, obrigatório, que nasce em branco. O encerramento **em lote** continua no prompt simples, por decisão do usuário (rotina de triagem em massa, justificativa igual para todos).
  - **407 testes verdes** (390 → 407).

- **E-mail — Fase 0: o envio sai do navegador (v3.1.0)** — plano completo em `docs/PLANO_EMAIL_BACKEND.md`. Os quatro pontos de envio (modal de notificação, alerta de prazo de RNC, alerta de treinamento, relatório de RNCs) faziam `fetch` direto do navegador para a API do EmailJS, cada um com `service_id`/`template_id`/public key repetidos no bundle. Agora todos passam por `POST /api/email/send`, autenticado por sessão.
  - `server/email.js` seleciona o transporte por `EMAIL_TRANSPORTE` (`emailjs` | `graph` | `log`). **A Fase 1 é troca de variável de ambiente, não de código** — e o rollback também. `log` não envia nada (é o padrão do ambiente paralelo da nova-ui, que roda sobre banco de teste).
  - Nova tabela **`email_log`**, imutável (só INSERT): destinatário, evento, entidade vinculada, quem disparou, transporte, status, erro. Notificar é evidência — o `.catch(() => {})` dos dois alertas engolia exatamente isso.
  - ⚠️ **A premissa do plano estava errada e foi corrigida no próprio documento.** O plano afirmava que a API do EmailJS aceita chamadas fora do navegador sem mais nada. Testado contra a API real em 2026-08-21: responde **403 `"API access from non-browser environments is currently disabled"`** — mas conferindo o painel depois, essa opção **já estava ligada**, junto com *Use Private Key*. **A mensagem do EmailJS engana**: o que faltava era o `accessToken`, não a permissão. **Antes do deploy da 3.1.0** basta preencher `EMAILJS_PRIVATE_KEY`, sem mexer em configuração. Sem ela o envio para — mas para **com a falha registrada em `email_log`**, não em silêncio, que é o ponto. Restrição só do EmailJS; o Graph da Fase 1 não a tem.
  - **Conta EmailJS (conferida no painel, 2026-08-21):** titular é conta **pessoal** (`lukinhasb013@gmail.com`), do tempo em que o sistema não tinha domínio corporativo; o serviço `service_gxhicii` é **Outlook**, não Gmail como o plano dizia, conectado como **`lucas.rbr92@outlook.com`** (Personal Service, 300/dia) — ou seja, **o `From` que chega hoje na caixa das pessoas é a conta pessoal de uma pessoa física** com nome de exibição "Herbamed", que é a causa concreta da falha de DMARC; cota de **200 requisições/mês**. Não migrar a titularidade para a empresa — a conta deve ser **encerrada** ao fim da Fase 1, quando o `From` vira `sgq@herbamed.com.br`.
  - ⚠️ **Remetente e `Reply-To` deixaram de ser parâmetro** — vêm da sessão no servidor. Por isso `EmailModal` **não recebe mais `currentUser`**: o cliente não escolhe mais quem assina o e-mail. Falsificar o `From` da pessoa é o que quebra DMARC, e é o que a Fase 1 vem resolver.
  - ⚠️ **Falha parcial devolve `200`**, com a lista do que falhou — se cinco precisam ser notificados e um endereço está errado, os outros quatro são avisados de verdade em vez de o lote inteiro abortar. O que não pode é a falha sumir da tela: `src/features/email/enviarEmail.js` transforma a lista de falhas em erro visível. Endereço inválido **também** vira linha de log ("tentamos notificar e o endereço estava errado" é auditoria, não ruído de validação).
  - Limite de taxa por usuário conta **destinatários, não requisições** — o modal manda um e-mail por destinatário num laço, então limitar por requisição não seguraria nada.
  - Validado no Docker ponta a ponta: 401 sem sessão, 400 em destinatário/assunto inválidos, o 403 do EmailJS virando instrução acionável em vez de stack, e o modal da NC-2026-T08 gravando a linha vinculada à RNC. **38 testes de servidor verdes** (30 → 38).
  - **Próximo:** Fase 1 (transporte Graph) depende da TI — `docs/SOLICITACAO_TI_EMAIL_M365.md` está pronto para encaminhar.

- **Homologação de Fornecedores e Itens (PR #142, v3.2.0)** — o cadastro de fornecedor dizia **quem** é o fornecedor, mas não **o que** ele está aprovado a fornecer. Aprovar um fornecedor novo acontecia por e-mail e conversa: não havia registro de que a decisão foi analisada, por quem, com base em quê, nem até quando vale. Módulo novo no modelo SE Suite — decisão de aprovação vira registro rastreável e assinado. Coleção `homologacoes`, numeração `HOM-YYYY-NNNN`.
  - **Máquina de estados validada no servidor** (`server/homologacao.js`, `validateHomologacaoUpdate`): `Rascunho → Em análise → Aguardando aprovação → {Homologada | Condicional | Reprovada}`. Os três desfechos são **terminais** — registro finalizado não se altera, abre-se nova homologação. Transição pulada é rejeitada com 409.
  - **Segregação de funções na própria transição**, não só na permissão: quem emite o parecer não pode ser o solicitante; quem dá a decisão final não pode ser nem o solicitante nem o parecerista; a assinatura tem de pertencer ao usuário autenticado (`validateSignatureOwner`). `Condicional` exige condições registradas. 4 permissões novas (`verHomologacoes`, `criarHomologacao`, `avaliarHomologacao`, `aprovarHomologacao`).
  - `statusEfetivo()` deriva **Vencida** da validade da decisão **sem tocar no `status` gravado** — mesmo princípio do `rncAtiva()`: o estado calculado não vira dado. Checklists documental e técnico são derivados da **categoria** (matéria-prima, embalagem, insumo, produto acabado, serviço, outro). PDF pelo `buildPDFShell`, seção "Escopos de Homologação" na ficha do fornecedor, coleção no log de auditoria.
  - **Revisão de usabilidade (mesma versão, commits seguintes).** Diagnóstico do usuário: "muito complexa e de difícil preenchimento". A causa não era falta de dica — o formulário pedia **duas coisas ao mesmo tempo**: solicitar a homologação e **configurar o instrumento de avaliação**. Para uma matéria-prima eram ~34 controles, 21 deles a configuração do checklist (obrigatoriedade e critério de cada linha), decisão de Qualidade caindo em quem só queria pedir. Sintoma no código: uma coluna morta escrita `"Situação preenchida na análise"`. Resultado: solicitação foi de ~34 para ~13 controles.
  - ⚠️ **O dado gravado NÃO muda em nenhum dos commits.** `documentos[]` e `checklistTecnico[]` mantêm a forma; o que mudou é **quem edita o quê**. Zero migração, registro já criado abre normalmente. Mesma razão do `userId` da Fase 6 do treinamento e do nome do setor na etapa 3 dos catálogos.
  - ⚠️ **`"Não aplicável"` exigir justificativa é CONTRAPARTIDA, não polimento.** Ao tirar do solicitante o poder de configurar o checklist, esse poder foi para o parecerista, que dispensa item marcando "Não aplicável". Sem exigir justificativa (como `Reprovado` e `Não conforme` já exigiam), a mudança teria apenas criado um jeito **silencioso de pular item obrigatório**. Não afrouxar isso.
  - ⚠️ **`ABA_DO_CAMPO` existe para campo obrigatório novo não cair em aba fechada.** Com o formulário dividido em abas, uma pendência numa aba não-ativa ficaria invisível e o botão recusaria o envio sem o usuário ver por quê. A aba mostra o contador de pendências e o envio salta para a primeira com erro. **Qualquer campo obrigatório novo precisa entrar nesse mapa.**
  - ⚠️ **Ordem das ondas importou:** as abas (item 4) só entraram **depois** da validação por campo (item 3), nunca antes — o contrário teria publicado justamente o buraco que o trabalho veio fechar. Mesmo cuidado das ondas 13/14 da nova-ui.
  - Erros de validação passaram a carregar o campo/linha a que pertencem (`{campo, msg}` + `erroPorChave`), o `F` compartilhado ganhou a prop **`err`** (label vermelho, anel no controle, mensagem embaixo) e os **7 `alert()` sumiram**. Pendências só aparecem após a primeira tentativa de envio e somem ao vivo conforme são corrigidas. **15 campos ganharam `tip`** — o `Tooltip` já existia e este módulo não usava nenhum (a RNC usa 53). Stepper do fluxo (Solicitação → Análise técnica → Aprovação → Decisão) com **quem faz cada etapa**, no formulário e no detalhe: a segregação de funções só existia como regra no servidor e agora aparece na tela. `motivo` deixou de vir pré-respondido como "Produto novo" e passou a ser exigido — remover o default sozinho deixaria o campo vazio sem ninguém notar.
  - **Fix de bug pré-existente junto (`Tooltip`, vale para os 76 do sistema):** havia um `show` único manipulado por três handlers — o `onMouseEnter` ligava e o `onClick` seguinte alternava para desligado, então **clicar no "?" fechava a dica**; no toque, onde o tap dispara os dois juntos, ela não aparecia. Agora são dois estados: `hover` mostra enquanto o ponteiro está em cima e o clique **fixa** (`fixo`), que é o que permite ler a dica e ainda mexer no campo.
  - Validado na tela (Docker): contador de pendências caindo de 5 para 4 ao preencher, salto de aba no envio, troca de categoria para Serviço refazendo as listas (6 critérios, com SLA, sem os de amostra/ensaio), e o tooltip abrindo, fixando e fechando fora. **420 testes de frontend** (407 → 420) e **44 de servidor** verdes.
  - **Backlog** (não implementado): (1) **reavaliação periódica** do fornecedor homologado — hoje a validade só marca `Vencida`, não há fila nem alerta de vencimento nos moldes da reciclagem de treinamento; (2) **vínculo com RNC** — RNC recorrente de fornecedor deveria repercutir na homologação (suspender, exigir reavaliação); (3) **indicadores** do módulo; (4) checklists por categoria são fixos no código — viraria catálogo configurável se a Qualidade quiser mexer sem deploy.

### ⏭️ Próximas seções
- Seções 15, 16 (conforme roadmap)
- **Inverter o padrão da navegação** (`sgq_nav`) depois de acompanhar a adoção da 3.0.0

### 🗓️ RNC — Reunião de Análise Crítica (RAC) — Fase 1 entregue em v2.22.0; Fases 2/3 pendentes
Proposta visual original (14 seções, esboço de tela, data model): artifact `https://claude.ai/code/artifact/3cd73fc6-4888-4a7a-99ae-ee5d3fd36b22`.

Diagnóstico que originou o módulo: a RNC **media** muito bem (KPIs, Pareto, Matriz GUT, PDCA, tempo médio, reincidência) mas **não registrava decisão de gestão**. A reunião semanal acontecia na sala e não voltava pro sistema — sumia o encaminhamento, quem ficou responsável, e a evidência de que a direção analisou. Numa inspeção ANVISA/BPF a pergunta é "me mostre a análise crítica das NCs". Modelo SE Suite: **fórum com memória**, não um novo relatório. Regra-chave da implementação: **costurar, não reconstruir** — e manter **fonte única**: a deliberação age na própria RNC (via `doUpdateRNC` + `historico`), nunca num documento paralelo.

**O que a Fase 1 entregou** (aba 🗓️ Reuniões, `src/features/rnc/ReunioesTab.jsx`):
- Entidade `rnc_reunioes` com numeração `RAC-YYYY-NN` e ciclo Agendada → Em andamento → Encerrada.
- **Pauta automática** — `candidatasPauta()` traz toda RNC que pede atenção da gestão (vencida / crítica sem `assinaturaRT` / pendente de verificação / em tratamento), ordenada por GUT; o facilitador ajusta antes de agendar. Cada item carrega o `motivoEntrada` (por que entrou na pauta).
- **Deliberação por item que age na própria RNC** (fonte única, sem registro paralelo): `manter`, `reforcar_prazo` (grava `prazoAC` novo) e `cobrar` (abre `openEmail`). Toda deliberação grava entrada no `historico` da RNC ("Deliberado na RAC-xx", com `tipo:"reuniao"` e `detalhes`) + campo `ultimaReuniao` na RNC.
- **Encerramento com ata assinada** — só encerra com todos os itens deliberados; `AssinaturaModal` com papel "Facilitador da Análise Crítica" → `exportAtaReuniaoPDF` via `buildPDFShell` (rosto verde padrão) usando `seloAssHTML`.
- Permissão `gerenciarReunioesRNC` (default: rt/keyuser/admin). Sem a permissão a aba é somente leitura + ata em PDF.

**Achados da implementação (corrigem o desenho original):**
- ⚠️ **`firebase.js` não precisou ser tocado.** `subscribeCollection`/`saveCollection`/`deleteFromCollection` já são genéricos por nome de coleção, e `handleCollections` em `server/index.js` atende `/api/collections/:nome/:id` **sem whitelist** — coleção nova nasce funcionando, zero backend, zero migração. Vale para qualquer coleção futura.
- **`calcGut`/`gutRank` foram extraídos** de dentro do `DashTab` para o topo do `RncTabs.jsx` e exportados — a Matriz GUT do Dashboard e a pauta da RAC precisam concordar sobre o que é prioritário. Refactor verificado como idêntico ao inline antigo nas 80 combinações de sev × prazo × status.

**Fase 2 (próxima):** delta "desde a última reunião" (abriram/encerraram/venceram na janela) + sinal de **RNC emperrada** (3+ reuniões sem sair); assinatura de presença dos participantes; notificações (lembrete de reunião agendada/atrasada nos moldes do alerta de prazo do `App.jsx`, notificar participantes ao encerrar) + recorrência semanal; deliberações **Escalar** e **Aprovar encerramento** (→ EficaciaTab).
**Fase 3:** indicadores da reunião (aderência da pauta, RNCs emperradas, presença/quórum, vazão semanal) + integração no Dashboard Executivo.

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

### 🔭 CQ — Reanálise periódica + Obsolescência de embalagem (norte, auditoria 2026-07-10)
Ideia levantada: como revalidar um material que já foi analisado no recebimento e está parado no estoque há algum tempo — garantir que ainda está íntegro/atual (ex.: matéria-prima, rótulos, cartuchos). **Hoje não existe:** o CQ (`cq_fichas`) é só análise de recebimento (evento único na entrada), sem data de reanálise/validade, sem fila de vencimento, sem controle de obsolescência e **sem módulo de estoque/almoxarifado**.

⚠️ **Bloqueio conhecido (decisão do usuário 2026-07-10):** não há tempo agora para alimentar o saldo de estoque do almoxarifado; qualquer fila de reanálise depende de saber o que ainda está em estoque. **Adiado para quando houver mais tempo.** Isto é só o norte.

São **dois mecanismos distintos** (como SE Suite/SAP separam) — não confundir:

1. **Matéria-prima / insumos → reanálise por tempo (retest / validade).** É degradação físico-química. Campos no lote/RA: `dataFabricacao`, `validade` e/ou `periodoReteste` (este último **configurável por tipo de material** no Admin → Catálogos, igual ao `prazoRevisaoAnos` dos tipos de documento) → calcula `proximaReanalise`. Fila/alerta de "materiais vencendo reanálise" (clone da revisão periódica dos Documentos + aging dos Desvios, com e-mail nos moldes do alerta de prazo das RNCs). A reanálise vira nova ficha RA vinculada ao lote original (histórico); aprovou reseta `proximaReanalise`, reprovou dispara RNC automática (já existe) + segregação (a disposição com aprovação já existe). Análogo ao **tipo de inspeção 09 / inspeção recorrente do SAP QM** (data dispara e status do lote bloqueia o consumo até passar).

2. **Rótulos / cartuchos → obsolescência por versão (change control), NÃO reanálise.** Embalagem impressa não "estraga" — o risco é a **arte/texto ter sido revisada** (nova dosagem, novo registro ANVISA, layout). O material em estoque fica **obsoleto** e deve ser **segregado/destruído**, não reanalisado. Amarrar cada item de embalagem à **arte aprovada (documento controlado / versão)**; quando o documento é revisado, o estoque da versão anterior vira **pendência de segregação** — reusando o padrão `recolhaPendente` da Gestão de Documentos (PR #56). O ensaio de recebimento "Impressão/texto — conforme aprovado" continua cobrindo a entrada; a obsolescência cobre o que já entrou e envelheceu no estoque.

Recomendação registrada: quando retomar, começar pela opção **leve** (campo de situação em estoque por lote — Em estoque / Consumido / Segregado — mantido manualmente pela Qualidade, suficiente para gerar a fila) e deixar a **integração ERP/almoxarifado** (SAP-style, fonte real de saldo) como evolução ligada à Seção 17 (infra da TI).

### Infra — Aviso de nova versão + fim do cache do índice (v2.14.0)
Problema: usuários ficavam presos em versões antigas (aba aberta há dias e/ou `index.html` cacheado pelo navegador). Solução em duas camadas:
- **Camada 1 (`nginx/default.conf`):** `index.html` e `version.json` passam a responder `Cache-Control: no-store, must-revalidate` — o navegador sempre revalida o "índice" que aponta para o JS novo. Assets com hash no nome seguem com cache de 1 ano `immutable` (o nome muda a cada versão, então é seguro).
- **Camada 2 (app):** `scripts/genVersion.js` roda no `prebuild` e gera `public/version.json` (`{ version, builtAt }`) a partir da versão do `package.json`. O componente `src/shared/AtualizacaoDisponivel.jsx` (montado no `App.jsx`, nas duas saídas: exec e principal) consulta `/version.json` a cada 3 min e ao voltar o foco para a aba; se a versão publicada divergir de `APP_VERSION`, mostra uma faixa fixa "Nova versão disponível — Atualizar agora" que faz `window.location.reload()`. **Não recarrega sozinho** (evita perder preenchimento em andamento).
- `public/version.json` é gerado no build (gitignored). Depende de `package.json.version` e `APP_VERSION` estarem em sincronia — o que o protocolo já exige.
- **Observação:** só passa a funcionar para versões publicadas **a partir do deploy da 2.14.0** (quem está numa versão anterior ainda não tem o verificador). A TI deve confirmar que o `nginx-proxy` externo também não segura cache do `index.html`.

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

#### Fix visual — contraste dos botões de assinatura (v2.41.1)
Os botões **Revisor** e **Aprovador** trocavam **só o `background`** do `btnA` por uma cor sólida e mantinham `color`/`border` no `T.accent`: no tema Professional saía **texto verde `#1a7a3c` sobre azul sólido `#0066cc`** — praticamente ilegível. Novo helper **`btnCor(cor)`** em `src/shared/styles.js` devolve a receita inteira do `btnA` na cor pedida (fundo `${cor}18`, texto e borda na cor) — que é o que o `btnD` já fazia em vermelho; os botões de assinatura é que eram a exceção. Elaborador = `accent`, Revisor = `blue`, Aprovador = `orange`. Mesmo bug corrigido em `LaudosTab.jsx` ("🔬 Assinar como RT"), a terceira e última ocorrência do padrão.
⚠️ **Fundo sólido com texto branco foi descartado de propósito:** nos temas escuros `blue`/`orange` são claros (`#4fc3f7`, `#ff8c42`) e o branco por cima some. A pílula esmaecida funciona nos 8 temas — conferido em Professional e Dark Premium.

#### Distribuição — recebedor, data real e rastro da recolha (v2.41.0)
Diagnóstico do usuário: o modal não tinha "recebido por" nem "data". Confirmado no código — o registro provava que **alguém entregou**, não que alguém **recebeu**, e `dataEntrega` era `tod()` cravado (entrega de sexta registrada na segunda ficava gravada como segunda). Numa distribuição de cópia controlada o registro que a inspeção quer é o do **recebedor**: é dele que se cobra a devolução quando a versão vira obsoleta.
- **`recebidoPor` obrigatório**, escolhido na coleção **`colaboradores`** (Fase 6) — **com e sem login**, porque quem recebe cópia impressa no chão de fábrica é operador e operador não tem conta. Usar `users` aqui repetiria o erro que a Fase 6 corrigiu. A lista sai agrupada: primeiro os lotados no destino (`colaboradoresDoDestino`, respeitando setor × área inteira), depois o resto, mais "Outra pessoa (digitar)" para quem ainda não está cadastrado.
- **`dataEntrega` editável**, default hoje, sem aceitar data futura.
- ⚠️ **A recolha ARQUIVA em vez de apagar.** `removerDistribuicao`/`marcarRecolhida` só filtravam a linha fora: sumia a prova de que o setor teve (e devolveu) a cópia daquela revisão, e a evidência ficava só no `auditLog`, fora do documento. Agora as duas passam pelo mesmo modal (data, `recolhidoPor`, `devolvidoPor` — este pré-preenchido com quem recebeu) e gravam em **`doc.historicoDistribuicao[]`** (`comRecolha` / `comRecolhaObsoleta`, com `motivo: "recolha" | "obsoleta"`), exibido num `<details>` na própria seção.
- Regras puras em **`src/features/documentos/distribuicao.js`** (`chaveDestino`, `destinoDaSelecao`, `validarDistribuicao`, `novaCopiaFisica`, `colaboradoresDoDestino`, `registroDeRecolha`, `validarRecolha`, `comRecolha`, `comRecolhaObsoleta`) + 28 testes. `chaveDestino` unifica o `destinoKey || legado:setor` que estava repetido em três lugares — **registro antigo, sem `destinoKey` e sem recebedor, continua sendo lido e recolhido normalmente**, sem migração.
- Validado na tela: cópia registrada em PRO/Encapsulamento recebida por Cleber Antunes (operador **sem login**) com data 14/08 (não a de hoje); após recolher, o histórico mostrou o ciclo inteiro — *"Entregue em 14/08/2026 a Cleber Antunes · recolhida em 17/08/2026 por Administrador SGQ (devolvida por Cleber Antunes)"*. **288 testes verdes** (260 → 288).

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
- ✅ **Code-splitting:** feito na onda 10 da nova-ui (Desvios, CQ, Documentos) — v3.0.0
- ✅ **Keyboard navigation:** feita na onda 7 para o `Table.jsx` — v3.0.0 (falta o resto da aplicação)
- **Testes unitários:** componentes shared
- **Dark mode:** variante para Formal
