# Plano — Envio de e-mail do SGQ para o backend (Microsoft 365 / Graph)

> Status: proposta, aguardando liberação da TI para a Fase 1.
> Documento irmão: `docs/SOLICITACAO_TI_EMAIL_M365.md` (o que a TI precisa configurar).

## Por que mudar

O envio atual foi montado no começo do sistema, quando o SGQ rodava sob domínio próprio, sem tenant
corporativo e sem TI envolvida. Era adequado àquele contexto. Hoje o domínio é da empresa e três
consequências tornam o desenho insustentável:

1. **Identidade do remetente / DMARC.** O e-mail sai de um serviço Gmail conectado ao EmailJS,
   dizendo ser da Herbamed. O tenant Microsoft publica SPF/DKIM/DMARC para `herbamed.com.br`, e uma
   mensagem que se diz Herbamed vinda de fora dessa lista **falha DMARC** — cai em lixo eletrônico ou
   é rejeitada pelo próprio Exchange da empresa. A API responde `200 OK` e a mensagem nunca chega.
   Nenhum ajuste de código corrige isso; só a troca de transporte.
2. **Credencial exposta.** `service_id`, `template_id` e a public key estão no bundle JavaScript, em
   quatro lugares — qualquer pessoa que abra o JS envia e-mail em nome da Herbamed a partir de um
   navegador.

   > **Correção (2026-08-21, durante a Fase 0):** o que este item afirmava — que a API aceita chamadas
   > fora do navegador sem mais nada — está **errado**. Testado contra a API real: responde `403 "API
   > access from non-browser environments is currently disabled"`. Conferido depois no painel: *Allow
   > EmailJS API for non-browser applications* **já está ligado**, e *Use Private Key (recommended)*
   > também — ou seja, **a mensagem do EmailJS engana**: o que faltava no teste era o `accessToken`, não
   > a permissão. Consequência prática: a Fase 0 precisa só da **private key** em `EMAILJS_PRIVATE_KEY`,
   > sem mexer em configuração. Nada disso protege o bundle (do navegador o envio segue livre para
   > qualquer um) e é a última vez que importa — o Graph da Fase 1 não tem essa restrição.
3. **Envio depende de aba aberta.** Os dois alertas diários rodam em `useEffect` no login
   (`src/app/App.jsx:287` e `:333`). Quem está de férias ou não entrou no sistema **nunca é avisado**
   do prazo vencido — exatamente o cenário em que o alerta serviria.

Somam-se: cota de 200 e-mails/mês no plano free (e o modal gasta **uma por destinatário**, num laço),
falhas engolidas em silêncio (`.catch(() => {})`) e **nenhum registro de envio** — que num SGQ é a
lacuna mais grave depois da identidade, porque notificar é evidência.

## Onde o e-mail é enviado hoje

Não existe nada de e-mail no backend. Todo envio é `fetch` do navegador para a API REST do EmailJS:

| Origem | Arquivo:linha | Observação |
|---|---|---|
| Modal de notificação | `src/features/email/EmailModal.jsx:95-121` | 1 requisição por destinatário |
| Alerta de prazo de RNC | `src/app/App.jsx:287` | 1×/dia, só ao logar; erro silenciado |
| Alerta de treinamento | `src/app/App.jsx:333` | 1×/dia, só ao logar; erro silenciado |
| Relatório de RNCs | `src/features/rnc/RncTabs.jsx:1954` | envio manual |

Os gatilhos de RNC (criar, mudar status, Ishikawa, CAPA, eficácia, deliberação da RAC) **não enviam
sozinhos**: chamam `openEmail(...)`, que só abre o modal (`App.jsx:418`). Quem envia é a pessoa.

## Decisões de arquitetura

**Transporte: Microsoft Graph (`POST /users/{caixa}/sendMail`) com client credentials.**
A Microsoft aposentou o basic auth do SMTP AUTH (desativação anunciada para setembro/2025), então
senha de caixa postal provavelmente não é mais opção no tenant — a TI confirma. Graph é o caminho
suportado, não exige `nodemailer` (é `fetch`, zero dependência nova), não tem cota de terceiro e
aparece no *message trace* do Exchange para a TI.

**Remetente fixo, resposta para o usuário.** `From: SGQ Herbamed <sgq@herbamed.com.br>` e
`Reply-To:` o e-mail de quem disparou. **Nunca** falsificar o `From` da pessoa — é o que quebra DMARC.

**O front não muda de forma.** O modal, a escolha de destinatários e o corpo continuam iguais; só a
URL do `fetch` troca para `/api/email/send`. Raio de mudança: 4 pontos.

**O log de e-mail é registro, não debug.** `email_log` é imutável e vinculado à RNC/documento, para
sustentar "notificamos o responsável em tal data" numa inspeção.

## Fases

### Fase 0 — Fundação no backend ✅ entregue (v3.1.0)

Tira o envio do navegador **mantendo o EmailJS como transporte**, atrás de um adaptador. Entrega
valor sozinha e deixa a Fase 1 como troca de variável de ambiente.

- `server/email.js`: `enviarEmail({ para, assunto, corpo, replyTo, meta })` + seleção de transporte
  por env `EMAIL_TRANSPORTE=emailjs|graph|log`. `log` não envia nada (uso local/teste).
- Migration da tabela **`email_log`** em `server/migrate.js`: destinatário, assunto, evento,
  entidade vinculada (`rncId`/`docId`), quem disparou, status, erro, `messageId`, timestamp.
- `POST /api/email/send`, autenticado por sessão. Valida destinatário e aplica limite de taxa.
- Front: os 4 pontos da tabela acima passam a chamar `/api/email/send`. **Credenciais saem do bundle**
  e vão para `.env` (que já está no `.gitignore`).
