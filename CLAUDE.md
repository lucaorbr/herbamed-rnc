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

## Versão do sistema
- Versão atual: `3.2.0`
- A versão exibida no sistema deve vir de `src/config/appVersion.js` e acompanhar a versão do `package.json`.
- Usar versionamento semântico no formato `MAJOR.MINOR.PATCH`.

---

## Status do Roadmap
Veja `/memory` — as memórias contêm:
- **roadmap-status.md** — o que foi completado, o que falta, 8 itens backlog
- **se-suite-principios.md** — modelo de referência (SE Suite)
- **decisoes-arquitetura.md** — fonte única, append-only, IDs preservados, segregação funcional
- **versionamento-semantico.md** — regras de versioning MAJOR.MINOR.PATCH
- **infra-docker-nginx.md** — configuração Docker, rede, cache, versionamento navegador
- **protocolo-trabalho.md** — protocolo de trabalho completo

## Próximos Passos
1. **RNC — RAC Fases 2/3** — delta de resumo, RNC emperrada, assinatura de presença, notificações
2. **Desvios — Backlog priorizado** — disposição de material (maior lacuna), rigor no encerramento, investigação leve, dono, notificação de atraso, recorrência, PDF, polimento
3. **E-mail — Fase 1** — transporte Graph M365 (espera Solicitação TI)
4. **Inverter padrão de navegação** — depois de acompanhar adoção da 3.0.0
