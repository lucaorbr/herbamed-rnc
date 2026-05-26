# Migração do SGQ Herbamed para PostgreSQL local + integração Areco

## Objetivo

Remover a dependência do Firebase como banco/autenticação e manter todos os dados do SGQ dentro do servidor da empresa, rodando em Docker.

Arquitetura alvo:

```text
Areco SQL Server
somente leitura
      |
      | sincronizacao a cada 3 minutos
      v
Backend SGQ Node.js  ---> PostgreSQL SGQ
      ^
      |
Frontend React
```

Portas alvo:

```text
frontend: 9027
backend:  9028
postgres: 5487 externo -> 5432 interno
```

## Estado atual

O projeto já está dockerizado com `frontend`, `backend` e `db`, mas o frontend ainda depende do arquivo `src/firebase.js`.

Dependências atuais do Firebase:

- Login: Firebase Auth.
- Usuários: coleção `users`.
- RNCs: coleção `rncs`.
- Dados genéricos: `saveCollection`, `subscribeCollection`, `deleteFromCollection`.
- Contadores diários: coleção `meta`.
- Auditoria: coleção `audit_log`.

Coleções/tipos usados hoje:

```text
users
rncs
fornecedores
audit_log
auditorias
clientes_terceiros
cq_fichas
cq_templates
cq_materiais
cq_analises
gestao_docs
gestao_docs/{docId}/treinos
fmea
laudos
ipc_registros
ipc_produtos
producao_processos
producao_config_refugo
```

## Estratégia recomendada

Fazer a migração em etapas, sem reescrever todas as telas de uma vez.

### Fase 1 - Backend e banco local

Criar um backend Node.js com:

- Conexão PostgreSQL local.
- Login local com senha hash (`bcrypt` ou `argon2`).
- Sessão via JWT em cookie HTTP-only ou bearer token.
- Rotas CRUD genéricas para substituir `saveCollection`, `subscribeCollection` e `deleteFromCollection`.
- Rotas específicas para usuários, RNCs e contadores.
- Tabela de auditoria.
- Migrations versionadas.

### Fase 2 - Compatibilidade com o frontend

Substituir `src/firebase.js` por um client HTTP mantendo a mesma assinatura aproximada:

```js
loginUser(email, password)
logoutUser()
getUser(uid)
saveUser(uid, data)
updateUser(uid, data)
deleteUser(uid)
getAllUsers()
saveRNC(id, data)
updateRNC(id, data)
deleteRNC(id)
subscribeRNCs(cb)
incrementCounter()
peekDailyCounter()
saveCollection(colName, id, data)
deleteFromCollection(colName, id)
subscribeCollection(colName, cb)
getCollection(colName)
```

Observação: `subscribeCollection` hoje usa realtime do Firestore. No backend local, a primeira versão pode usar polling curto no frontend, ou endpoints REST simples. Depois pode evoluir para Server-Sent Events ou WebSocket.

### Fase 3 - Integração Areco

Criar um worker no backend que roda a cada 3 minutos:

1. Conecta no SQL Server do Areco em modo somente leitura.
2. Consulta recebimentos recentes.
3. Normaliza dados de nota, fornecedor, produto, lote, quantidade e datas.
4. Faz upsert no PostgreSQL local.
5. Marca cada item como `pendente_analise`.
6. Evita duplicidade com uma chave externa única.

Chave externa sugerida:

```text
areco_origem + areco_tabela + areco_id_item + numero_nf + codigo_produto + lote
```

### Fase 4 - UI de qualidade

Alterar a tela de CQ para consumir os recebimentos importados:

- Lista "Recebimentos pendentes de análise".
- Botão "Iniciar análise".
- Ao iniciar, criar/associar uma `cq_analise`.
- Não exigir mais cadastro manual de NF/material quando vier do Areco.
- Manter cadastro manual como exceção controlada.

## Modelo de banco proposto

