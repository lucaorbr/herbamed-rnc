# Integração de RNCs do SGQ com o sistema do Almoxarifado

## 1. Objetivo

Este documento é o handoff técnico para implementar, no sistema do Almoxarifado, uma cópia somente leitura das RNCs cadastradas no SGQ Herbamed.

O fluxo deve:

1. importar todas as RNCs existentes na primeira execução;
2. consultar o SGQ novamente a cada 60 segundos;
3. inserir RNCs novas e atualizar RNCs já importadas;
4. não criar duplicidades, mesmo após falha ou reinício;
5. permitir a obtenção dos anexos vinculados às RNCs, se o Almoxarifado precisar deles.

## 2. O que já foi preparado no SGQ

Foi criada uma API específica para integração servidor-a-servidor:

- `GET /api/integrations/rncs`: lista RNCs de forma paginada e incremental;
- `GET /api/integrations/rnc-files/{id}`: baixa somente arquivos que estejam referenciados como anexos de alguma RNC;
- autenticação exclusiva pelo cabeçalho `X-API-Key`;
- acesso somente leitura;
- cursor opaco e estável, baseado no horário de alteração do registro e no ID;
- retorno das criações e também das alterações feitas posteriormente em uma RNC;
- limite de até 500 RNCs por página.

Não use `GET /api/rncs` para esta integração. Essa rota é destinada à interface do SGQ, exige login de usuário e usa um JWT com validade de 12 horas.

## 3. Liberação no servidor do SGQ

### 3.1 Gerar a chave

No servidor do SGQ, gere uma chave forte. Exemplo em Linux:

```bash
openssl rand -hex 48
```

No PowerShell:

```powershell
$bytes = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
```

### 3.2 Configurar o SGQ

Acrescente a chave gerada ao `.env` do SGQ:

```dotenv
RNC_INTEGRATION_API_KEY=COLE_A_CHAVE_GERADA_AQUI
```

O script de configuração gera essa variável automaticamente apenas em instalações novas. Como ele não altera um `.env` já existente, instalações atuais precisam receber a linha manualmente.

Reconstrua e reinicie o backend:

```bash
docker compose up -d --build backend
docker compose logs --tail=100 backend
```

Se a variável não estiver configurada, a API responderá `503`. A chave nunca deve ser colocada no código-fonte, no frontend React, em URL, em log ou neste documento.

### 3.3 Configurar o Almoxarifado

Cadastre a mesma chave no gerenciador de segredos ou no `.env` exclusivo do backend do Almoxarifado:

```dotenv
SGQ_BASE_URL=http://HOST_DO_SGQ:9027
SGQ_RNC_API_KEY=COLE_A_MESMA_CHAVE_AQUI
```

Use preferencialmente a URL HTTPS oficial do SGQ. Na instalação Docker atual, a porta `9027` passa pelo Nginx e encaminha `/api/*` ao backend. Não faça essa consulta diretamente pelo navegador do usuário; a chamada deve partir do backend do Almoxarifado para não expor a chave.

Também é recomendável restringir no firewall o acesso à API ao IP do servidor do Almoxarifado.

## 4. Teste manual de acesso

Linux/macOS:

```bash
curl --fail-with-body \
  -H "X-API-Key: $SGQ_RNC_API_KEY" \
  "$SGQ_BASE_URL/api/integrations/rncs?limit=2"
```

PowerShell:

```powershell
$headers = @{ "X-API-Key" = $env:SGQ_RNC_API_KEY }
Invoke-RestMethod `
  -Uri "$($env:SGQ_BASE_URL)/api/integrations/rncs?limit=2" `
  -Headers $headers
```

Resultado esperado: HTTP `200`, um array `items` e um objeto `page`. Teste também com chave incorreta; o resultado esperado é HTTP `401`.

## 5. Contrato da API de RNCs

### Requisição

```http
GET /api/integrations/rncs?limit=500&cursor=CURSOR_OPACO
X-API-Key: CHAVE_SECRETA
```

Parâmetros:

| Parâmetro | Obrigatório | Regra |
|---|---:|---|
| `limit` | não | padrão `100`; mínimo `1`; máximo `500` |
| `cursor` | não | omitir na primeira carga; depois reenviar exatamente o `page.nextCursor` recebido |

### Resposta

```json
{
  "items": [
    {
      "id": "1784749200000",
      "num": "RNC-EXEMPLO",
      "data": "2026-07-22",
      "status": "Aberta",
      "tipo": "Matéria-prima",
      "sev": "Maior",
      "produto": "Produto exemplo",
      "fornecedor": "Fornecedor exemplo",
      "setor": "Almoxarifado",
      "detector": "Colaborador",
      "desc": "Descrição da não conformidade",
      "lote": "LOTE-01",
      "nf": "12345",
      "qtd": "10 caixas",
      "ref": "Referência interna",
      "contencao": "Material segregado",
      "resp": "Responsável pela análise",
      "prazoAC": "2026-08-10",
      "anexos": [],
      "ishikawa": {},
      "w2h": [],
      "eficacia": {},
      "historico": [],
      "_sync": {
        "createdAt": "2026-07-22T13:00:00.000Z",
        "updatedAt": "2026-07-22T13:05:00.000Z"
      }
    }
  ],
  "page": {
    "count": 1,
    "limit": 500,
    "hasMore": false,
    "nextCursor": "CURSOR_OPACO"
  },
  "generatedAt": "2026-07-22T13:06:00.000Z"
}
```

