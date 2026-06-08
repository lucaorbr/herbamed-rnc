# Herbamed RNC em Docker

## Subir em producao local

Se o `.env` ainda nao existir, gere automaticamente:

```bash
sh scripts/setup-production-env.sh
```

No Windows PowerShell:

```powershell
.\scripts\setup-production-env.ps1
```

Depois suba:

```bash
docker compose up --build -d
```

A aplicacao fica disponivel em:

```text
http://localhost:9027
```

Servicos e portas:

```text
frontend: http://localhost:9027
backend:  http://localhost:9028
banco:    localhost:5487 -> container:5432
nginx corporativo: sgq-frontend:80 na rede herbamed_proxy
```

## Variaveis de ambiente

O SGQ usa o PostgreSQL do proprio Docker como banco oficial. O banco do Areco e usado apenas para consulta/leitura quando a sincronizacao estiver ativada.
Arquivos anexados, COAs, fichas tecnicas e documentos controlados tambem ficam no PostgreSQL local do Docker, na tabela `stored_files`. Novos uploads nao sao enviados para Cloudinary, Supabase ou outra plataforma externa.

O script de setup ja gera `POSTGRES_PASSWORD` e `JWT_SECRET`. Para habilitar os recursos de IA que chamam `/api/claude`, defina:

```bash
ANTHROPIC_API_KEY=sua_chave
POSTGRES_DB=sgqherbamed
POSTGRES_USER=sgqherbamed
POSTGRES_PASSWORD=troque_esta_senha
JWT_SECRET=troque_este_segredo
INITIAL_ADMIN_EMAIL=admin
INITIAL_ADMIN_PASSWORD=Herba@123
FILE_UPLOAD_MAX_BYTES=15728640
BACKUP_INTERVAL_SECONDS=86400
BACKUP_RETENTION_DAYS=30
```

Conta padrao para testes:

```text
Usuario: admin
Senha:   Herba@123
```

Para ativar a consulta automatica ao Areco a cada 3 minutos:

```bash
ARECO_SYNC_ENABLED=true
ARECO_SYNC_INTERVAL_MS=180000
ARECO_SQLSERVER_HOST=10.0.242.230
ARECO_SQLSERVER_PORT=5327
ARECO_SQLSERVER_DATABASE=VSatHerbamed
ARECO_SQLSERVER_USER=fabiano.alves
ARECO_SQLSERVER_PASSWORD=senha
```

O sync importa recebimentos e tambem materiais/produtos do Areco para o cadastro `CQ - Materiais`. Se a estrutura do Areco variar no servidor, as consultas podem ser sobrescritas pelas variaveis `ARECO_RECEBIMENTOS_QUERY` e `ARECO_MATERIAIS_QUERY`.

Por padrao, a carga de materiais tenta importar todos os produtos encontrados no Areco. Para limitar a carga inicial, defina `ARECO_MATERIAIS_LIMIT` com um numero maior que zero.

Importante: a integracao Areco e somente leitura. O SGQ nao cria, altera ou remove dados no banco do ERP.

## Backups do PostgreSQL

O `docker-compose.yml` inclui o servico `db-backup`, que gera backups automaticos do PostgreSQL em formato custom do `pg_dump`.

Padrao:

```text
Intervalo: 1 vez por dia
Retencao: 30 dias
Volume:   sgqherbamed-db-backups
```

Para restaurar, copie o arquivo `.dump` desejado do volume de backup e use `pg_restore` contra o banco do SGQ. A TI deve testar periodicamente a restauracao.

## HTTPS

O compose publica a aplicacao em HTTP na porta `9027` para diagnostico direto. Em producao, o Nginx corporativo deve estar conectado a rede externa `herbamed_proxy` e usar o upstream interno:

```nginx
proxy_pass http://sgq-frontend:80;
```

Nao use `IP_DO_HOST:9027` no `proxy_pass` quando o alias interno estiver disponivel.

No Windows PowerShell:

```powershell
$env:ANTHROPIC_API_KEY="sua_chave"
docker compose up --build -d
```

## Comandos uteis

```bash
docker compose ps
docker compose logs -f
docker compose down
```

## Estrutura principal

```text
src/app              Aplicacao raiz e orquestracao
src/core             Temas, status e utilitarios puros
src/shared           UI reutilizavel e estilos compartilhados
src/layout           Sidebar e icones de navegacao
src/features         Modulos por dominio/tela
src/services         Clientes auxiliares do frontend
server               Backend Node para API, autenticacao, uploads locais e integracoes
nginx                Configuracao do frontend e proxy /api para o backend
docs                 Documentacao tecnica de migracao e integracao
```
