# Herbamed RNC em Docker

## Subir em producao local

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
```

## Variaveis de ambiente

O SGQ usa o PostgreSQL do proprio Docker como banco oficial. O banco do Areco e usado apenas para consulta/leitura quando a sincronizacao estiver ativada.

Para habilitar os recursos de IA que chamam `/api/claude`, defina:

```bash
ANTHROPIC_API_KEY=sua_chave
POSTGRES_DB=sgqherbamed
POSTGRES_USER=sgqherbamed
POSTGRES_PASSWORD=troque_esta_senha
JWT_SECRET=troque_este_segredo
INITIAL_ADMIN_EMAIL=admin
INITIAL_ADMIN_PASSWORD=Herba@123
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
ARECO_SQLSERVER_USER=usuario_somente_leitura
ARECO_SQLSERVER_PASSWORD=senha
```

Importante: a integracao Areco e somente leitura. O SGQ nao cria, altera ou remove dados no banco do ERP.

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
src/services         Clientes de integracoes externas
server               Backend Node para healthcheck e API /api/claude
nginx                Configuracao do frontend e proxy /api para o backend
docs                 Documentacao tecnica de migracao e integracao
```