Os campos funcionais da RNC são um JSON evolutivo. Além dos campos do exemplo, podem existir `prazoCausa`, `prazoEfic`, `evidencia`, `respCont`, `dataContencao`, `origemAnalise`, `origemDesvio`, `origemDesvioNum`, `respostaFornecedor`, `assinaturaRT` e outros acrescentados pelo SGQ no futuro.

Regras importantes:

- `id` é o identificador imutável da RNC no SGQ e deve ser a chave de idempotência no Almoxarifado;
- `_sync.updatedAt` é o horário técnico do servidor do SGQ. Use-o para auditoria e resolução de versões;
- `generatedAt` não substitui o cursor;
- o cursor é opaco: não decodifique, não monte e não altere seu conteúdo;
- uma página vazia devolve o cursor recebido, permitindo mantê-lo sem alteração;
- a API não garante que campos opcionais estarão preenchidos;
- datas funcionais, como `data` e `prazoAC`, usam normalmente `YYYY-MM-DD`; metadados `_sync` usam ISO 8601 em UTC.

## 6. Modelo recomendado no Almoxarifado

Adapte os nomes ao banco existente, mas preserve no mínimo:

```sql
CREATE TABLE rnc_sgq (
  sgq_id              text PRIMARY KEY,
  numero              text,
  status              text,
  severidade          text,
  produto             text,
  fornecedor          text,
  lote                text,
  descricao           text,
  source_updated_at   timestamptz NOT NULL,
  payload             jsonb NOT NULL,
  synced_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE integration_state (
  integration_name    text PRIMARY KEY,
  cursor              text,
  last_success_at     timestamptz,
  last_error          text
);
```

O `payload` integral evita perda de campos que o modelo relacional do Almoxarifado ainda não conhece. As colunas separadas servem para filtros, buscas e telas.

## 7. Algoritmo obrigatório de sincronização

### 7.1 Carga inicial

1. Ler o cursor salvo em `integration_state`; na primeira execução ele será nulo.
2. Chamar `/api/integrations/rncs?limit=500` sem `cursor`.
3. Fazer `upsert` de cada item usando `id` como chave única.
4. Na mesma transação do banco, salvar `page.nextCursor` após os itens.
5. Se `page.hasMore` for `true`, buscar imediatamente a próxima página com o cursor recém-salvo.
6. Repetir até `page.hasMore` ser `false`.

### 7.2 Consulta a cada minuto

Depois da carga inicial, execute o mesmo algoritmo a cada 60 segundos, agora enviando o cursor persistido. A rota retornará somente registros criados ou modificados depois desse ponto.

Não use um `setInterval` que possa iniciar uma segunda execução antes do fim da primeira. Use um job com trava distribuída, se houver mais de uma instância do Almoxarifado, ou agende a próxima execução somente após a atual terminar.

### 7.3 Atomicidade e repetição segura

O cursor só pode avançar depois que todos os itens da página tiverem sido gravados com sucesso. Grave itens e cursor na mesma transação. Se ocorrer falha antes do commit, repita a página; o `upsert` por `sgq_id` torna essa repetição segura.

Pseudocódigo:

```text
sincronizar():
  adquirir trava "sgq-rncs"
  cursor = carregar_cursor("sgq-rncs")

  repetir:
    resposta = GET /api/integrations/rncs?limit=500&cursor=cursor

    transação:
      para cada rnc em resposta.items:
        UPSERT rnc_sgq por rnc.id
        nunca sobrescrever com versão cujo _sync.updatedAt seja mais antigo

      salvar resposta.page.nextCursor em integration_state

    cursor = resposta.page.nextCursor
  enquanto resposta.page.hasMore

  registrar last_success_at
  liberar trava
```

## 8. Exemplo de cliente em Node.js

O outro Codex deve adaptar este exemplo ao framework, ORM, banco e scheduler que já existirem no Almoxarifado:

```js
const BASE_URL = process.env.SGQ_BASE_URL;
const API_KEY = process.env.SGQ_RNC_API_KEY;

async function getPage(cursor) {
  const url = new URL("/api/integrations/rncs", BASE_URL);
  url.searchParams.set("limit", "500");
  if (cursor) url.searchParams.set("cursor", cursor);

  const response = await fetch(url, {
    headers: { "X-API-Key": API_KEY },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`SGQ respondeu ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function syncRncs(db) {
  // Use a trava/lock equivalente fornecida pelo banco ou pelo scheduler do projeto.
  await db.withLock("sgq-rncs", async () => {
    let cursor = await db.getIntegrationCursor("sgq-rncs");
    let hasMore;
    do {
      const response = await getPage(cursor);
      await db.transaction(async tx => {
        for (const rnc of response.items) {
          await tx.upsertRncBySgqId(rnc.id, rnc, rnc._sync.updatedAt);
        }
        await tx.saveIntegrationCursor("sgq-rncs", response.page.nextCursor);
      });
      cursor = response.page.nextCursor;
      hasMore = response.page.hasMore;
    } while (hasMore);
  });
}