- Os `.catch(() => {})` dos alertas passam a registrar falha no `email_log`.
- Testes em `server/email.test.js` (`npm run test:server`) na montagem da mensagem e na validação.

Ganho imediato: chave fora do bundle, falha visível, evidência de notificação. Versão: **3.1.0**.

**O que ficou diferente do previsto:**
- O `Reply-To` e o nome do remetente **deixaram de ser parâmetro** — vêm da sessão no servidor. Como
  efeito, `EmailModal` não recebe mais `currentUser`: o cliente não escolhe mais quem assina o e-mail.
- **Falha parcial devolve `200`**, com a lista do que falhou, e não erro. Se cinco pessoas precisam ser
  notificadas e um endereço está errado, as outras quatro são avisadas de verdade — o que não pode
  acontecer é a falha sumir da tela, e por isso o cliente (`enviarEmail.js`) transforma a lista de
  falhas em erro visível.
- **Antes de fazer o deploy**, preencher `EMAILJS_PRIVATE_KEY` — ver a correção no item 2 de "Por que
  mudar". Sem ela o envio para de funcionar (com a falha registrada em `email_log`, não em silêncio).

**Estado da conta EmailJS, conferido no painel em 2026-08-21** (importa porque tudo aqui morre na Fase 1):
titular é uma **conta pessoal** (`lukinhasb013@gmail.com`), do tempo em que o sistema não tinha domínio
corporativo. O serviço `service_gxhicii` é **Outlook**, não Gmail como este documento dizia. A cota é de
**200 requisições/mês** (ciclo reinicia dia 30) — e o modal gasta uma por destinatário, então uma
notificação para 8 pessoas consome 4% do mês. Não vale migrar a titularidade para a empresa: a conta
deve ser **encerrada** ao fim da Fase 1, e a caixa corporativa nasce direto no M365.

### Fase 1 — Transporte Graph (depende da TI)

- Adaptador `graph`: token por client credentials em `login.microsoftonline.com` (cache do token, que
  expira em ~1h) e `POST https://graph.microsoft.com/v1.0/users/{caixa}/sendMail`.
- Env novas: `M365_TENANT_ID`, `M365_CLIENT_ID`, `M365_CLIENT_SECRET`, `MAIL_FROM`.
- **A troca é só de variável de ambiente** — nenhum código de front muda, e o rollback é voltar a env.
- Validação: enviar para um interno e conferir nos cabeçalhos que DKIM e DMARC passam; conferir que a
  mensagem aparece no message trace da TI.
- Depois de validado: **desativar a conta EmailJS** e remover o adaptador antigo (a public key está
  queimada — está publicada no bundle desde sempre).

Sugestão de versão: **3.2.0**. Exige configuração da TI antes do deploy (passo 7 do protocolo).

### Fase 2 — Fila e retentativa

- `email_log` ganha o estado `enfileirado`; o endpoint enfileira e responde na hora, sem travar o
  modal esperando o Graph.
- Worker com `setInterval` **no mesmo padrão do `server/arecoSync.js:627`**, que já roda daemon dentro
  do processo Node — não é infra nova. Backoff em falha transitória.
- Chave de idempotência por evento, para não duplicar notificação em retentativa.

### Fase 3 — Alertas viram job de servidor

Fecha a limitação registrada no `CLAUDE.md` (Fase 4 da Matriz de Treinamento).

- Daemon diário envia os alertas de prazo de RNC e de treinamento **independente de alguém logar**.
- O bloqueio registrado era a regra de exigência morar em ESM no front e o servidor ser CommonJS —
  mas o Node importa ESM a partir de CJS com `await import()`, então **`treinamento.js` é reusado
  como está**, sem duplicar regra (que é o que não se pode fazer: duas cópias divergem).
- Remover os dois `useEffect` de `src/app/App.jsx` e as travas de `localStorage` (`hm_last_alert`,
  `hm_last_alert_treino`), que passam a ser controle do servidor.
- **Junto vai a promoção automática para Vigente**: hoje `dataVigencia` também é avaliada no navegador
  (`src/features/documentos/GestaoDocumentosTab.jsx:638`), apesar de o `CLAUDE.md` descrever a Fase 8
  como cronjob. Mesma classe de problema, mesmo job resolve.

### Fase 4 — Visibilidade e governança

- Tela admin do log de e-mail: quem foi notificado, quando, o que falhou.
- "Notificações enviadas" no histórico da RNC e no PDF — a notificação vira evidência auditável.
- Allowlist de domínio externo e limite de taxa por usuário.

### Fase 5 (opcional, decisão de processo — não técnica)

Hoje **todo** envio é manual: o sistema abre o modal e alguém decide. Com transporte confiável, passa
a ser viável notificar automaticamente por regra (ex.: RNC crítica aberta → notifica o RT na hora).
Isso muda o processo da Qualidade, então é conversa com o usuário antes de virar código.

## Riscos e travas

- **O `client_secret` nunca entra no repositório** — vive só no `.env` do servidor, que já está no
  `.gitignore`. Secret do Entra ID expira: anotar a data e renovar antes (senão o envio para de
  funcionar sem aviso — a Fase 0 garante que isso apareça no log em vez de sumir).
- **Sem a `ApplicationAccessPolicy` (item 3 do pedido à TI), a permissão `Mail.Send` de aplicação
  deixa o SGQ enviar e-mail como qualquer pessoa do tenant.** Esse item não é opcional.
- A public key do EmailJS está queimada desde o primeiro deploy; considerar a conta comprometida e
  encerrá-la ao fim da Fase 1.
