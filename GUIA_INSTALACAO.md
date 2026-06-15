# Guia de instalacao - SGQ Herbamed

Este projeto roda totalmente no Docker da empresa, com frontend, backend e banco PostgreSQL locais. O Firebase nao e mais utilizado como banco de dados nem como autenticacao.
Arquivos anexados, COAs, fichas tecnicas e documentos controlados ficam no PostgreSQL local do SGQ. Novos uploads nao sao enviados para nuvem externa.

## Portas

- Frontend: `9027`
- Backend/API: `9028`
- PostgreSQL externo: `5487`
- PostgreSQL interno no container: `5432`
- Upstream interno para o Nginx corporativo: `sgq-frontend:80`
- Rede Docker compartilhada do proxy: `herbamed_proxy`

## Primeiro deploy no servidor

1. Clone o repositorio por SSH:

```bash
git clone git@github.com:herbamedti/sgqherbamed.git
cd sgqherbamed
```

2. Prepare o `.env` automaticamente:

```bash
sh scripts/setup-production-env.sh
```

No Windows PowerShell:

```powershell
.\scripts\setup-production-env.ps1
```

O script cria `POSTGRES_PASSWORD` e `JWT_SECRET` fortes automaticamente. Se o arquivo `.env` ja existir, ele nao altera nada.

3. Se a sincronizacao com o Areco for usada, preencha no `.env`:

```env
ARECO_SQLSERVER_PASSWORD=senha_somente_leitura
```

Conta padrao para testes:

```text
Usuario: admin
Senha:   Herba@123
```

4. Suba a aplicacao:

```bash
docker network inspect herbamed_proxy >/dev/null 2>&1 || docker network create herbamed_proxy
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

O sistema fica publicado pelo Docker na porta `9027` para diagnostico direto. Em producao, o Nginx corporativo deve usar a rede Docker compartilhada e apontar para o alias interno:

```nginx
proxy_pass http://sgq-frontend:80;
```

Evite apontar o Nginx para `IP_DO_HOST:9027`, pois o padrao atual da infraestrutura usa a rede `herbamed_proxy`.

Para uploads de documentos controlados, o bloco do Nginx corporativo tambem precisa permitir corpos maiores:

```nginx
client_max_body_size 80m;
```

## Comandos uteis

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose down
docker compose up --build -d
```