async function tick(db) {
  try {
    await syncRncs(db);
  } catch (error) {
    await db.recordIntegrationError("sgq-rncs", String(error));
  } finally {
    setTimeout(() => tick(db), 60_000);
  }
}
```

## 9. Anexos

Cada anexo local retornado em `rnc.anexos` recebe um `integrationUrl`, por exemplo:

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "foto-lote.jpg",
  "type": "image/jpeg",
  "size": 245810,
  "integrationUrl": "/api/integrations/rnc-files/123e4567-e89b-12d3-a456-426614174000"
}
```

Para baixar:

```http
GET /api/integrations/rnc-files/123e4567-e89b-12d3-a456-426614174000
X-API-Key: CHAVE_SECRETA
```

Concatene `SGQ_BASE_URL` com `integrationUrl`. O endpoint só entrega um arquivo se ele estiver referenciado por uma RNC. Anexos legados que apontem para armazenamento externo podem não ter `integrationUrl`; nesse caso, registre a ocorrência e não tente reutilizar credenciais humanas do SGQ.

Não é necessário baixar todos os anexos durante cada sincronização. Guarde os metadados e baixe sob demanda ou apenas uma vez, validando o `id` do arquivo.

## 10. Erros e retentativas

| HTTP | Significado | Ação |
|---:|---|---|
| `200` | sucesso | gravar itens e cursor |
| `400` | cursor ou `limit` inválido | não apagar o cursor; alertar a TI e investigar |
| `401` | chave ausente/incorreta | interromper retentativas rápidas; revisar segredo |
| `404` | anexo não existe ou não pertence a uma RNC | registrar e continuar as demais RNCs |
| `503` | chave não configurada no SGQ ou serviço indisponível | manter cursor e tentar depois |
| `5xx`/rede | falha temporária | manter cursor e usar backoff; o job normal de 60 s pode tentar novamente |

Nunca zere o cursor automaticamente por causa de erro. Isso causaria uma carga completa desnecessária.

## 11. Atualizações e exclusões

A sincronização incremental entrega tanto RNCs novas quanto RNCs editadas, pois usa `_sync.updatedAt` do banco do SGQ.

Exclusões físicas feitas no SGQ não geram tombstone nesta versão da API. Portanto, uma RNC já copiada não será removida automaticamente do Almoxarifado. Como o requisito atual é importar as RNCs cadastradas e acompanhar novas/alteradas, o consumidor deve manter o registro histórico. Se no futuro houver exigência formal de espelhar exclusões, implemente tombstones no SGQ antes de remover dados no destino.

## 12. Segurança e operação

- Trate a chave como senha de serviço e rotacione-a periodicamente.
- Use HTTPS quando o tráfego sair do host ou de uma rede isolada.
- Não envie a chave em query string; somente em `X-API-Key`.
- Não registre cabeçalhos HTTP completos em logs.
- Dê ao job apenas permissões de `SELECT/INSERT/UPDATE` nas tabelas necessárias do Almoxarifado.
- Monitore `last_success_at`; alerte se não houver sucesso por mais de 5 minutos.
- Registre quantidade recebida, duração e status, mas não o payload integral em logs.
- O endpoint não permite criar, editar ou excluir RNC no SGQ.

## 13. Checklist de aceite

- [ ] A chave foi configurada somente nos backends do SGQ e do Almoxarifado.
- [ ] Uma chamada sem chave ou com chave errada retorna `401`.
- [ ] A carga inicial percorre todas as páginas e traz todas as RNCs existentes.
- [ ] Executar a carga novamente não duplica registros.
- [ ] Uma RNC nova aparece no Almoxarifado em até aproximadamente 60 segundos.
- [ ] Uma alteração de status/descrição também aparece em até aproximadamente 60 segundos.
- [ ] Falha entre o download e o commit não avança o cursor.
- [ ] Reiniciar o Almoxarifado retoma do cursor persistido.
- [ ] Duas instâncias não executam o mesmo job simultaneamente.
- [ ] Anexo de RNC pode ser baixado com `integrationUrl` e a chave técnica.
- [ ] Métrica/alerta identifica sincronização parada por mais de 5 minutos.

## 14. Instrução pronta para o outro Codex

Entregue este arquivo ao chat que trabalha no sistema do Almoxarifado e solicite:

> Implemente integralmente a integração descrita neste documento, respeitando a arquitetura e as convenções existentes neste repositório. Primeiro inspecione o framework, o banco, o ORM, o sistema de migrations, o scheduler e o gerenciamento de segredos já usados. Crie migration, cliente HTTP, serviço de sincronização idempotente, persistência transacional do cursor, trava contra concorrência, job de 60 segundos, logs/monitoramento, testes automatizados e instruções de configuração. Não coloque a API key no frontend nem no código. Ao final, execute os testes e apresente os arquivos alterados e o checklist de aceite.
