# Guia de instalacao - SGQ Herbamed

Este projeto roda totalmente no Docker da empresa, com frontend, backend e banco PostgreSQL locais. O Firebase nao e mais utilizado como banco de dados nem como autenticacao.
Arquivos anexados, COAs, fichas tecnicas e documentos controlados ficam no PostgreSQL local do SGQ. Novos uploads nao sao enviados para nuvem externa.

## Portas

- Frontend: `9027`
- Backend/API: `9028`
- PostgreSQL externo: `5487`
- PostgreSQL interno no container: `5432`

## Primeiro deploy no servidor

1. Clone o repositorio por SSH:

```bash
git clone git@github.com:herbamedti/sgqherbamed.git
cd sgqherbamed
```

2. Crie o arquivo `.env` a partir do exemplo:

```bash
cp .env.example .env
```

3. Ajuste obrigatoriamente no `.env`:

```env
POSTGRES_PASSWORD=uma_senha_forte
JWT_SECRET=um_segredo_forte
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

4. Suba a aplicacao:

```bash
docker compose up --build -d
```

5. Acesse:

```text
http://IP_DO_SERVIDOR:9027
```

## Integracao Areco

A integracao com o banco do Areco e somente leitura. O SGQ consulta recebimentos no ERP e grava uma copia operacional no PostgreSQL local do SGQ.

Para ativar a sincronizacao a cada 3 minutos, configure no `.env`:

```env
ARECO_SYNC_ENABLED=true
ARECO_SYNC_INTERVAL_MS=180000
ARECO_SQLSERVER_HOST=10.0.242.230
ARECO_SQLSERVER_PORT=5327
ARECO_SQLSERVER_DATABASE=VSatHerbamed
ARECO_SQLSERVER_USER=usuario_somente_leitura
ARECO_SQLSERVER_PASSWORD=senha_somente_leitura
```

Depois reinicie:

```bash
docker compose up -d
```

## Backup do banco

O compose sobe tambem o container `sgqherbamed-db-backup`. Ele gera dumps automaticos do PostgreSQL no volume `sgqherbamed-db-backups`.

Padrao:

- `BACKUP_INTERVAL_SECONDS=86400`: 1 backup por dia
- `BACKUP_RETENTION_DAYS=30`: remove backups com mais de 30 dias

Como os arquivos do sistema tambem ficam no PostgreSQL, esse backup cobre registros da qualidade, assinaturas, trilha de auditoria e anexos/documentos.

## HTTPS

O sistema fica publicado pelo Docker na porta `9027`. Em producao, a TI deve colocar HTTPS no dominio ou proxy reverso que aponta para essa porta.

## Comandos uteis

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose down
docker compose up --build -d
```
