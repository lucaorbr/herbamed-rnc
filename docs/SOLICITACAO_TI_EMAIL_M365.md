# Solicitação à TI — Envio de e-mail do SGQ pelo Microsoft 365

**Sistema:** SGQ Herbamed (`sgq.herbamed.com.br`)
**Solicitante:** Lucas Ribeiro de Oliveira — Garantia da Qualidade
**Data:** 20/08/2026 · *atualizado em 21/08/2026*

## Contexto

O SGQ envia notificações por e-mail: abertura e movimentação de não conformidade (RNC), alertas de
prazo vencido, cobrança de treinamento obrigatório e comunicação com fornecedor.

Hoje essas mensagens saem por um serviço externo, com remetente que **não pertence ao domínio
`herbamed.com.br`**. Como o domínio publica SPF/DKIM/DMARC, essas mensagens falham na validação e são
tratadas como suspeitas — caem em lixo eletrônico ou são barradas pelo próprio Exchange. É a causa
provável de notificações que não chegam.

**Verificado em 21/08/2026:** o remetente configurado nesse serviço é uma **conta pessoal do Outlook, de
pessoa física** (do tempo em que o sistema ainda não rodava sob o domínio da empresa), com o nome de
exibição escrito como se fosse da Herbamed. Além do problema de entrega, isso significa que hoje as
notificações oficiais do sistema da qualidade saem em nome de um indivíduo e não da empresa — o que não
se sustenta em auditoria e é o motivo de estarmos tratando isso agora.

O pedido é passar o envio para o Microsoft 365 da empresa, para que as mensagens saiam de dentro do
tenant, com autenticação válida, entrega interna garantida e rastreabilidade no message trace.

## O que precisamos (4 itens)

### 1. Caixa postal de envio

Criar `sgq@herbamed.com.br` (ou o nome que a TI preferir padronizar).

Pode ser **shared mailbox** — não consome licença. É só o remetente das notificações do sistema.

### 2. Registro de aplicativo no Entra ID (Azure AD)

- **Nome sugerido:** `SGQ Herbamed — Envio de Notificações`
- **Permissão:** Microsoft Graph → `Mail.Send` → **tipo Aplicação** (*Application*, não *Delegated*)
- **Consentimento do administrador** concedido para essa permissão
- **Client secret** gerado (ou certificado, se for a política da TI)

### 3. Restrição de escopo do aplicativo — obrigatório

Sem esta política, a permissão `Mail.Send` de aplicação permite enviar e-mail **como qualquer caixa
do tenant**. Precisamos que o app fique restrito **apenas** à caixa do item 1.

No Exchange Online PowerShell:

```powershell
New-ApplicationAccessPolicy `
  -AppId <client-id-do-item-2> `
  -PolicyScopeGroupId sgq@herbamed.com.br `
  -AccessRight RestrictAccess `
  -Description "SGQ Herbamed - envio somente pela caixa sgq@"

# conferência
Test-ApplicationAccessPolicy -Identity sgq@herbamed.com.br -AppId <client-id-do-item-2>
```

### 4. Liberação de rede

Saída HTTPS (443) do servidor onde o SGQ roda para:

- `login.microsoftonline.com` (obtenção do token)
- `graph.microsoft.com` (envio)

## O que precisamos de volta

| Item | Onde encontrar |
|---|---|
| **Directory (tenant) ID** | Entra ID → Visão geral |
| **Application (client) ID** | Entra ID → o app criado no item 2 |
| **Client secret** | gerado no item 2 — **enviar por canal seguro** |
| **Endereço da caixa** | o do item 1 |
| **Data de expiração do secret** | para renovarmos antes de vencer |

⚠️ **O client secret não deve ser enviado por e-mail ou WhatsApp.** Cofre de senhas, entrega presencial
ou o canal que a TI usar para credenciais. No servidor ele fica em variável de ambiente, nunca no
código-fonte nem no repositório.

## O que NÃO estamos pedindo

Para deixar claro o escopo: **não** pedimos acesso de leitura a caixas de ninguém, nem `Mail.Read`,
`Mail.ReadWrite` ou permissão delegada em nome de usuários. Apenas o envio, e apenas por uma caixa.

## Alternativa, se a TI preferir não criar registro de aplicativo

Um **conector de relay SMTP** autorizando o IP do servidor do SGQ resolve o envio **interno** com bem
menos configuração e sem credencial.

A limitação: mensagens para fora (fornecedores respondendo RNC) tendem a ficar limitadas ou barradas
nesse modelo. Se a TI preferir esse caminho, precisamos saber para ajustar o que o sistema envia
externamente.

Observação: o caminho com **senha da caixa postal via SMTP AUTH** (basic auth) não foi proposto porque
a Microsoft anunciou a desativação desse método (setembro/2025). Se ainda estiver habilitado no tenant,
a TI pode nos dizer — mas seria uma solução com prazo de validade.

## Preparação já feita do nosso lado

A parte de software já está pronta e testada (versão 3.1.0 do SGQ). O envio saiu do navegador e passou
para o servidor, atrás de um seletor de transporte: quando os dados dos itens 1 a 4 chegarem, a mudança é
**só de variável de ambiente**, sem alterar código e sem nova entrega — e o rollback também. Passou a
existir também um registro interno de cada envio (destinatário, data, e o erro quando falha), que hoje
não existia.

## Prazo

Não bloqueia o sistema: enquanto a configuração não sai, as notificações continuam saindo pelo caminho
atual. Mas enquanto isso não for feito, **parte das notificações do SGQ não chega ao destinatário** —
inclusive alertas de prazo de ação corretiva, que têm impacto em auditoria — e o remetente segue sendo
uma conta pessoal.

Qualquer dúvida sobre o funcionamento do sistema, estou à disposição.
