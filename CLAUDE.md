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