### users

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'user',
  setor text,
  crf text,
  assinatura jsonb,
  permissoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  online boolean NOT NULL DEFAULT false,
  ultimo_acesso timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### generic_documents

Tabela compatível para migrar as coleções atuais sem precisar criar uma tabela específica para cada tela logo no início.

```sql
CREATE TABLE generic_documents (
  collection text NOT NULL,
  id text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection, id)
);

CREATE INDEX idx_generic_documents_collection_updated
ON generic_documents (collection, updated_at DESC);
```

### rncs

Pode começar em `generic_documents`, mas o ideal é ter tabela própria:

```sql
CREATE TABLE rncs (
  id text PRIMARY KEY,
  num text,
  status text,
  sev text,
  resp text,
  prazo_ac date,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### audit_log

```sql
CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  ts bigint,
  data timestamptz NOT NULL DEFAULT now(),
  usuario text,
  email text,
  user_id text,
  acao text NOT NULL,
  colecao text,
  doc_id text,
  doc_nome text,
  dados_antes jsonb,
  dados_depois jsonb
);
```

### counters

```sql
CREATE TABLE counters (
  key text PRIMARY KEY,
  value integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### areco_recebimentos

```sql
CREATE TABLE areco_recebimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_key text NOT NULL UNIQUE,
  origem text NOT NULL DEFAULT 'areco',
  nf_numero text,
  nf_serie text,
  fornecedor_codigo text,
  fornecedor_nome text,
  produto_codigo text,
  produto_nome text,
  lote text,
  quantidade numeric,
  unidade text,
  data_emissao date,
  data_entrada timestamptz,
  status text NOT NULL DEFAULT 'pendente_analise',
  cq_analise_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_areco_recebimentos_status
ON areco_recebimentos (status, data_entrada DESC);
```

### areco_sync_state

```sql
CREATE TABLE areco_sync_state (
  source text PRIMARY KEY,
  last_success_at timestamptz,
  last_cursor text,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

## API proposta

### Autenticação

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Usuários

```text
GET    /api/users
GET    /api/users/:id
POST   /api/users
PATCH  /api/users/:id
DELETE /api/users/:id
```

### RNC

```text
GET    /api/rncs
POST   /api/rncs/:id
PATCH  /api/rncs/:id
DELETE /api/rncs/:id
```

### Coleções compatíveis

```text
GET    /api/collections/:collection
PUT    /api/collections/:collection/:id
DELETE /api/collections/:collection/:id
```

### Recebimentos Areco

```text
GET  /api/areco/recebimentos?status=pendente_analise
POST /api/areco/sync/run
GET  /api/areco/sync/status
POST /api/areco/recebimentos/:id/iniciar-analise
```

## Integração Areco

Conexão validada em modo leitura:

```text
Tipo: Microsoft SQL Server 2022
Banco: VSatHerbamed
Host/porta: configurar por variáveis de ambiente
```

Importante: as credenciais nunca devem entrar no Git. Usar `.env` no servidor:

```env
ARECO_SQLSERVER_HOST=10.0.242.230
ARECO_SQLSERVER_PORT=5327
ARECO_SQLSERVER_DATABASE=VSatHerbamed
ARECO_SQLSERVER_USER=...
ARECO_SQLSERVER_PASSWORD=...
ARECO_SYNC_INTERVAL_MS=180000

POSTGRES_DB=sgqherbamed
POSTGRES_USER=sgqherbamed
POSTGRES_PASSWORD=...
DATABASE_URL=postgres://sgqherbamed:senha@db:5432/sgqherbamed

JWT_SECRET=trocar_em_producao
```

Tabelas candidatas identificadas no Areco para recebimento:

```text
Entradas_Notas
Det_Entr_Notas_Fiscais
Nota_Fiscal
it_Nota_Fiscal
Fornecedores
ControleLotes
Lanc_Estoque
LancLotes
CtrlRecebimentoNFE
RlcOCRecebMateriais
Ordem_Compras
Det_Ord_Compra
```

Próxima investigação necessária:

1. Refinar a consulta de lote, pois o lote pode depender da movimentação exata de estoque.
2. Confirmar com usuários do Areco quais status de nota devem entrar no SGQ.
3. Confirmar se a data incremental deve ser `dt_EntregaMerc` ou outra data operacional.
4. Validar uma amostra de entradas recentes com o almoxarifado/qualidade.

Consulta base testada somente leitura:

```sql
SELECT TOP (200)
  det.id_ItemNotaFiscalEntrada AS areco_id,
  en.cd_NotaFiscal AS nf_numero,
  en.SerieNF AS nf_serie,
  en.dt_EntregaMerc AS data_entrada,
  en.dt_notaFiscal AS data_emissao,
  f.id_Forn AS fornecedor_codigo,
  ent.Nome AS fornecedor_nome,
  det.id_Produto AS produto_codigo,
  prod.produto_nome,
  det.qtdItem AS quantidade,
  det.id_unidMed AS unidade,
  lote.Nro_lote AS lote
FROM Entradas_Notas en
JOIN Det_Entr_Notas_Fiscais det ON det.id_NotaFiscalEntrada = en.id_NotaFiscalEntrada
LEFT JOIN Fornecedores f ON f.id_Forn = en.id_Forn
LEFT JOIN Entidade ent ON ent.Id_Ent = f.Id_Ent
OUTER APPLY (
  SELECT TOP 1 v.ds_Prod AS produto_nome
  FROM ViewConsultaProdutos v
  WHERE v.id_Produto = det.id_Produto
) prod
OUTER APPLY (
  SELECT TOP 1 cl.Nro_lote
  FROM ControleLotes cl
  WHERE cl.id_Produto = det.id_Produto
    AND (cl.id_Forn = en.id_Forn OR cl.id_Forn IS NULL)
  ORDER BY cl.id_LoteMercEntradaSaida DESC
) lote
WHERE en.dt_EntregaMerc >= DATEADD(day, -7, GETDATE())
ORDER BY en.dt_EntregaMerc DESC;
```

## Ordem de implementação recomendada

1. Criar migrations PostgreSQL. Concluido.
2. Criar backend com pool Postgres e healthcheck de banco. Concluido.
3. Criar autenticação local. Concluido.
4. Criar usuário admin inicial por seed. Concluido via variaveis `INITIAL_ADMIN_*`.
5. Implementar API compatível com `src/firebase.js`. Concluido.
6. Trocar `src/firebase.js` para usar API local. Concluido.
7. Testar login, usuários e RNC.
8. Migrar coleções genéricas.
9. Criar worker Areco. Concluido, desativado por padrao.
10. Criar tela/lista de recebimentos pendentes.
11. Associar recebimento importado a análise CQ.
12. Remover dependências Firebase do `package.json`. Concluido.

## Riscos e decisões

- Realtime do Firestore precisa ser substituído. Começar com polling é mais simples; WebSocket/SSE fica para depois.
- Senhas precisam ser migradas ou recriadas, porque Firebase Auth não expõe hash de senha facilmente.
- Anexos hoje usam Cloudinary/Supabase; se a regra for "tudo local", também será necessário criar storage local no backend.
- O Postgres criado no Docker ainda não contém o schema final; ele é apenas a base para a migração.
- A integração Areco deve ser somente leitura e idempotente.

## Próximo passo antes de implementar

Confirmar estas decisões:

1. O login será local com usuário/senha no Postgres?
2. Os anexos também precisam ficar dentro do servidor da empresa?
3. O SGQ deve importar apenas recebimentos de matéria-prima/material de embalagem ou qualquer entrada de estoque?
4. O item importado deve ir direto para `CQ - Análises` ou para uma nova tela "Recebimentos pendentes"?
5. O intervalo de sincronização de 3 minutos está confirmado para produção?
