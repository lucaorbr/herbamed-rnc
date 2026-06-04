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
